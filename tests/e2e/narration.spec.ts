import { expect, test, type Page } from '@playwright/test';

type NarrationProbe = {
  getUserMediaCalls: number;
  stoppedTracks: number;
  trackStopObservationAvailable: boolean;
  tracks: MediaStreamTrack[];
};

type NarrationRecord = {
  narrationBlobId?: string;
  narrationMime?: string;
};

async function currentNarration(page: Page): Promise<NarrationRecord> {
  const bookId = new URL(page.url()).pathname.split('/')[2];
  return page.evaluate(
    (currentBookId) =>
      new Promise<NarrationRecord>((resolve, reject) => {
        const request = indexedDB.open('inkstory');
        request.onerror = () =>
          reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('pages', 'readonly');
          const rows = transaction.objectStore('pages').getAll();
          rows.onerror = () =>
            reject(rows.error ?? new Error('IndexedDB read failed'));
          rows.onsuccess = () => {
            const record = rows.result.find((row) => {
              const candidate = row as unknown as {
                bookId?: unknown;
                narrationBlobId?: unknown;
              };
              return (
                candidate.bookId === currentBookId &&
                typeof candidate.narrationBlobId === 'string'
              );
            }) as NarrationRecord | undefined;
            database.close();
            resolve(record ?? {});
          };
        };
      }),
    bookId,
  );
}

async function hasBlob(page: Page, id: string): Promise<boolean> {
  return page.evaluate(
    (blobId) =>
      new Promise<boolean>((resolve, reject) => {
        const request = indexedDB.open('inkstory');
        request.onerror = () =>
          reject(request.error ?? new Error('IndexedDB open failed'));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('blobs', 'readonly');
          const row = transaction.objectStore('blobs').get(blobId);
          row.onerror = () =>
            reject(row.error ?? new Error('IndexedDB read failed'));
          row.onsuccess = () => {
            database.close();
            resolve(row.result !== undefined);
          };
        };
      }),
    id,
  );
}

async function allSyntheticTracksEnded(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = (window as unknown as { __narrationProbe?: NarrationProbe })
      .__narrationProbe;
    return (
      !!probe?.tracks.length &&
      probe.tracks.every((track) => track.readyState === 'ended')
    );
  });
}

async function playPreview(page: Page): Promise<void> {
  const audio = page.locator('audio[aria-label="Listen"]');
  await audio.evaluate(async (element) => {
    const player = element as HTMLAudioElement;
    player.muted = true;
    await Promise.race([
      player.play(),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
  });
  await expect
    .poll(() =>
      audio.evaluate((element) => {
        const player = element as HTMLAudioElement;
        return player.currentTime > 0;
      }),
    )
    .toBe(true);
}

async function installSyntheticMicrophone(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: NarrationProbe = {
      getUserMediaCalls:
        Number(sessionStorage.getItem('narration.getUserMedia')) || 0,
      stoppedTracks:
        Number(sessionStorage.getItem('narration.stoppedTracks')) || 0,
      trackStopObservationAvailable:
        sessionStorage.getItem('narration.trackStopSupported') === 'true',
      tracks: [],
    };
    (
      window as unknown as { __narrationProbe: NarrationProbe }
    ).__narrationProbe = probe;

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) throw new Error('mediaDevices is unavailable');
    const getUserMedia = async () => {
      probe.getUserMediaCalls += 1;
      sessionStorage.setItem(
        'narration.getUserMedia',
        String(probe.getUserMediaCalls),
      );
      const AudioContextConstructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) throw new Error('AudioContext unavailable');

      const context = new AudioContextConstructor();
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      oscillator.frequency.value = 440;
      gain.gain.value = 0.1;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();

      const tracks = destination.stream.getTracks();
      probe.tracks.push(...tracks);
      for (const track of tracks) {
        const stop = track.stop.bind(track);
        const wrappedStop = () => {
          probe.stoppedTracks += 1;
          probe.trackStopObservationAvailable = true;
          sessionStorage.setItem('narration.trackStopSupported', 'true');
          sessionStorage.setItem(
            'narration.stoppedTracks',
            String(probe.stoppedTracks),
          );
          stop();
        };
        try {
          Object.defineProperty(track, 'stop', {
            configurable: true,
            writable: true,
            value: wrappedStop,
          });
        } catch {
          // Some WebKit versions expose MediaStreamTrack.stop as non-configurable.
        }
        // Some WebKit versions return a distinct native track from getTracks;
        // support is marked only when this wrapper actually observes stop().
      }
      return destination.stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { ...mediaDevices, getUserMedia },
    });
  });
}

async function createFreshBookPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /Books/ })).toBeVisible();
  await page.getByRole('tab', { name: /Books/ }).click();
  await page.getByRole('button', { name: 'Make a storybook' }).click();
  await expect(page).toHaveURL(/\/books\/[^/]+\/edit$/);
  await page.getByRole('button', { name: 'Add a page' }).click();
  await expect(page.getByRole('textbox', { name: 'Story text' })).toBeVisible();
}

async function recordSyntheticNarration(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /Record your voice|Record again/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start recording' })
    .click();
  await expect(page.getByText(/Recording \d+ \/ 60 seconds/)).toBeVisible();
  await page.waitForTimeout(2100);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('audio[aria-label="Listen"]')).toBeVisible({
    timeout: 30000,
  });
}

test('records synthetic narration, persists preview, replaces it, and deletes it', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90000);
  await installSyntheticMicrophone(page);
  await page.addInitScript(() => {
    localStorage.setItem('inkstory.locale', 'en');
  });
  await createFreshBookPage(page);
  const recorderAvailable = await page.evaluate(
    () => typeof MediaRecorder !== 'undefined',
  );
  if (!recorderAvailable) {
    await expect(
      page.getByText(
        'Recording is unavailable in this browser. You can still enjoy text stories.',
      ),
    ).toBeVisible();
    expect(await currentNarration(page)).toEqual({});
  }
  test.fixme(
    !recorderAvailable,
    'This browser build has no MediaRecorder; the unsupported UI is verified separately. macOS WebKit recording is tested locally.',
  );

  await recordSyntheticNarration(page);
  expect(await allSyntheticTracksEnded(page)).toBe(true);
  const first = await currentNarration(page);
  expect(first.narrationBlobId).toBeTruthy();
  expect(first.narrationMime).toMatch(/^audio\//);
  expect(await hasBlob(page, first.narrationBlobId!)).toBe(true);

  await page.reload();
  await expect(page.locator('audio[aria-label="Listen"]')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Record again' }),
  ).toBeVisible();
  expect(await currentNarration(page)).toEqual(first);
  await playPreview(page);

  await recordSyntheticNarration(page);
  expect(await allSyntheticTracksEnded(page)).toBe(true);
  const second = await currentNarration(page);
  expect(second.narrationBlobId).toBeTruthy();
  expect(second.narrationBlobId).not.toBe(first.narrationBlobId);
  expect(await hasBlob(page, second.narrationBlobId!)).toBe(true);
  expect(await hasBlob(page, first.narrationBlobId!)).toBe(false);

  const narrationSection = page.locator('section').filter({
    has: page.locator('audio[aria-label="Listen"]'),
  });
  await narrationSection.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(page.locator('audio[aria-label="Listen"]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Record your voice' }),
  ).toBeVisible();
  expect(await currentNarration(page)).toEqual({});
  expect(await hasBlob(page, second.narrationBlobId!)).toBe(false);

  await page.reload();
  await expect(page.locator('audio[aria-label="Listen"]')).toHaveCount(0);
  const probe = await page.evaluate(() => ({
    getUserMediaCalls:
      Number(sessionStorage.getItem('narration.getUserMedia')) || 0,
    stoppedTracks:
      Number(sessionStorage.getItem('narration.stoppedTracks')) || 0,
    trackStopObservationAvailable:
      sessionStorage.getItem('narration.trackStopSupported') === 'true',
  }));
  expect(probe.getUserMediaCalls).toBeGreaterThanOrEqual(2);
  if (probe.trackStopObservationAvailable)
    expect(probe.stoppedTracks).toBeGreaterThan(0);
  test.info().annotations.push({ type: 'browser', description: browserName });
});

test('explains unavailable recording without blocking text stories', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('inkstory.locale', 'en');
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: undefined,
    });
  });
  await createFreshBookPage(page);
  await expect(
    page.getByText(
      'Recording is unavailable in this browser. You can still enjoy text stories.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Record your voice|Record again/ }),
  ).toHaveCount(0);
  await page
    .getByRole('textbox', { name: 'Story text' })
    .fill('A story without a recording');
  await page.getByRole('button', { name: 'Read story' }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator('.player .story-panel')).toHaveText(
    'A story without a recording',
  );
});
