/* Generate the checked-in hostile bundle corpus used by exchange tests.
 * Every case keeps manifest.json first so failures exercise the intended guard.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { strToU8, zipSync } from 'fflate';

const out = new URL('.', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const manifest = (characters = [], books = [], formatVersion = 1) => ({
  formatVersion,
  appVersion: '0.1.0',
  exportedAt: 1,
  characterIds: characters,
  bookIds: books,
});
const json = (value) => strToU8(JSON.stringify(value));
const archive = (entries) =>
  zipSync(
    { 'manifest.json': json(entries.manifest), ...entries.files },
    { mtime: 315532800000 },
  );
const put = async (name, bytes) => writeFile(new URL(name, out), bytes);

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(12 + data.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(typeBytes, 4);
  result.set(data, 8);
  view.setUint32(8 + data.length, crc32(result.subarray(4, 8 + data.length)));
  return result;
};
const png = (width = 1, height = 1) => {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const pixels = new Uint8Array(height * (width * 4 + 1));
  const bytes = [
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', new Uint8Array()),
  ];
  const result = new Uint8Array(
    bytes.reduce((sum, value) => sum + value.length, 0),
  );
  let offset = 0;
  for (const value of bytes) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};
const character = (characterId, extra = {}) => ({
  id: characterId,
  name: 'Momo',
  createdAt: 1,
  updatedAt: 1,
  rigType: 'cutout',
  rig: null,
  effectPrefs: {},
  ...extra,
});

await mkdir(out, { recursive: true });
await put(
  'path-traversal.zip',
  archive({ manifest: manifest(), files: { '../evil': strToU8('x') } }),
);
await put(
  'unknown-top-level.zip',
  archive({ manifest: manifest(), files: { 'evil.txt': strToU8('x') } }),
);
await put(
  'nested-archive.zip',
  archive({
    manifest: manifest(),
    files: { [`characters/${id(1)}/nested.zip`]: strToU8('PK') },
  }),
);

const many = { manifest: manifest(), files: {} };
for (let n = 1; n <= 1000; n += 1)
  many.files[`books/${id(1)}/audio/${id(n)}.bin`] = strToU8('x');
await put(
  'too-many-entries.zip',
  archive({ ...many, files: { ...many.files, 'evil.txt': strToU8('x') } }),
);

const entryCap = new Uint8Array(64 * 1024 * 1024 + 1);
await put(
  'entry-size-cap.zip',
  archive({
    manifest: manifest(),
    files: { [`characters/${id(1)}/texture.png`]: entryCap },
  }),
);
const totalCap = {};
const largeEntry = () => {
  const bytes = new Uint8Array(64 * 1024 * 1024);
  // Keep the compressed size above the ratio guard while remaining small on disk.
  let state = 0x12345678;
  for (let n = bytes.length - 1024 * 1024; n < bytes.length; n += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bytes[n] = state & 0xff;
  }
  return bytes;
};
for (let n = 1; n <= 9; n += 1)
  totalCap[`books/${id(1)}/audio/${id(n)}.bin`] = largeEntry();
await put(
  'total-size-cap.zip',
  archive({ manifest: manifest(), files: totalCap }),
);
await put(
  'ratio-bomb.zip',
  archive({
    manifest: manifest(),
    files: {
      [`characters/${id(1)}/texture.png`]: new Uint8Array(64 * 1024 * 1024),
    },
  }),
);

const characterId = id(2);
const characterFiles = (value) => ({
  [`characters/${characterId}/character.json`]: json(value),
  [`characters/${characterId}/texture.png`]: png(),
  [`characters/${characterId}/thumb.png`]: png(),
});
await put(
  'oversized-image.zip',
  archive({
    manifest: manifest([characterId]),
    files: {
      ...characterFiles(character(characterId)),
      [`characters/${characterId}/texture.png`]: png(4097, 1),
    },
  }),
);
await put(
  'nan-rig.zip',
  archive({
    manifest: manifest([characterId]),
    files: {
      ...characterFiles(characterId),
      [`characters/${characterId}/character.json`]: strToU8(
        JSON.stringify(
          character(characterId, {
            rig: { vertices: [null], triangles: [], weights: [1] },
          }),
        ).replace('[null]', '[NaN]'),
      ),
    },
  }),
);
await put(
  'extra-json-key.zip',
  archive({
    manifest: manifest([characterId]),
    files: characterFiles(character(characterId, { extra: true })),
  }),
);

const bookId = id(3);
const pageId = id(4);
const book = (page) => ({
  id: bookId,
  title: 'Story',
  createdAt: 1,
  updatedAt: 1,
  pages: [page],
});
const bookFiles = (value, audio = strToU8('MZ')) => ({
  [`books/${bookId}/book.json`]: json(value),
  [`books/${bookId}/audio/${pageId}.bin`]: audio,
});
await put(
  'dangling-audio.zip',
  archive({
    manifest: manifest([], [bookId]),
    files: bookFiles(
      book({
        id: pageId,
        backgroundId: 'plain_cream',
        text: '',
        effectIds: [],
        advance: 'tap',
        createdAt: 1,
        updatedAt: 1,
      }),
    ),
  }),
);
const unsafePage = {
  id: pageId,
  backgroundId: 'plain_cream',
  text: '',
  effectIds: [],
  narrationMime: 'image/png',
  advance: 'tap',
  createdAt: 1,
  updatedAt: 1,
};
await put(
  'unsafe-audio-mime.zip',
  archive({
    manifest: manifest([], [bookId]),
    files: bookFiles(book(unsafePage)),
  }),
);
const spoofedPage = { ...unsafePage, narrationMime: 'audio/mpeg' };
await put(
  'spoofed-audio.zip',
  archive({
    manifest: manifest([], [bookId]),
    files: bookFiles(book(spoofedPage)),
  }),
);
await put(
  'future-format.zip',
  archive({ manifest: manifest([], [], 99), files: {} }),
);
