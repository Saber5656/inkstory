import {
  test as base,
  expect,
  type BrowserContext,
  type Request,
} from '@playwright/test';

export function observeNetwork(context: BrowserContext, origin: string) {
  const external: Array<{ url: string; serviceWorker: boolean }> = [];
  let workerRequests = 0;
  const observe = (request: Request) => {
    const url = new URL(request.url());
    const serviceWorker = request.serviceWorker() !== null;
    if (serviceWorker) workerRequests++;
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin)
      external.push({ url: url.href, serviceWorker });
  };
  context.on('request', observe);
  return {
    external,
    get workerRequests() {
      return workerRequests;
    },
    assertClean: () =>
      expect(
        external,
        'Cross-origin network requests are forbidden, including service-worker requests.',
      ).toEqual([]),
    stop: () => context.off('request', observe),
  };
}

export const test = base.extend<{ networkAudit: void }>({
  networkAudit: [
    async ({ context, baseURL }, use) => {
      const audit = observeNetwork(context, new URL(baseURL!).origin);
      await use();
      audit.stop();
      audit.assertClean();
    },
    { auto: true },
  ],
});
export { expect };
