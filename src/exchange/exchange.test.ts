import 'fake-indexeddb/auto';

import { Blob as NodeBlob } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';

import { newId } from '../domain/ids';
import {
  db,
  blobsRepo,
  drawingsRepo,
  charactersRepo,
  booksRepo,
  pagesRepo,
} from '../storage';
import { exportBundle } from './export';
import { ImportValidationError, prepareImport, commitImport } from './import';

const TEST_IMAGE_DECODER = (bytes: Uint8Array): Promise<Uint8Array> =>
  Promise.resolve(bytes);
const prepare = (
  input: Parameters<typeof prepareImport>[0],
  options: {
    useWorker?: boolean;
    onProgress?: (processedBytes: number, totalBytes: number) => void;
  } = {},
) => prepareImport(input, { imageDecoder: TEST_IMAGE_DECODER, ...options });

const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  ),
  (char) => char.charCodeAt(0),
);
const id = () => newId();

async function seed(): Promise<{ characterId: string; bookId: string }> {
  const image = new NodeBlob([PNG_1X1], { type: 'image/png' });
  const imageBlobId = await blobsRepo.put('image/png', image);
  const textureBlobId = await blobsRepo.put('image/png', image);
  const thumbBlobId = await blobsRepo.put('image/png', image);
  const drawingId = id();
  const characterId = id();
  await drawingsRepo.put({
    id: drawingId,
    createdAt: 1,
    source: 'file',
    imageBlobId,
    width: 1,
    height: 1,
  });
  await charactersRepo.put({
    id: characterId,
    name: 'Momo',
    createdAt: 1,
    updatedAt: 1,
    rigType: 'cutout',
    drawingId,
    textureBlobId,
    thumbBlobId,
    rig: null,
    effectPrefs: {},
  });
  const bookId = id();
  const pageId = id();
  await booksRepo.put({
    id: bookId,
    title: 'Story',
    createdAt: 1,
    updatedAt: 1,
    pageOrder: [pageId],
  });
  await pagesRepo.put({
    id: pageId,
    bookId,
    characterId,
    backgroundId: 'plain_cream',
    text: 'Hello',
    effectIds: [],
    advance: 'tap',
    createdAt: 1,
    updatedAt: 1,
  });
  return { characterId, bookId };
}

async function dbCounts(): Promise<number[]> {
  return Promise.all([
    db.blobs.count(),
    db.drawings.count(),
    db.characters.count(),
    db.books.count(),
    db.pages.count(),
    db.settings.count(),
  ]);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('inkstory exchange', () => {
  it('exports and imports a character and book with fresh ids', async () => {
    const seeded = await seed();
    const bundle = await exportBundle({
      characterIds: [seeded.characterId],
      bookIds: [seeded.bookId],
    });
    const progress: Array<[number, number]> = [];
    const prepared = await prepare(bundle, {
      useWorker: false,
      onProgress: (processedBytes, totalBytes) =>
        progress.push([processedBytes, totalBytes]),
    });
    expect(progress.at(-1)?.[0]).toBeGreaterThan(0);
    expect(progress.at(-1)?.[1]).toBeGreaterThanOrEqual(
      progress.at(-1)?.[0] ?? 0,
    );
    await expect(prepareImport(bundle)).rejects.toThrow(
      'image decoder is unavailable',
    );
    expect(prepared.preview).toEqual({
      characterCount: 1,
      bookCount: 1,
      bookTitles: ['Story'],
    });
    const result = await commitImport(prepared);
    expect(result.characterIds).toHaveLength(1);
    expect(result.bookIds).toHaveLength(1);
    expect(result.characterIds[0]).not.toBe(seeded.characterId);
    expect(await charactersRepo.list()).toHaveLength(2);
    expect(await booksRepo.list()).toHaveLength(2);
  });

  it('re-encodes imported PNGs through the browser canvas path', async () => {
    const characterId = id();
    const dirtyPng = Uint8Array.from([...PNG_1X1, 0x65, 0x58, 0x49, 0x66]);
    const bytes = zipSync({
      'manifest.json': strToU8(
        JSON.stringify({
          formatVersion: 1,
          appVersion: '0.1.0',
          exportedAt: 1,
          characterIds: [characterId],
          bookIds: [],
        }),
      ),
      [`characters/${characterId}/character.json`]: strToU8(
        JSON.stringify({
          id: characterId,
          name: 'Momo',
          createdAt: 1,
          updatedAt: 1,
          rigType: 'cutout',
          rig: null,
          effectPrefs: {},
        }),
      ),
      [`characters/${characterId}/texture.png`]: dirtyPng,
      [`characters/${characterId}/thumb.png`]: dirtyPng,
    });
    const previousBitmap = Object.getOwnPropertyDescriptor(
      globalThis,
      'createImageBitmap',
    );
    const previousCanvas = Object.getOwnPropertyDescriptor(
      globalThis,
      'OffscreenCanvas',
    );
    const metadataPng = new Uint8Array(PNG_1X1.length + 13);
    metadataPng.set(PNG_1X1.slice(0, -12));
    metadataPng.set(
      [0, 0, 0, 1, 0x65, 0x58, 0x49, 0x66, 0, 0, 0, 0, 0],
      PNG_1X1.length - 12,
    );
    metadataPng.set(PNG_1X1.slice(-12), PNG_1X1.length + 1);
    class FakeCanvas {
      width = 1;
      height = 1;
      getContext() {
        return { drawImage: () => undefined };
      }
      convertToBlob() {
        return Promise.resolve(
          new NodeBlob([metadataPng], { type: 'image/png' }),
        );
      }
    }
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: () =>
        Promise.resolve({
          width: 1,
          height: 1,
          close: () => undefined,
        }),
    });
    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: FakeCanvas,
    });
    try {
      const prepared = await prepareImport(new NodeBlob([bytes]), {
        useWorker: false,
      });
      const image = prepared.blobs[0];
      expect(image).toBeDefined();
      expect(image!.data.size).toBe(PNG_1X1.byteLength);
      expect(image!.data.type).toBe('image/png');
    } finally {
      if (previousBitmap)
        Object.defineProperty(globalThis, 'createImageBitmap', previousBitmap);
      else
        delete (globalThis as { createImageBitmap?: unknown })
          .createImageBitmap;
      if (previousCanvas)
        Object.defineProperty(globalThis, 'OffscreenCanvas', previousCanvas);
      else delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
    }
  });

  it.each([
    ['path traversal', { '../evil': strToU8('x') }],
    ['unknown top-level file', { 'evil.txt': strToU8('x') }],
    [
      'nested archive',
      {
        'characters/00000000-0000-4000-8000-000000000001/nested.zip':
          strToU8('PK'),
      },
    ],
  ])('rejects %s entries before database writes', async (_name, extra) => {
    const manifest = {
      formatVersion: 1,
      appVersion: '0.1.0',
      exportedAt: 1,
      characterIds: [],
      bookIds: [],
    };
    const bytes = zipSync({
      'manifest.json': strToU8(JSON.stringify(manifest)),
      ...extra,
    });
    await expect(prepare(new NodeBlob([bytes]))).rejects.toBeInstanceOf(
      ImportValidationError,
    );
    expect(await dbCounts()).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it.each([
    ['path-traversal.zip', 'path is not allowed'],
    ['unknown-top-level.zip', 'path is not allowed'],
    ['nested-archive.zip', 'path is not allowed'],
    ['too-many-entries.zip', 'too many entries'],
    ['entry-size-cap.zip', 'entry exceeds 64 MiB limit'],
    ['total-size-cap.zip', 'total uncompressed size exceeds limit'],
    ['ratio-bomb.zip', 'decompression ratio exceeds limit'],
    ['oversized-image.zip', 'image dimensions exceed 4096x4096'],
    ['nan-rig.zip', 'invalid JSON or schema'],
    ['extra-json-key.zip', 'invalid JSON or schema'],
    ['dangling-audio.zip', 'dangling audio entry'],
    ['unsafe-audio-mime.zip', 'audio MIME type or parameters are unsafe'],
    ['spoofed-audio.zip', 'audio bytes do not match MIME type'],
    ['future-format.zip', 'update inkstory to import this bundle'],
  ])(
    'rejects checked-in malicious fixture %s without any DB writes',
    async (name, reason) => {
      const before = await dbCounts();
      const bytes = await readFile(
        resolve(process.cwd(), 'tests/fixtures/bundles', name),
      );
      await expect(prepare(new NodeBlob([bytes]))).rejects.toThrow(reason);
      expect(await dbCounts()).toEqual(before);
    },
  );

  it('rejects strict manifest and JSON, dangling references, unsafe audio MIME, and spoofed audio', async () => {
    const characterId = id();
    const bookId = id();
    const pageId = id();
    const manifest = {
      formatVersion: 1,
      appVersion: '0.1.0',
      exportedAt: 1,
      characterIds: [characterId],
      bookIds: [bookId],
    };
    const character = {
      id: characterId,
      name: 'Momo',
      createdAt: 1,
      updatedAt: 1,
      rigType: 'cutout',
      rig: null,
      effectPrefs: {},
    };
    const book = {
      id: bookId,
      title: 'Story',
      createdAt: 1,
      updatedAt: 1,
      pages: [
        {
          id: pageId,
          characterId,
          backgroundId: 'plain_cream',
          text: '',
          effectIds: [],
          narrationMime: 'image/png',
          advance: 'tap',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    };
    const common = {
      'manifest.json': strToU8(JSON.stringify(manifest)),
      [`characters/${characterId}/character.json`]: strToU8(
        JSON.stringify(character),
      ),
      [`characters/${characterId}/texture.png`]: PNG_1X1,
      [`characters/${characterId}/thumb.png`]: PNG_1X1,
      [`books/${bookId}/book.json`]: strToU8(JSON.stringify(book)),
      [`books/${bookId}/audio/${pageId}.bin`]: strToU8('MZ'),
    };
    await expect(
      prepare(new NodeBlob([zipSync(common)])),
    ).rejects.toBeInstanceOf(ImportValidationError);
    await expect(
      prepare(
        new NodeBlob([
          zipSync({
            ...common,
            'manifest.json': strToU8(
              JSON.stringify({ ...manifest, formatVersion: 99 }),
            ),
          }),
        ]),
      ),
    ).rejects.toBeInstanceOf(ImportValidationError);
    await expect(
      prepare(
        new NodeBlob([
          zipSync({
            ...common,
            [`characters/${characterId}/character.json`]: strToU8(
              JSON.stringify({ ...character, extra: true }),
            ),
          }),
        ]),
      ),
    ).rejects.toBeInstanceOf(ImportValidationError);
    expect(await db.books.count()).toBe(0);
  });
});
