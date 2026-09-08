import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import type { Character } from '@/domain/types';
import i18n from '@/i18n/setup';
import Stage from './Stage';

const getCharacter = vi.hoisted(() => vi.fn());
const animatedStage = vi.hoisted(() => vi.fn());

vi.mock('@/storage/repos/characters', () => ({
  charactersRepo: { get: getCharacter, put: vi.fn() },
}));
vi.mock('@/render/AnimatedStage', () => ({
  AnimatedStage: (props: Record<string, unknown>) => {
    animatedStage(props);
    return <div data-testid="animated-stage" />;
  },
}));
vi.mock('@/ui/useBlobUrl', () => ({
  useBlobUrl: (id?: string) => (id ? `blob:${id}` : undefined),
}));
vi.mock('@/ui/motionPreference', () => ({ useMotionPreference: () => false }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function character(id: string, name = id): Character {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    rigType: 'cutout',
    drawingId: `${id}-drawing`,
    textureBlobId: `${id}-texture`,
    thumbBlobId: `${id}-thumb`,
    rig: null,
    effectPrefs: { effectIds: ['float'], intensity: 0.5 },
  };
}

function NavigateTo({ id }: { id: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(`/characters/${id}`)}>switch</button>;
}

function latestActor(): unknown {
  const calls = animatedStage.mock.calls as unknown[][];
  const props = calls.at(-1)?.[0];
  if (!props || typeof props !== 'object' || !('character' in props))
    return undefined;
  return props.character;
}

function renderStage(id = 'old') {
  return render(
    <MemoryRouter initialEntries={[`/characters/${id}`]}>
      <Routes>
        <Route
          path="/characters/:id"
          element={
            <>
              <NavigateTo id="new" />
              <Stage />
            </>
          }
        />
        <Route path="/" element={<p>library</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  getCharacter.mockReset();
  animatedStage.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Stage loading lifecycle', () => {
  it('clears the previous character while a new id is loading', async () => {
    const oldRequest = deferred<Character | undefined>();
    const newRequest = deferred<Character | undefined>();
    getCharacter.mockImplementation((id: string) =>
      id === 'old' ? oldRequest.promise : newRequest.promise,
    );
    renderStage();

    await act(async () => {
      oldRequest.resolve(character('old', 'Old'));
      await Promise.resolve();
    });
    expect(await screen.findByDisplayValue('Old')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Old')).toBeNull();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

    await act(async () => {
      newRequest.resolve(character('new', 'New'));
      await Promise.resolve();
    });
    expect(await screen.findByDisplayValue('New')).toBeInTheDocument();
  });

  it('keeps the renderer actor stable while renaming the character', async () => {
    getCharacter.mockResolvedValue(character('old', 'Old'));
    renderStage();
    const input = await screen.findByDisplayValue('Old');
    const initialActor = latestActor();

    fireEvent.change(input, { target: { value: 'Renamed' } });
    expect(await screen.findByDisplayValue('Renamed')).toBeInTheDocument();
    expect(latestActor()).toBe(initialActor);
  });

  it('ignores a rejected request from the previous id', async () => {
    const oldRequest = deferred<Character | undefined>();
    const newRequest = deferred<Character | undefined>();
    getCharacter.mockImplementation((id: string) =>
      id === 'old' ? oldRequest.promise : newRequest.promise,
    );
    renderStage();
    await act(async () => {
      oldRequest.resolve(character('old', 'Old'));
      await Promise.resolve();
    });
    expect(await screen.findByDisplayValue('Old')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));
    await act(async () => {
      oldRequest.reject(new Error('old request failed'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      newRequest.resolve(character('new', 'New'));
      await Promise.resolve();
    });
    expect(await screen.findByDisplayValue('New')).toBeInTheDocument();
  });

  it('returns to the library when the requested character is missing', async () => {
    getCharacter.mockResolvedValue(undefined);
    renderStage('missing');
    expect(await screen.findByText('library')).toBeInTheDocument();
  });
});
