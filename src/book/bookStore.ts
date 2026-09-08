import { create } from 'zustand';
import type { Book, Page } from '@/domain/types';
import { booksRepo } from '@/storage/repos/books';
import { pagesRepo } from '@/storage/repos/pages';
import { createAutosave } from './autosave';
const pending = new Map<string, ReturnType<typeof createAutosave<Page>>>();
const titleSaves = new Map<string, ReturnType<typeof createAutosave<Book>>>();
interface BookState {
  book: Book | undefined;
  pages: Page[];
  selectedId: string | undefined;
  status: 'saved' | 'saving' | 'error';
  load: (id: string) => Promise<void>;
  select: (id: string) => void;
  updatePage: (page: Page) => void;
  rename: (title: string) => void;
  addPage: () => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  flush: () => Promise<void>;
}
export const useBookStore = create<BookState>((set, get) => ({
  book: undefined,
  pages: [],
  selectedId: undefined,
  status: 'saved',
  async load(id) {
    await get().flush();
    const book = await booksRepo.get(id);
    const pages = await pagesRepo.listByBook(id);
    if (book) {
      const pageIds = new Set(pages.map((page) => page.id));
      const order = [
        ...new Set(book.pageOrder.filter((pageId) => pageIds.has(pageId))),
      ];
      for (const page of pages)
        if (!order.includes(page.id)) order.push(page.id);
      if (order.join() !== book.pageOrder.join()) {
        console.warn('Repaired page order');
        book.pageOrder = order;
        await booksRepo.reorderPages(id, order);
      }
      const rank = new Map(order.map((pageId, index) => [pageId, index]));
      pages.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    }
    set({ book, pages, selectedId: pages[0]?.id, status: 'saved' });
  },
  select(id) {
    set({ selectedId: id });
  },
  updatePage(page) {
    set((state) => ({
      pages: state.pages.map((current) =>
        current.id === page.id ? page : current,
      ),
      status: 'saving',
    }));
    let save = pending.get(page.id);
    if (!save) {
      save = createAutosave<Page>(
        async (value) => {
          await pagesRepo.put(value);
          set({ status: 'saved' });
        },
        () => set({ status: 'error' }),
      );
      pending.set(page.id, save);
    }
    save.schedule(page);
  },
  rename(title) {
    const book = get().book;
    if (!book) return;
    const updated = { ...book, title, updatedAt: Date.now() };
    set({ book: updated, status: 'saving' });
    let save = titleSaves.get(book.id);
    if (!save) {
      save = createAutosave<Book>(
        async (value) => {
          await booksRepo.put(value);
          set({ status: 'saved' });
        },
        () => set({ status: 'error' }),
      );
      titleSaves.set(book.id, save);
    }
    save.schedule(updated);
  },
  async addPage() {
    await get().flush();
    const book = get().book;
    if (!book) return;
    const now = Date.now();
    const page: Page = {
      id: crypto.randomUUID(),
      bookId: book.id,
      backgroundId: 'plain_cream',
      text: '',
      effectIds: [],
      advance: 'tap',
      createdAt: now,
      updatedAt: now,
    };
    await pagesRepo.addToBook(page);
    await get().load(book.id);
    set({ selectedId: page.id });
  },
  async deletePage(id) {
    await get().flush();
    const book = get().book;
    if (!book) return;
    await pagesRepo.delete(id);
    await get().load(book.id);
  },
  async reorder(ids) {
    await get().flush();
    const book = get().book;
    const selected = get().selectedId;
    if (!book) return;
    await booksRepo.reorderPages(book.id, ids);
    await get().load(book.id);
    if (selected) set({ selectedId: selected });
  },
  async flush() {
    try {
      await Promise.all(
        [...pending.values(), ...titleSaves.values()].map((save) =>
          save.flush(),
        ),
      );
      for (const [id, save] of pending)
        if (!save.hasPending()) pending.delete(id);
      for (const [id, save] of titleSaves)
        if (!save.hasPending()) titleSaves.delete(id);
      if (pending.size || titleSaves.size) {
        await get().flush();
        return;
      }
      set({ status: 'saved' });
    } catch (error) {
      set({ status: 'error' });
      throw error;
    }
  },
}));
