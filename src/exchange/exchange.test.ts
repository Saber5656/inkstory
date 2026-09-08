import 'fake-indexeddb/auto';

import { Blob as NodeBlob } from 'node:buffer';
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
    const prepared = await prepareImport(bundle);
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
    await expect(prepareImport(new NodeBlob([bytes]))).rejects.toBeInstanceOf(
      ImportValidationError,
    );
    expect(await db.characters.count()).toBe(0);
  });

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
      prepareImport(new NodeBlob([zipSync(common)])),
    ).rejects.toBeInstanceOf(ImportValidationError);
    await expect(
      prepareImport(
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
      prepareImport(
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
