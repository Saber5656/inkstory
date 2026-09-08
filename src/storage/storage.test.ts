import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CharacterInUseError,
  StorageCorruptionError,
  blobsRepo,
  booksRepo,
  charactersRepo,
  drawingsRepo,
  inkstoryDb,
  pagesRepo,
  settingsRepo,
  storageEvents,
} from './index';

const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob);
  await inkstoryDb.delete();
  await inkstoryDb.open();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage repositories', () => {
  it('round-trips records and orders pages by Book.pageOrder', async () => {
    const drawingId = id(1);
    const blobId = await blobsRepo.put(
      'image/png',
      new NodeBlob(['x'], { type: 'image/png' }),
    );
    const persisted = await inkstoryDb.blobs.get(blobId);
    expect(Object.prototype.toString.call(persisted?.data)).toBe(
      '[object ArrayBuffer]',
    );
    const loaded = await blobsRepo.get(blobId);
    expect(loaded?.data).toBeInstanceOf(NodeBlob);
    expect(new Uint8Array(await loaded!.data.arrayBuffer())).toEqual(
      new Uint8Array(await new NodeBlob(['x']).arrayBuffer()),
    );
    await drawingsRepo.put({
      id: drawingId,
      createdAt: 1,
      source: 'file',
      imageBlobId: blobId,
      width: 1,
      height: 1,
    });
    const book = {
      id: id(2),
      title: 'Story',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [id(4), id(3)],
    };
    await booksRepo.put(book);
    await pagesRepo.put({
      id: id(3),
      bookId: book.id,
      backgroundId: 'plain_cream',
      text: 'three',
      effectIds: [],
      advance: 'tap',
      createdAt: 1,
      updatedAt: 1,
    });
    await pagesRepo.put({
      id: id(4),
      bookId: book.id,
      backgroundId: 'plain_cream',
      text: 'four',
      effectIds: [],
      advance: 'tap',
      createdAt: 1,
      updatedAt: 1,
    });
    expect(
      (await pagesRepo.listByBook(book.id)).map((page) => page.id),
    ).toEqual([id(4), id(3)]);
    await settingsRepo.set('locale', 'ja');
    expect(await settingsRepo.get('locale')).toEqual({
      key: 'locale',
      value: 'ja',
    });
  });

  it('adds and deletes pages atomically with the book pageOrder', async () => {
    const book = {
      id: id(5),
      title: 'Pages',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [] as string[],
    };
    await booksRepo.put(book);
    const page = {
      id: id(6),
      bookId: book.id,
      backgroundId: 'plain_cream',
      text: '',
      effectIds: [] as string[],
      advance: 'tap' as const,
      createdAt: 1,
      updatedAt: 1,
    };
    await pagesRepo.addToBook(page);
    expect((await booksRepo.get(book.id))?.pageOrder).toEqual([page.id]);
    await pagesRepo.delete(page.id);
    expect((await booksRepo.get(book.id))?.pageOrder).toEqual([]);
  });

  it('rejects duplicate or foreign pages during atomic reorder', async () => {
    const book = {
      id: id(7),
      title: 'Order',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [id(8)],
    };
    await booksRepo.put(book);
    await expect(
      booksRepo.reorderPages(book.id, [id(8), id(8)]),
    ).rejects.toThrow();
    await expect(booksRepo.reorderPages(book.id, [id(9)])).rejects.toThrow();
  });

  it('cascades a book and its page narration, then sweeps orphan blobs', async () => {
    const narrationId = await blobsRepo.put(
      'audio/ogg',
      new NodeBlob(['audio'], { type: 'audio/ogg' }),
    );
    const book = {
      id: id(10),
      title: 'Delete me',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [id(11)],
    };
    await booksRepo.put(book);
    await pagesRepo.put({
      id: id(11),
      bookId: book.id,
      backgroundId: 'plain_cream',
      text: '',
      effectIds: [],
      narrationBlobId: narrationId,
      narrationMime: 'audio/ogg',
      advance: 'tap',
      createdAt: 1,
      updatedAt: 1,
    });
    const orphanId = await blobsRepo.put(
      'application/octet-stream',
      new NodeBlob(['orphan']),
    );
    await booksRepo.deleteBook(book.id);
    expect(await blobsRepo.get(narrationId)).toBeUndefined();
    expect(await blobsRepo.get(orphanId)).toBeUndefined();
  });

  it('blocks deleting a character referenced by a page and reports titles', async () => {
    const book = {
      id: id(20),
      title: 'Used book',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [id(21)],
    };
    await booksRepo.put(book);
    await pagesRepo.put({
      id: id(21),
      bookId: book.id,
      characterId: id(22),
      backgroundId: 'plain_cream',
      text: '',
      effectIds: [],
      advance: 'tap',
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(charactersRepo.deleteCharacter(id(22))).rejects.toMatchObject({
      bookTitles: ['Used book'],
    });
    await expect(charactersRepo.deleteCharacter(id(22))).rejects.toBeInstanceOf(
      CharacterInUseError,
    );
  });

  it('raises typed corruption on read and emits one quota event for failed writes', async () => {
    await inkstoryDb.books.put({
      id: id(30),
      title: 'bad',
      createdAt: 1,
      updatedAt: 1,
      pageOrder: [],
      extra: true,
    } as never);
    await expect(booksRepo.get(id(30))).rejects.toBeInstanceOf(
      StorageCorruptionError,
    );

    const listener = vi.fn();
    storageEvents.addEventListener('storage-full', listener);
    const originalPut = inkstoryDb.settings.put.bind(inkstoryDb.settings);
    vi.spyOn(inkstoryDb.settings, 'put').mockRejectedValueOnce(
      Object.assign(new Error('full'), { name: 'QuotaExceededError' }),
    );
    await expect(settingsRepo.set('full', true)).rejects.toThrow('full');
    expect(listener).toHaveBeenCalledTimes(1);
    vi.spyOn(inkstoryDb.settings, 'put').mockImplementation(originalPut);
    storageEvents.removeEventListener('storage-full', listener);
  });

  it('rejects malformed persisted blob bytes instead of treating objects as Blobs', async () => {
    await inkstoryDb.blobs.put({
      id: id(31),
      mime: 'image/png',
      data: { size: 1, type: 'image/png' },
      size: 1,
      createdAt: 1,
    } as never);
    await expect(blobsRepo.get(id(31))).rejects.toBeInstanceOf(
      StorageCorruptionError,
    );
  });
});
