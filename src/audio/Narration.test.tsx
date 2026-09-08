import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Narration } from './Narration';
import i18n from '@/i18n/setup';
const active = vi.hoisted(() => ({
  cancel: vi.fn(),
  stream: {},
  result: new Promise(() => undefined),
  stop: vi.fn(),
}));
vi.mock('./recorder', () => ({
  startRecording: () => Promise.resolve(active),
}));
vi.mock('./levelMeter', () => ({
  createLevelMeter: () => {
    throw new Error('AudioContext failed');
  },
}));
vi.mock('@/ui/useBlobUrl', () => ({ useBlobUrl: () => undefined }));
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
