import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const fixture =
  process.env.INKSTORY_LARGE_IMPORT_FIXTURE ?? '/tmp/inkstory-200mb.inkstory';

test('200 MiB valid synthetic import stays responsive and reaches preview', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium' || process.env.RUN_LARGE_IMPORT_PERF !== '1',
    'manual local performance measurement; Chromium only',
  );
  if (!existsSync(fixture))
    execFileSync(
      'node',
      [resolve(process.cwd(), 'tools/generate-large-import.mjs'), fixture],
      { stdio: 'inherit' },
    );
  await page.addInitScript(() => {
    const probe = {
      beats: 0,
      maxGapMs: 0,
      last: performance.now(),
      progressEvents: 0,
    };
    const scope = window as Window & { __largeImportProbe?: typeof probe };
    scope.__largeImportProbe = probe;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      set onmessage(handler: ((event: MessageEvent) => void) | null) {
        super.onmessage = handler
          ? (event) => {
              if (
                event.data &&
                typeof event.data === 'object' &&
                'progress' in event.data
              )
                probe.progressEvents += 1;
              handler(event);
            }
          : null;
      }
      get onmessage() {
        return super.onmessage;
      }
    };
    const tick = () => {
      const now = performance.now();
      probe.maxGapMs = Math.max(probe.maxGapMs, now - probe.last);
      probe.last = now;
      probe.beats += 1;
      window.setTimeout(tick, 50);
    };
    window.setTimeout(tick, 50);
  });
  await page.goto('/settings');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const beforeMetrics = await cdp.send('Performance.getMetrics');
  const beforeHeap =
    beforeMetrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')
      ?.value ?? 0;
  const started = Date.now();
  await page.getByTestId('import-input').setInputFiles(fixture);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 180000 });
  await expect(dialog).toContainText('Synthetic 200 MiB import');
  const elapsedMs = Date.now() - started;
  const probe = await page.evaluate(
    () =>
      (
        window as Window & {
          __largeImportProbe?: {
            beats: number;
            maxGapMs: number;
            progressEvents: number;
          };
        }
      ).__largeImportProbe,
  );
  expect(probe?.beats ?? 0).toBeGreaterThan(2);
  expect(probe?.maxGapMs ?? Number.POSITIVE_INFINITY).toBeLessThan(2000);
  expect(probe?.progressEvents ?? 0).toBeGreaterThan(0);
  const afterMetrics = await cdp.send('Performance.getMetrics');
  const afterHeap =
    afterMetrics.metrics.find((metric) => metric.name === 'JSHeapUsedSize')
      ?.value ?? 0;
  console.log(
    JSON.stringify({
      elapsedMs,
      heartbeatCount: probe?.beats,
      maxHeartbeatGapMs: probe?.maxGapMs,
      progressEvents: probe?.progressEvents,
      jsHeapBeforeBytes: beforeHeap,
      jsHeapAfterBytes: afterHeap,
      jsHeapDeltaBytes: afterHeap - beforeHeap,
      fixture,
      audioIsSynthetic: true,
    }),
  );
});
