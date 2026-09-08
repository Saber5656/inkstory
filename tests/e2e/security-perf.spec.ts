import type { Character } from '../../src/domain/types';
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

for (const effectCount of [0, 3]) {
  test(`renderer hardware GPU budget with ${effectCount} effects`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      browserName !== 'chromium',
      'Hardware renderer budget runs on Chromium.',
    );
    await page.goto('/');
    const character = page.locator('a.art[href*="/characters/"]').first();
    await expect(character).toBeVisible();
    const characterId = (await character.getAttribute('href'))!
      .split('/')
      .pop()!;
    const vertexCount = await page.evaluate(
      (id) =>
        new Promise<number>((resolve, reject) => {
          const request = indexedDB.open('inkstory');
          request.onerror = () =>
            reject(request.error ?? new Error('Database open failed'));
          request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction('characters', 'readwrite');
            const store = transaction.objectStore('characters');
            const row = store.get(id);
            row.onsuccess = () => {
              const character = row.result as Character;
              const rig = character.rig!;
              const source = rig.mesh.vertices;
              const xs = source.filter((_, index) => index % 2 === 0);
              const ys = source.filter((_, index) => index % 2 === 1);
              const minX = Math.min(...xs),
                maxX = Math.max(...xs);
              const minY = Math.min(...ys),
                maxY = Math.max(...ys);
              const vertices: number[] = [],
                uvs: number[] = [],
                triangles: number[] = [];
              const weights: typeof rig.weights = [];
              // A deterministic 60 x 50 dense grid exercises the schema's 3000-vertex limit.
              for (let y = 0; y < 50; y++)
                for (let x = 0; x < 60; x++) {
                  const vx = minX + ((maxX - minX) * x) / 59;
                  const vy = minY + ((maxY - minY) * y) / 49;
                  let nearest = 0,
                    distance = Infinity;
                  for (let i = 0; i < xs.length; i++) {
                    const squared = (xs[i]! - vx) ** 2 + (ys[i]! - vy) ** 2;
                    if (squared < distance) {
                      nearest = i;
                      distance = squared;
                    }
                  }
                  vertices.push(vx, vy);
                  uvs.push(x / 59, y / 49);
                  weights.push(rig.weights[nearest]!);
                  if (x < 59 && y < 49) {
                    const a = y * 60 + x;
                    triangles.push(a, a + 1, a + 60, a + 1, a + 61, a + 60);
                  }
                }
              store.put({
                ...character,
                rig: { ...rig, mesh: { vertices, uvs, triangles }, weights },
              });
            };
            transaction.oncomplete = () => {
              database.close();
              resolve(3000);
            };
            transaction.onerror = () => {
              database.close();
              reject(
                transaction.error ?? new Error('Fixture transaction failed'),
              );
            };
          };
        }),
      characterId,
    );
    expect(vertexCount).toBe(3000);
    await character.click();
    const canvas = page.locator('.stage-surface canvas');
    await expect(canvas).toBeVisible();
    const hasProbe = await page.evaluate(
      () => typeof window.__inkstoryRendererFrameProbe === 'function',
    );
    if (process.env.CI)
      expect(hasProbe, 'CI must build with VITE_PERF_TEST=1').toBe(true);
    test.skip(
      !hasProbe,
      'Build with VITE_PERF_TEST=1 to measure completed renderer frames.',
    );
    if (effectCount) {
      const effects = page
        .locator('.controls .pick-grid')
        .nth(1)
        .getByRole('button');
      for (let index = 4; index < 7; index++) await effects.nth(index).click();
      await expect(
        page
          .locator('.controls .pick-grid')
          .nth(1)
          .locator('[aria-pressed="true"]'),
      ).toHaveCount(3);
    }
    await page.waitForTimeout(1500);
    const backend = await canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement;
      const gl = target.getContext('webgl2') ?? target.getContext('webgl');
      if (!gl) return 'unknown';
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return String(
        gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      );
    });
    const fps = await page.evaluate(() =>
      window.__inkstoryRendererFrameProbe!(),
    );
    await testInfo.attach('renderer-performance', {
      body: JSON.stringify({
        backend,
        fps,
        effectCount,
        vertexCount,
        budget: 55,
      }),
      contentType: 'application/json',
    });
    expect(
      fps,
      'Renderer must complete frames even on a software GPU.',
    ).toBeGreaterThan(0);
    test.skip(
      /SwiftShader|llvmpipe|softpipe|software|unknown/i.test(backend),
      `Hardware budget unverified on ${backend}; measured ${fps.toFixed(2)} FPS.`,
    );
    expect(fps).toBeGreaterThanOrEqual(55);
  });
}
