import { AsyncUnzipInflate, Unzip, UnzipPassThrough } from 'fflate';

import { newId } from '../domain/ids';
import {
  BlobRecordSchema,
  BookSchema,
  CharacterSchema,
  DrawingSchema,
  PageSchema,
} from '../domain/schemas';
import type {
  BlobRecord,
  Book,
  Character,
  Drawing,
  Page,
} from '../domain/types';
import { db, withQuotaHandling } from '../storage';
import { encodeBlobRecord } from '../storage/blobPersistence';
import {
  BUNDLE_PATH_RE,
  BundleManifestSchema,
  MAX_AUDIO_BYTES,
  MAX_BUNDLE_BYTES,
  MAX_COMPRESSION_RATIO,
  MAX_ENTRIES,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_UNCOMPRESSED_BYTES,
  PortableBookSchema,
  PortableCharacterSchema,
  type BundleManifest,
  type PortableBook,
  BundleValidationError,
  parseJson,
} from './bundleSchema';

export { BundleValidationError as ImportValidationError } from './bundleSchema';

type EntryMap = Map<string, Uint8Array>;
export interface ImportPreview {
  characterCount: number;
  bookCount: number;
  bookTitles: string[];
}
export interface PreparedImport {
  preview: ImportPreview;
  manifest: BundleManifest;
  characters: Character[];
  drawings: Drawing[];
  books: Book[];
  pages: Page[];
  blobs: BlobRecord[];
  committed: boolean;
}
export interface ImportResult {
  characterIds: string[];
  bookIds: string[];
}
export type ImageDecoder = (
  bytes: Uint8Array,
  path: string,
) => Promise<Uint8Array>;
export interface PrepareImportOptions {
  useWorker?: boolean;
  imageDecoder?: ImageDecoder;
  onProgress?: (processedBytes: number, totalBytes: number) => void;
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new BundleValidationError(path, message, cause);
}

export type BundleInput =
  Uint8Array | { readonly size: number; arrayBuffer(): Promise<ArrayBuffer> };

async function inputBytes(input: BundleInput): Promise<Uint8Array> {
  const size = input instanceof Uint8Array ? input.byteLength : input.size;
  if (size > MAX_BUNDLE_BYTES) fail('bundle', 'bundle exceeds 256 MiB limit');
  if (input instanceof Uint8Array) return input;
  if (typeof input.arrayBuffer === 'function') {
    const bytes = new Uint8Array(await input.arrayBuffer());
    if (bytes.byteLength > MAX_BUNDLE_BYTES)
      fail('bundle', 'bundle exceeds 256 MiB limit');
    return bytes;
  }
  if (typeof FileReader !== 'undefined') {
    return new Uint8Array(
      await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () =>
          reject(reader.error ?? new Error('bundle read failed'));
        reader.readAsArrayBuffer(input as Blob);
      }),
    );
  }
  if (typeof Response !== 'undefined')
    return new Uint8Array(
      await new Response(input as unknown as BodyInit).arrayBuffer(),
    );
  fail('bundle', 'cannot read bundle input');
}

interface CentralEntry {
  path: string;
  compressedSize: number;
  uncompressedSize: number;
}

function readU16(view: DataView, offset: number, path: string): number {
  if (offset + 2 > view.byteLength) fail(path, 'truncated central directory');
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number, path: string): number {
  if (offset + 4 > view.byteLength) fail(path, 'truncated central directory');
  return view.getUint32(offset, true);
}

/** Validates the ZIP central directory before any decompression is started. */
export function preflightCentralDirectory(bytes: Uint8Array): CentralEntry[] {
  const start = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= start; offset -= 1) {
    if (
      offset >= 0 &&
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) fail('bundle', 'ZIP end of central directory is missing');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const disk = readU16(view, eocd + 4, 'bundle');
  const centralDisk = readU16(view, eocd + 6, 'bundle');
  const entriesOnDisk = readU16(view, eocd + 8, 'bundle');
  const entriesTotal = readU16(view, eocd + 10, 'bundle');
  const centralSize = readU32(view, eocd + 12, 'bundle');
  const centralOffset = readU32(view, eocd + 16, 'bundle');
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entriesTotal ||
    entriesTotal === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  )
    fail('bundle', 'multi-disk or ZIP64 archives are not supported');
  if (entriesTotal > MAX_ENTRIES) fail('bundle', 'too many entries');
  if (
    centralOffset + centralSize > bytes.byteLength ||
    centralOffset + centralSize > eocd
  )
    fail('bundle', 'central directory exceeds archive bounds');
  const result: CentralEntry[] = [];
  const paths = new Set<string>();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < entriesTotal; index += 1) {
    if (readU32(view, offset, 'bundle') !== 0x02014b50)
      fail('bundle', 'invalid central directory entry');
    const compression = readU16(view, offset + 10, 'bundle');
    const compressedSize = readU32(view, offset + 20, 'bundle');
    const uncompressedSize = readU32(view, offset + 24, 'bundle');
    const nameLength = readU16(view, offset + 28, 'bundle');
    const extraLength = readU16(view, offset + 30, 'bundle');
    const commentLength = readU16(view, offset + 32, 'bundle');
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > centralOffset + centralSize)
      fail('bundle', 'central directory entry exceeds bounds');
    const path = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (!BUNDLE_PATH_RE.test(path)) fail(path, 'path is not allowed');
    if (paths.has(path)) fail(path, 'duplicate entry');
    if (uncompressedSize > MAX_ENTRY_BYTES)
      fail(path, 'entry exceeds 64 MiB limit');
    if (
      compressedSize > 0 &&
      uncompressedSize / compressedSize > MAX_COMPRESSION_RATIO
    )
      fail(path, 'decompression ratio exceeds limit');
    total += uncompressedSize;
    if (total > MAX_TOTAL_UNCOMPRESSED_BYTES)
      fail(path, 'total uncompressed size exceeds limit');
    if (compression !== 0 && compression !== 8)
      fail(path, 'unsupported compression method');
    paths.add(path);
    result.push({ path, compressedSize, uncompressedSize });
    offset = end;
  }
  if (offset !== centralOffset + centralSize)
    fail('bundle', 'central directory size mismatch');
  if (result[0]?.path !== 'manifest.json')
    fail('manifest.json', 'manifest must be the first entry');
  return result;
}

export async function unzipStream(
  bytes: Uint8Array,
  onProgress?: (processedBytes: number, totalBytes: number) => void,
): Promise<EntryMap> {
  const centralEntries = preflightCentralDirectory(bytes);
  const archiveTotal = centralEntries.reduce(
    (sum, entry) => sum + entry.uncompressedSize,
    0,
  );
  return new Promise((resolve, reject) => {
    const entries: EntryMap = new Map();
    let count = 0;
    let declaredTotal = 0;
    let firstPath: string | undefined;
    let pending = 0;
    let processed = 0;
    let ended = false;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      if (error) {
        settled = true;
        reject(error);
        return;
      }
      if (ended && pending === 0) {
        settled = true;
        resolve(entries);
      }
    };
    const zip = new Unzip((file) => {
      count += 1;
      if (count > MAX_ENTRIES) {
        finish(new BundleValidationError('bundle', 'too many entries'));
        return;
      }
      if (!firstPath) firstPath = file.name;
      if (!BUNDLE_PATH_RE.test(file.name)) {
        finish(new BundleValidationError(file.name, 'path is not allowed'));
        return;
      }
      if (entries.has(file.name)) {
        finish(new BundleValidationError(file.name, 'duplicate entry'));
        return;
      }
      const declared = file.originalSize ?? 0;
      const compressed = file.size ?? 0;
      if (declared > MAX_ENTRY_BYTES) {
        finish(
          new BundleValidationError(file.name, 'entry exceeds 64 MiB limit'),
        );
        return;
      }
      if (compressed > 0 && declared / compressed > MAX_COMPRESSION_RATIO) {
        finish(
          new BundleValidationError(
            file.name,
            'decompression ratio exceeds limit',
          ),
        );
        return;
      }
      declaredTotal += declared;
      if (declaredTotal > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        finish(
          new BundleValidationError(
            file.name,
            'total uncompressed size exceeds limit',
          ),
        );
        return;
      }
      pending += 1;
      const chunks: Uint8Array[] = [];
      let size = 0;
      file.ondata = (error, chunk, final) => {
        if (error) {
          finish(new BundleValidationError(file.name, 'inflate failed', error));
          return;
        }
        size += chunk.byteLength;
        if (
          size > MAX_ENTRY_BYTES ||
          size > (file.originalSize ?? MAX_ENTRY_BYTES)
        ) {
          finish(
            new BundleValidationError(
              file.name,
              'inflated size exceeds declared cap',
            ),
          );
          file.terminate();
          return;
        }
        chunks.push(chunk);
        if (final) {
          entries.set(file.name, concat(chunks, size));
          pending -= 1;
          processed += size;
          onProgress?.(processed, archiveTotal);
          finish();
        }
      };
      try {
        file.start();
      } catch (error) {
        finish(
          new BundleValidationError(
            file.name,
            'unsupported compression',
            error,
          ),
        );
      }
    });
    zip.register(AsyncUnzipInflate);
    zip.register(UnzipPassThrough);
    try {
      zip.push(bytes, true);
      ended = true;
      if (firstPath !== 'manifest.json')
        finish(
          new BundleValidationError(
            'manifest.json',
            'manifest must be the first entry',
          ),
        );
      finish();
    } catch (error) {
      finish(new BundleValidationError('bundle', 'invalid zip archive', error));
    }
  });
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function ensurePNG(
  bytes: Uint8Array,
  path: string,
): { width: number; height: number } {
  if (
    bytes.byteLength < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  )
    fail(path, 'image is not a PNG');
  const width = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(16);
  const height = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(20);
  if (width < 1 || height < 1 || width > 4096 || height > 4096)
    fail(path, 'image dimensions exceed 4096x4096');
  return { width, height };
}

async function reencodeImage(
  bytes: Uint8Array,
  path: string,
): Promise<Uint8Array> {
  const dimensions = ensurePNG(bytes, path);
  if (typeof createImageBitmap === 'undefined')
    fail(path, 'browser image decoder is unavailable');
  const image = await createImageBitmap(
    new Blob([bytes as unknown as BlobPart]),
  );
  if (image.width !== dimensions.width || image.height !== dimensions.height)
    fail(path, 'decoded image dimensions mismatch');
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(image.width, image.height)
      : document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context || !('drawImage' in context))
    fail(path, 'cannot create image canvas');
  context.drawImage(image, 0, 0);
  image.close();
  if ('convertToBlob' in canvas) {
    const encoded = await canvas.convertToBlob({
      type: 'image/png',
    });
    return stripPngMetadata(new Uint8Array(await encoded.arrayBuffer()), path);
  }
  const encoded = await new Promise<ArrayBuffer>((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('canvas encoding failed'));
        return;
      }
      void blob
        .arrayBuffer()
        .then(resolve, (error) =>
          reject(
            error instanceof Error
              ? error
              : new Error('canvas encoding failed'),
          ),
        );
    }, 'image/png'),
  );
  return stripPngMetadata(new Uint8Array(encoded), path);
}

function stripPngMetadata(bytes: Uint8Array, path: string): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < signature.length ||
    signature.some((value, index) => bytes[index] !== value)
  )
    fail(path, 'encoded image is not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [bytes.slice(0, signature.length)];
  let offset = signature.length;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail(path, 'encoded PNG is truncated');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) fail(path, 'encoded PNG chunk exceeds bounds');
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (
      type === 'IHDR' ||
      type === 'PLTE' ||
      type === 'IDAT' ||
      type === 'IEND'
    )
      chunks.push(bytes.slice(offset, end));
    offset = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) fail(path, 'encoded PNG is missing IEND');
  const output = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
}

async function unzipInWorker(
  bytes: Uint8Array,
  onProgress:
    ((processedBytes: number, totalBytes: number) => void) | undefined,
): Promise<EntryMap> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./inflateWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (
      event: MessageEvent<{
        entries?: Array<{ path: string; bytes: ArrayBuffer }>;
        progress?: { processedBytes: number; totalBytes: number };
        error?: { path: string; message: string };
      }>,
    ) => {
      if (event.data.progress) {
        onProgress?.(
          event.data.progress.processedBytes,
          event.data.progress.totalBytes,
        );
        return;
      }
      worker.terminate();
      if (event.data.error) {
        reject(
          new BundleValidationError(
            event.data.error.path,
            event.data.error.message,
          ),
        );
        return;
      }
      resolve(
        new Map(
          (event.data.entries ?? []).map((entry) => [
            entry.path,
            new Uint8Array(entry.bytes),
          ]),
        ),
      );
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new BundleValidationError('bundle', 'inflate worker failed'));
    };
    const transferable =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.slice().buffer;
    worker.postMessage({ bytes: transferable }, [transferable]);
  });
}

async function unzipEntries(
  bytes: Uint8Array,
  useWorker: boolean,
  onProgress?: (processedBytes: number, totalBytes: number) => void,
): Promise<EntryMap> {
  preflightCentralDirectory(bytes);
  if (useWorker && typeof Worker !== 'undefined')
    return unzipInWorker(bytes, onProgress);
  return unzipStream(bytes, onProgress);
}

function safeAudioMime(mime: string): boolean {
  const [type = '', ...parameters] = mime
    .toLowerCase()
    .split(';')
    .map((part) => part.trim());
  if (!['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg'].includes(type))
    return false;
  return parameters.every((parameter) =>
    /^codecs=(opus|vorbis|mp4a\.40\.2|mp3)$/i.test(parameter),
  );
}

function ensureAudio(bytes: Uint8Array, mime: string, path: string): void {
  const normalizedMime = mime.toLowerCase();
  if (!safeAudioMime(normalizedMime))
    fail(path, 'audio MIME type or parameters are unsafe');
  if (bytes.byteLength > MAX_AUDIO_BYTES)
    fail(path, 'audio exceeds 20 MiB limit');
  if (!bytes.byteLength) return;
  const isOgg =
    bytes.length >= 4 && new TextDecoder().decode(bytes.slice(0, 4)) === 'OggS';
  const isWebm =
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;
  const isMp4 =
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  const isMpeg =
    (bytes.length >= 3 &&
      new TextDecoder().decode(bytes.slice(0, 3)) === 'ID3') ||
    (bytes.length >= 2 &&
      bytes[0] === 0xff &&
      ((bytes[1] ?? 0) & 0xe0) === 0xe0);
  if (
    (normalizedMime.startsWith('audio/ogg') && !isOgg) ||
    (normalizedMime.startsWith('audio/webm') && !isWebm) ||
    (normalizedMime.startsWith('audio/mp4') && !isMp4) ||
    (normalizedMime.startsWith('audio/mpeg') && !isMpeg)
  )
    fail(path, 'audio bytes do not match MIME type');
}

function freshBlob(
  bytes: Uint8Array,
  mime: string,
  createdAt: number,
): BlobRecord {
  const data = new Blob([bytes as unknown as BlobPart], { type: mime });
  return BlobRecordSchema.parse({
    id: newId(),
    mime,
    data,
    size: data.size,
    createdAt,
  });
}

export async function prepareImport(
  input: BundleInput,
  options: PrepareImportOptions = {},
): Promise<PreparedImport> {
  const bytes = await inputBytes(input);
  const entries = await unzipEntries(
    bytes,
    options.useWorker ?? true,
    options.onProgress,
  );
  const decoder: ImageDecoder =
    options.imageDecoder && import.meta.env.MODE === 'test'
      ? options.imageDecoder
      : reencodeImage;
  const manifestBytes = entries.get('manifest.json');
  if (!manifestBytes) fail('manifest.json', 'manifest is missing');
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (error) {
    fail('manifest.json', 'invalid JSON', error);
  }
  if (
    typeof rawManifest === 'object' &&
    rawManifest !== null &&
    'formatVersion' in rawManifest &&
    typeof rawManifest.formatVersion === 'number' &&
    rawManifest.formatVersion > 1
  )
    fail('manifest.json', 'update inkstory to import this bundle');
  const manifest = parseJson(
    BundleManifestSchema,
    manifestBytes,
    'manifest.json',
  );
  for (const path of entries.keys()) {
    const characterMatch = path.match(/^characters\/([^/]+)\//);
    if (
      characterMatch &&
      !manifest.characterIds.includes(characterMatch[1] ?? '')
    )
      fail(path, 'character is not listed in manifest');
    const bookMatch = path.match(/^books\/([^/]+)\//);
    if (bookMatch && !manifest.bookIds.includes(bookMatch[1] ?? ''))
      fail(path, 'book is not listed in manifest');
  }
  const characters: Character[] = [];
  const drawings: Drawing[] = [];
  const blobs: BlobRecord[] = [];
  const oldToNewCharacter = new Map<string, string>();
  for (const oldId of manifest.characterIds) {
    const base = `characters/${oldId}`;
    const characterBytes = entries.get(`${base}/character.json`);
    const textureBytes = entries.get(`${base}/texture.png`);
    const thumbBytes = entries.get(`${base}/thumb.png`);
    if (!characterBytes || !textureBytes || !thumbBytes)
      fail(
        base,
        'character requires character.json, texture.png, and thumb.png',
      );
    const dto = parseJson(
      PortableCharacterSchema,
      characterBytes,
      `${base}/character.json`,
    );
    if (dto.id !== oldId)
      fail(`${base}/character.json`, 'character id does not match path');
    const texture = await decoder(textureBytes, `${base}/texture.png`);
    const thumb = await decoder(thumbBytes, `${base}/thumb.png`);
    ensurePNG(texture, `${base}/texture.png`);
    ensurePNG(thumb, `${base}/thumb.png`);
    const textureBlob = freshBlob(texture, 'image/png', dto.createdAt);
    const thumbBlob = freshBlob(thumb, 'image/png', dto.createdAt);
    const imageBlob = freshBlob(texture, 'image/png', dto.createdAt);
    const drawing = DrawingSchema.parse({
      id: newId(),
      createdAt: dto.createdAt,
      source: 'file',
      imageBlobId: imageBlob.id,
      width: ensurePNG(texture, `${base}/texture.png`).width,
      height: ensurePNG(texture, `${base}/texture.png`).height,
    });
    const character = CharacterSchema.parse({
      ...dto,
      id: newId(),
      drawingId: drawing.id,
      textureBlobId: textureBlob.id,
      thumbBlobId: thumbBlob.id,
    });
    oldToNewCharacter.set(oldId, character.id);
    characters.push(character);
    drawings.push(drawing);
    blobs.push(imageBlob, textureBlob, thumbBlob);
  }
  const books: Book[] = [];
  const pages: Page[] = [];
  const usedAudio = new Set<string>();
  for (const oldBookId of manifest.bookIds) {
    const path = `books/${oldBookId}/book.json`;
    const bookBytes = entries.get(path);
    if (!bookBytes) fail(path, 'book.json is missing');
    const dto: PortableBook = parseJson(PortableBookSchema, bookBytes, path);
    if (dto.id !== oldBookId) fail(path, 'book id does not match path');
    const newBookId = newId();
    const newPageIds: string[] = [];
    for (const pageDto of dto.pages) {
      const newPageId = newId();
      newPageIds.push(newPageId);
      const characterId = pageDto.characterId
        ? oldToNewCharacter.get(pageDto.characterId)
        : undefined;
      if (pageDto.characterId && !characterId)
        fail(path, `page ${pageDto.id} references a missing character`);
      let narrationBlobId: string | undefined;
      if (pageDto.narrationMime) {
        const audioPath = `books/${oldBookId}/audio/${pageDto.id}.bin`;
        const audio = entries.get(audioPath);
        if (!audio) fail(audioPath, 'narration audio is missing');
        ensureAudio(audio, pageDto.narrationMime, audioPath);
        const audioBlob = freshBlob(
          audio,
          pageDto.narrationMime,
          pageDto.createdAt,
        );
        blobs.push(audioBlob);
        narrationBlobId = audioBlob.id;
        usedAudio.add(audioPath);
      }
      pages.push(
        PageSchema.parse({
          ...pageDto,
          id: newPageId,
          bookId: newBookId,
          ...(characterId ? { characterId } : {}),
          ...(narrationBlobId ? { narrationBlobId } : {}),
        }),
      );
    }
    books.push(
      BookSchema.parse({
        id: newBookId,
        title: dto.title,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        pageOrder: newPageIds,
      }),
    );
  }
  for (const path of entries.keys())
    if (
      path.startsWith('books/') &&
      path.includes('/audio/') &&
      !usedAudio.has(path)
    )
      fail(path, 'dangling audio entry');
  return {
    preview: {
      characterCount: characters.length,
      bookCount: books.length,
      bookTitles: books.map((book) => book.title),
    },
    manifest,
    characters,
    drawings,
    books,
    pages,
    blobs,
    committed: false,
  };
}

export async function commitImport(
  prepared: PreparedImport,
): Promise<ImportResult> {
  if (prepared.committed) throw new Error('Import has already been committed');
  const persistedBlobs = await Promise.all(
    prepared.blobs.map(encodeBlobRecord),
  );
  await withQuotaHandling(() =>
    db.transaction(
      'rw',
      [db.blobs, db.drawings, db.characters, db.books, db.pages],
      async () => {
        for (const blob of persistedBlobs) await db.blobs.put(blob);
        for (const drawing of prepared.drawings)
          await db.drawings.put(DrawingSchema.parse(drawing));
        for (const character of prepared.characters)
          await db.characters.put(CharacterSchema.parse(character));
        for (const book of prepared.books)
          await db.books.put(BookSchema.parse(book));
        for (const page of prepared.pages)
          await db.pages.put(PageSchema.parse(page));
      },
    ),
  );
  prepared.committed = true;
  return {
    characterIds: prepared.characters.map((character) => character.id),
    bookIds: prepared.books.map((book) => book.id),
  };
}
