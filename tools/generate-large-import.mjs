#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

const output = process.argv[2] ?? '/tmp/inkstory-200mb.inkstory';
const pageCount = 10;
const audioBytes = 20 * 1024 * 1024;
const bookId = '00000000-0000-4000-8000-000000000030';
const pages = [];
const entries = {
  'manifest.json': strToU8(
    JSON.stringify({
      formatVersion: 1,
      appVersion: '0.1.0',
      exportedAt: 0,
      characterIds: [],
      bookIds: [bookId],
    }),
  ),
};

// The payload is deterministic, incompressible test data. It starts with OggS so
// the importer's container sniffing accepts it; it is not playable narration.
for (let index = 0; index < pageCount; index += 1) {
  const pageId = `00000000-0000-4000-8000-${String(index + 31).padStart(12, '0')}`;
  pages.push({
    id: pageId,
    backgroundId: 'paper',
    text: `Synthetic import performance page ${index + 1}`,
    effectIds: [],
    narrationMime: 'audio/ogg',
    advance: 'auto',
    createdAt: 0,
    updatedAt: 0,
  });
  const audio = new Uint8Array(audioBytes);
  audio.set([0x4f, 0x67, 0x67, 0x53]);
  let state = 0x9e3779b9 ^ index;
  for (let offset = 4; offset < audio.length; offset += 1) {
    state = Math.imul(state ^ (state >>> 16), 0x45d9f3b) >>> 0;
    audio[offset] = state & 0xff;
  }
  entries[`books/${bookId}/audio/${pageId}.bin`] = audio;
}
entries[`books/${bookId}/book.json`] = strToU8(
  JSON.stringify({
    id: bookId,
    title: 'Synthetic 200 MiB import',
    createdAt: 0,
    updatedAt: 0,
    pages,
  }),
);
const bytes = zipSync(entries, { level: 0 });
if (
  bytes.byteLength < 200 * 1024 * 1024 ||
  bytes.byteLength > 256 * 1024 * 1024
)
  throw new Error(`unexpected archive size: ${bytes.byteLength}`);
await writeFile(output, bytes);
console.log(
  JSON.stringify({
    output,
    archiveBytes: bytes.byteLength,
    uncompressedBytes: pageCount * audioBytes,
    pages: pageCount,
    audioIsSynthetic: true,
  }),
);
