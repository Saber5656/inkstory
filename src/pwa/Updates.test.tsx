import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Updates } from './Updates';
import { storageEvents, STORAGE_FULL_EVENT } from '@/storage/quota';
import i18n from '@/i18n/setup';
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
it('suppresses waiting updates during a draft and requests activation on a safe screen', async () => {
  vi.stubEnv('PROD', true);
  await i18n.changeLanguage('en');
  const postMessage = vi.fn();
  const serviceWorker = Object.assign(new EventTarget(), {
    register: vi
      .fn()
      .mockResolvedValue(
        Object.assign(new EventTarget(), { waiting: { postMessage } }),
      ),
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });
  const first = render(
    <MemoryRouter initialEntries={['/characters/new']}>
      <Updates />
    </MemoryRouter>,
  );
  await act(() => Promise.resolve());
  expect(screen.queryByRole('button', { name: /Update now/ })).toBeNull();
  first.unmount();
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Updates />
    </MemoryRouter>,
  );
  const apply = await screen.findByRole('button', { name: 'Update now' });
  fireEvent.click(apply);
  expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
});
it('coalesces repeated quota notifications into one recoverable dialog', async () => {
  await i18n.changeLanguage('en');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  render(
    <MemoryRouter>
      <Updates />
    </MemoryRouter>,
  );
  act(() => {
    storageEvents.dispatchEvent(new Event(STORAGE_FULL_EVENT));
    storageEvents.dispatchEvent(new Event(STORAGE_FULL_EVENT));
  });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/settings');
});
