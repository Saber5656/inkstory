import { createServer, type Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { observeNetwork } from './privacyFixture';

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test server address');
  return `http://127.0.0.1:${address.port}`;
}

// A controlled local second origin makes the guard self-test independent of DNS,
// the public Internet, and production CSP (which would block the planted request first).
test('privacy observer rejects a planted image and a service-worker fetch', async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Service-worker network events are exposed by Chromium.',
  );
  const externalServer = createServer((_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end('probe');
  });
  const appServer = createServer((req, res) => {
    if (req.url === '/probe-sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(
        "self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));",
      );
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(
        '<!doctype html><html lang="en"><title>Network observer self-test</title><body>Local probe</body></html>',
      );
    }
  });
  const external = await listen(externalServer);
  const origin = await listen(appServer);
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const audit = observeNetwork(context, origin);
  try {
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/probe-sw.js');
      await navigator.serviceWorker.ready;
    });
    const worker = context.serviceWorkers()[0]!;
    await worker.evaluate(async (url) => {
      await fetch(`${url}/from-worker`);
    }, external);
    await page.evaluate(async (url) => {
      const image = new Image();
      await new Promise<void>((resolve) => {
        image.onload = image.onerror = () => resolve();
        image.src = `${url}/from-image`;
      });
    }, external);
    await expect.poll(() => audit.external.length).toBe(2);
    expect(audit.external).toEqual(
      expect.arrayContaining([
        { url: `${external}/from-worker`, serviceWorker: true },
        { url: `${external}/from-image`, serviceWorker: false },
      ]),
    );
    expect(() => audit.assertClean()).toThrow();
  } finally {
    audit.stop();
    await context.close();
    await Promise.all(
      [appServer, externalServer].map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
    );
  }
});
