import { BookSchema, PageSchema } from '../../domain/schemas';
import type { Book } from '../../domain/types';
import { db } from '../db';
import { StorageCorruptionError } from '../errors';
import { gc } from '../gc';
import { readValidated, writeValidated } from './helpers';
import { withQuotaHandling } from '../quota';

export const booksRepo = {
  put: (book: Book): Promise<Book> =>
    writeValidated(db.books, BookSchema, book, 'book'),
  get: (id: string): Promise<Book | undefined> =>
    readValidated(db.books, BookSchema, id, 'book'),
  listByRecency: async (): Promise<Book[]> =>
    Promise.all(
      (await db.books.orderBy('updatedAt').reverse().toArray()).map(
        (row) =>
          readValidated(db.books, BookSchema, row.id, 'book') as Promise<Book>,
      ),
    ),
  list: async (): Promise<Book[]> =>
    Promise.all(
      (await db.books.orderBy('createdAt').toArray()).map(
        (row) =>
          readValidated(db.books, BookSchema, row.id, 'book') as Promise<Book>,
      ),
    ),
  update: (book: Book): Promise<Book> =>
    writeValidated(db.books, BookSchema, book, 'book'),
  async reorderPages(bookId: string, pageOrder: string[]): Promise<Book> {
    const parsedOrder = BookSchema.shape.pageOrder.parse(pageOrder);
    return withQuotaHandling(() =>
      db.transaction('rw', db.books, async () => {
        const book = await readValidated(db.books, BookSchema, bookId, 'book');
        if (!book) throw new Error(`Book not found (${bookId})`);
        const updated = BookSchema.parse({
          ...book,
          pageOrder: parsedOrder,
          updatedAt: Date.now(),
        });
        await db.books.put(updated);
        return updated;
      }),
    );
  },
  async deleteBook(id: string): Promise<void> {
    await withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.books, db.pages, db.blobs, db.drawings, db.characters, db.settings],
        async () => {
          const book = await readValidated(db.books, BookSchema, id, 'book');
          if (!book) return;
          const pages = await db.pages.where('bookId').equals(id).toArray();
          for (const rawPage of pages) {
            let page;
            try {
              page = PageSchema.parse(rawPage);
            } catch (error) {
              throw new StorageCorruptionError(
                'page',
                String((rawPage as { id?: unknown }).id),
                error,
              );
            }
            await db.pages.delete(page.id);
          }
          await db.books.delete(id);
          await gc.sweepInTransaction();
        },
      ),
    );
  },
  delete: (id: string): Promise<void> => booksRepo.deleteBook(id),
};
