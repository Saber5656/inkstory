/// <reference lib="webworker" />
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  matchPrecache,
} from 'workbox-precaching';
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
// One service worker owns both offline caching and optional COI response headers.
const manifest = self.__WB_MANIFEST;
const coiVersion =
  manifest.reduce(
    (hash, entry) =>
      [...JSON.stringify(entry)].reduce(
        (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
        hash,
      ),
    2166136261,
  ) >>> 0;
const coiCache = `inkstory-coi-${coiVersion}`;
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('inkstory-coi-') && key !== coiCache,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
cleanupOutdatedCaches();
if (import.meta.env.VITE_COI !== 'sw') precacheAndRoute(manifest);
else {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(coiCache)
        .then((cache) =>
          cache.addAll([
            ...new Set(
              manifest.map((entry) =>
                typeof entry === 'string' ? entry : entry.url,
              ),
            ),
          ]),
        ),
    );
  });
}
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING')
    void self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET')
    return;
  if (import.meta.env.VITE_COI === 'sw') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(coiCache);
        const response =
          (await cache.match(event.request)) ||
          (event.request.mode === 'navigate'
            ? await cache.match(
                new URL('index.html', self.registration.scope).href,
              )
            : undefined) ||
          (await fetch(event.request));
        if (response.status === 0) return response;
        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })(),
    );
  } else if (event.request.mode === 'navigate')
    event.respondWith(
      fetch(event.request).catch(
        async () => (await matchPrecache('index.html')) ?? Response.error(),
      ),
    );
});
