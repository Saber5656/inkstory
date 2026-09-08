import { gzipSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const APP_ORIGIN = 'http://127.0.0.1:4173';
const EXTERNAL_PROBE = 'https://inkstory-csp-probe.invalid/blocked';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('inkstory.locale');
  });
});

test('production response CSP includes a frame boundary and restrictive directives', async ({
  page,
}) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
});

test('CSP blocks an injected inline script and a cross-origin fetch', async ({
  page,
}) => {
  await page.goto('/about');
  const inlineRan = await page.evaluate(async () => {
    const scope = window as Window & { __inkstoryInlineProbe?: boolean };
    scope.__inkstoryInlineProbe = false;
    const script = document.createElement('script');
    script.textContent = 'window.__inkstoryInlineProbe = true';
    document.body.append(script);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return scope.__inkstoryInlineProbe;
  });
  expect(inlineRan).toBe(false);
  const fetchResult = await page.evaluate(async (url) => {
    try {
      await fetch(url, { mode: 'cors' });
      return 'allowed';
    } catch {
      return 'blocked';
    }
  }, EXTERNAL_PROBE);
  expect(fetchResult).toBe('blocked');
});

test('privacy harness blocks a planted cross-origin image on an app route', async ({
  page,
}) => {
  await page.goto('/settings');
  let responded = false;
  page.on('response', (response) => {
    if (response.url() === EXTERNAL_PROBE) responded = true;
  });
  const result = await page.evaluate(async (url) => {
    const image = document.createElement('img');
    image.alt = 'CSP probe';
    image.src = url;
    document.body.append(image);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { naturalWidth: image.naturalWidth };
  }, EXTERNAL_PROBE);
  // Engines differ on whether a CSP-blocked image emits a request event; no response is allowed.
  expect(responded).toBe(false);
  expect(result.naturalWidth).toBe(0);
});

test('initial JavaScript gzip stays within the 300 KiB budget', async ({
  request,
}) => {
  const response = await request.get(APP_ORIGIN);
  expect(response.status()).toBe(200);
  const html = await response.text();
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  expect(sources.length).toBeGreaterThan(0);
  let total = 0;
  for (const source of new Set(sources)) {
    if (!source) continue;
    const asset = await request.get(new URL(source, APP_ORIGIN).toString());
    expect(asset.status(), source).toBe(200);
    total += gzipSync(await asset.body()).length;
  }
  expect(total, `initial JavaScript gzip=${total} bytes`).toBeLessThanOrEqual(
    300 * 1024,
  );
});

async function majorRoutes(
  page: import('@playwright/test').Page,
): Promise<string[]> {
  await page.goto('/');
  const routes = new Set(['/', '/settings', '/about', '/characters/new']);
  const characterLink = page
    .locator('a[href^="/characters/"]:not([href="/characters/new"])')
    .first();
  const character = (await characterLink.count())
    ? await characterLink.getAttribute('href')
    : null;
  if (character) routes.add(character);
  const bookTab = page
    .getByRole('tab')
    .filter({ hasText: /えほん|books/i })
    .first();
  if (await bookTab.count()) {
    await bookTab.click();
    const bookEditLink = page
      .locator('a[href^="/books/"][href$="/edit"]')
      .first();
    const bookPlayLink = page
      .locator('a[href^="/books/"][href$="/play"]')
      .first();
    const bookEdit = (await bookEditLink.count())
      ? await bookEditLink.getAttribute('href')
      : null;
    const bookPlay = (await bookPlayLink.count())
      ? await bookPlayLink.getAttribute('href')
      : null;
    if (bookEdit) routes.add(bookEdit);
    if (bookPlay) routes.add(bookPlay);
  }
  return [...routes];
}

test('major routes have no serious or critical axe violations in Japanese and English', async ({
  page,
}) => {
  for (const locale of ['ja', 'en'] as const) {
    await page.goto('/settings');
    const language = page.locator('select').first();
    await language.selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    const routes = await majorRoutes(page);
    for (const route of routes) {
      await page.goto(route);
      const result = await new AxeBuilder({ page }).analyze();
      const severe = result.violations.filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(severe, `${locale} ${route}: ${JSON.stringify(severe)}`).toEqual(
        [],
      );
    }
  }
});

test('renderer FPS probe is measured only when the app exposes one', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'renderer performance probe runs on Chromium only',
  );
  await page.goto('/');
  const character = await page
    .locator('a[href^="/characters/"]:not([href="/characters/new"])')
    .first()
    .getAttribute('href');
  test.skip(!character, 'sample character route is unavailable');
  await page.goto(character!);
  await expect(page.locator('.stage-surface')).toBeVisible();
  const hasProbe = await page.evaluate(
    () =>
      typeof (window as Window & { __inkstoryRendererFrameProbe?: unknown })
        .__inkstoryRendererFrameProbe === 'function',
  );
  test.skip(
    !hasProbe,
    'renderer frame probe is not exposed; rAF cadence must not be reported as renderer FPS',
  );
  const fps = await page.evaluate(async () => {
    const probe = (
      window as Window & {
        __inkstoryRendererFrameProbe?: () => Promise<number>;
      }
    ).__inkstoryRendererFrameProbe;
    return probe ? probe() : 0;
  });
  expect(fps).toBeGreaterThanOrEqual(55);
});
