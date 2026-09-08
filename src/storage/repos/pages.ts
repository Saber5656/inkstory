import { BookSchema, PageSchema } from '../../domain/schemas';
import type { Page } from '../../domain/types';
import { db } from '../db';
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
  list: async (): Promise<Page[]> =>
    Promise.all(
      (await db.pages.orderBy('updatedAt').toArray()).map(
        (row) =>
          readValidated(db.pages, PageSchema, row.id, 'page') as Promise<Page>,
      ),
    ),
  update: (page: Page): Promise<Page> =>
    writeValidated(db.pages, PageSchema, page, 'page'),
  async delete(id: string): Promise<void> {
    await withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.pages, db.blobs, db.books, db.drawings, db.characters, db.settings],
        async () => {
          await readValidated(db.pages, PageSchema, id, 'page');
          await db.pages.delete(id);
          await gc.sweepInTransaction();
        },
      ),
    );
  },
};
