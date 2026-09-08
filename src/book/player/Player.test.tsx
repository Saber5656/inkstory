import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Player from './Player';
import i18n from '@/i18n/setup';
const fixtures = vi.hoisted(() => ({
  pages: [
    { id: 'p1', text: 'One', advance: 'auto', narrationBlobId: 'voice' },
    { id: 'p2', text: 'Two', advance: 'auto' },
  ],
}));
vi.mock('@/storage/repos/books', () => ({
  booksRepo: { get: () => Promise.resolve({ id: 'book' }) },
}));
vi.mock('@/storage/repos/pages', () => ({
  pagesRepo: { listByBook: () => Promise.resolve(fixtures.pages) },
}));
vi.mock('@/storage/repos/characters', () => ({
  charactersRepo: { listByRecency: () => Promise.resolve([]) },
}));
vi.mock('@/ui/useBlobUrl', () => ({
  useBlobUrl: (id?: string) => (id ? 'blob:voice' : undefined),
}));
vi.mock('../PageView', () => ({
  PageView: ({ page }: { page: { text: string } }) => <div>{page.text}</div>,
}));
beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage('en');
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function start() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/books/book/play']}>
        <Routes>
          <Route path="/books/:id/play" element={<Player />} />
          <Route path="/" element={<div>Library destination</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  await act(() => vi.advanceTimersByTimeAsync(600));
}
it('waits for narration end + 1s, then silent 6s; replay resets the narration state', async () => {
  await start();
  expect(screen.getByText('One')).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(7000));
  expect(screen.getByText('One')).toBeVisible();
  fireEvent.ended(document.querySelector('audio')!);
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(screen.getByText('One')).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByText('Two')).toBeVisible();
  // eslint-disable-next-line @typescript-eslint/unbound-method -- Inspecting a spy, not invoking an unbound method.
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(300));
  await act(() => vi.advanceTimersByTimeAsync(5999));
  expect(screen.getByText('Two')).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByRole('heading')).toHaveTextContent('The end');
  fireEvent.click(screen.getByRole('button', { name: 'Read again' }));
  await act(() => vi.advanceTimersByTimeAsync(8000));
  expect(screen.getByText('One')).toBeVisible();
});
it('previous at the first page keeps auto playback active; short exit press does nothing', async () => {
  await start();
  fireEvent.keyDown(screen.getByRole('button', { name: /Next page/ }), {
    key: 'ArrowLeft',
  });
  fireEvent.ended(document.querySelector('audio')!);
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText('Two')).toBeVisible();
  const exit = screen.getByRole('button', {
    name: /Hold.*exit|Exit.*hold|Finish.*hold|finish.*1/i,
  });
  fireEvent.keyDown(exit, { key: 'Enter' });
  await act(() => vi.advanceTimersByTimeAsync(200));
  fireEvent.keyUp(exit, { key: 'Enter' });
  expect(screen.queryByText('Library destination')).toBeNull();
  fireEvent.keyDown(exit, { key: 'Enter' });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText('Library destination')).toBeVisible();
});
