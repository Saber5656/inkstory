import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/storage/db';
import { booksRepo } from '@/storage/repos/books';
import { pagesRepo } from '@/storage/repos/pages';
import { useBookStore } from './bookStore';
const id = crypto.randomUUID();
beforeEach(async () => {
  await useBookStore.getState().flush();
  await db.delete();
  await db.open();
  await booksRepo.put({
    id,
    title: 'Story',
    createdAt: 1,
    updatedAt: 1,
    pageOrder: [],
  });
  await useBookStore.getState().load(id);
});
afterEach(() => vi.useRealTimers());
it('flushes pending edits on exit and keeps page order consistent through CRUD', async () => {
  const store = () => useBookStore.getState();
  await store().addPage();
  const first = store().pages[0]!;
  store().updatePage({ ...first, text: 'first' });
  await store().addPage();
  const second = store().pages[1]!;
  expect((await pagesRepo.get(first.id))?.text).toBe('first');
  store().updatePage({ ...second, text: 'second' });
  store().rename('Renamed');
  await store().flush();
  expect((await booksRepo.get(id))?.title).toBe('Renamed');
  await store().reorder([second.id, first.id]);
  expect((await booksRepo.get(id))?.pageOrder).toEqual([second.id, first.id]);
  await store().deletePage(first.id);
  expect((await booksRepo.get(id))?.pageOrder).toEqual([second.id]);
  expect(await pagesRepo.get(first.id)).toBeUndefined();
  expect((await pagesRepo.get(second.id))?.text).toBe('second');
});
it('repairs missing and duplicate page order entries without losing pages', async () => {
  await useBookStore.getState().addPage();
  const first = useBookStore.getState().pages[0]!;
  await useBookStore.getState().addPage();
  const second = useBookStore.getState().pages[1]!;
  await db.books.update(id, {
    pageOrder: [second.id, crypto.randomUUID(), second.id],
  });
  await useBookStore.getState().load(id);
  expect(useBookStore.getState().pages.map((p) => p.id)).toEqual([
    second.id,
    first.id,
  ]);
  expect((await booksRepo.get(id))?.pageOrder).toEqual([second.id, first.id]);
});
