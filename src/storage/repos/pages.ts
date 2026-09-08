import { BlobRecordSchema, BookSchema, PageSchema } from '../../domain/schemas';
import { newId } from '../../domain/ids';
import type { Page } from '../../domain/types';
import { db } from '../db';
import { encodeBlobRecord } from '../blobPersistence';
import { gc } from '../gc';
import { readValidated, writeValidated } from './helpers';
import { withQuotaHandling } from '../quota';

export const pagesRepo = {
  put: (page: Page): Promise<Page> =>
    writeValidated(db.pages, PageSchema, page, 'page'),
  get: (id: string): Promise<Page | undefined> =>
    readValidated(db.pages, PageSchema, id, 'page'),
  async listByBook(bookId: string): Promise<Page[]> {
    const book = await readValidated(db.books, BookSchema, bookId, 'book');
    const rows = await db.pages.where('bookId').equals(bookId).toArray();
    const parsed = await Promise.all(
      rows.map(
        (row) =>
          readValidated(db.pages, PageSchema, row.id, 'page') as Promise<Page>,
      ),
    );
    if (!book) return parsed;
    const rank = new Map(
      book.pageOrder.map((pageId, index) => [pageId, index]),
    );
    return parsed.sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  },
  async addToBook(page: Page): Promise<Page> {
    const parsed = PageSchema.parse(page);
    return withQuotaHandling(() =>
      db.transaction('rw', [db.pages, db.books], async () => {
        const book = await readValidated(
          db.books,
          BookSchema,
          parsed.bookId,
          'book',
        );
        if (!book) throw new Error(`Book not found (${parsed.bookId})`);
        if (
          book.pageOrder.includes(parsed.id) ||
          (await db.pages.get(parsed.id)) !== undefined
        )
          throw new Error(`Page already exists (${parsed.id})`);
        await db.pages.put(parsed);
        await db.books.put(
          BookSchema.parse({
            ...book,
            pageOrder: [...book.pageOrder, parsed.id],
            updatedAt: Date.now(),
          }),
        );
        return parsed;
      }),
    );
  },
  list: async (): Promise<Page[]> =>
    Promise.all(
      (await db.pages.orderBy('updatedAt').toArray()).map(
        (row) =>
          readValidated(db.pages, PageSchema, row.id, 'page') as Promise<Page>,
      ),
    ),
  update: (page: Page): Promise<Page> =>
    writeValidated(db.pages, PageSchema, page, 'page'),
  async replaceNarration(
    pageId: string,
    input?: { blob: Blob; mime: string },
  ): Promise<Page> {
    const persistedBlob = input
      ? await encodeBlobRecord(
          BlobRecordSchema.parse({
            id: newId(),
            mime: input.mime,
            data: input.blob,
            size: input.blob.size,
            createdAt: Date.now(),
          }),
        )
      : undefined;
    return withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.pages, db.blobs, db.books, db.drawings, db.characters, db.settings],
        async () => {
          const current = await readValidated(
            db.pages,
            PageSchema,
            pageId,
            'page',
          );
          if (!current) throw new Error(`Page not found (${pageId})`);
          const updated = PageSchema.parse({
            ...current,
            ...(persistedBlob
              ? {
                  narrationBlobId: persistedBlob.id,
                  narrationMime: persistedBlob.mime,
                }
              : { narrationBlobId: undefined, narrationMime: undefined }),
            updatedAt: Date.now(),
          });
          if (persistedBlob) await db.blobs.put(persistedBlob);
          await db.pages.put(updated);
          await gc.sweepInTransaction();
          return updated;
        },
      ),
    );
  },
  async delete(id: string): Promise<void> {
    await withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.pages, db.blobs, db.books, db.drawings, db.characters, db.settings],
        async () => {
          const page = await readValidated(db.pages, PageSchema, id, 'page');
          if (!page) return;
          await db.pages.delete(id);
          const book = await readValidated(
            db.books,
            BookSchema,
            page.bookId,
            'book',
          );
          if (book) {
            await db.books.put(
              BookSchema.parse({
                ...book,
                pageOrder: book.pageOrder.filter((pageId) => pageId !== id),
                updatedAt: Date.now(),
              }),
            );
          }
          await gc.sweepInTransaction();
        },
      ),
    );
  },
};
