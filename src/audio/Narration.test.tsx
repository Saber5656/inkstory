import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Narration } from './Narration';
import i18n from '@/i18n/setup';
const active = vi.hoisted(() => ({
  cancel: vi.fn(),
  stream: {},
  result: new Promise(() => undefined),
  stop: vi.fn(),
  blobUrl: vi.fn(() => undefined as string | undefined),
}));
vi.mock('./recorder', () => ({
  startRecording: () => Promise.resolve(active),
}));
vi.mock('./levelMeter', () => ({
  createLevelMeter: () => {
    throw new Error('AudioContext failed');
  },
}));
vi.mock('@/ui/useBlobUrl', () => ({ useBlobUrl: () => active.blobUrl() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('stops the microphone if meter initialization throws', async () => {
  vi.stubGlobal('MediaRecorder', class {});
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
  await i18n.changeLanguage('en');
  render(
    <Narration
      onSave={() => Promise.resolve()}
      onDelete={() => Promise.resolve()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Record your voice' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  await waitFor(() => expect(active.cancel).toHaveBeenCalled());
  expect(screen.getByRole('alert')).toBeVisible();
});

it('keeps an existing preview and delete action when recording is unsupported', async () => {
  vi.stubGlobal('MediaRecorder', undefined);
  active.blobUrl.mockReturnValue('blob:http://localhost/saved-voice');
  const onDelete = vi.fn(() => Promise.resolve());
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
  await i18n.changeLanguage('en');
  render(
    <Narration
      blobId="saved-voice"
      onSave={() => Promise.resolve()}
      onDelete={onDelete}
    />,
  );

  expect(
    screen.getByText(
      'Recording is unavailable in this browser. You can still enjoy text stories.',
    ),
  ).toBeVisible();
  expect(screen.getByLabelText('Listen')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Record again' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
  );
  await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
});
