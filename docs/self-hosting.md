# Self-hosting inkstory

inkstory is a static Vite build. There is no application server, account service, upload endpoint, or required runtime database. The host serves `dist/`; each visitor's data remains in that origin's browser storage.

## Build and serve

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm check:build
pnpm preview
```

For a production host, publish the contents of `dist/` and configure SPA fallback to `index.html`. Use HTTPS. Browsers require a secure context for camera, microphone, service workers, and PWA installation; `http://localhost` is suitable for local development.

The current Vite build emits a meta CSP. `public/_headers` contains the equivalent deployment headers plus COOP/COEP. `VITE_COI=sw` is read by the service-worker build for the service-worker isolation path; `VITE_CSP` is not read by the current Vite config. Do not claim a selected variant until the emitted response and service-worker behavior have been inspected.

## Header matrix

| Header | Required value/purpose | Current source |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; same-origin scripts/connect; `wasm-unsafe-eval`; workers and `blob:` media; no objects/forms/frames | Vite meta CSP and `public/_headers` |
| `X-Content-Type-Options` | `nosniff` | `public/_headers` |
| `Referrer-Policy` | `no-referrer` | `public/_headers` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=()` | `public/_headers` |
| `Cross-Origin-Opener-Policy` | `same-origin` when enabling isolation | `public/_headers` |
| `Cross-Origin-Embedder-Policy` | `require-corp` when enabling isolation | `public/_headers` |
| `Cache-Control` | immutable only for content-hashed assets; revalidate `index.html` and service worker | host policy, not set by app |

Example nginx location:

```nginx
root /srv/inkstory/dist;
location / {
  try_files $uri $uri/ /index.html;
}
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy no-referrer always;
add_header Permissions-Policy "camera=(self), microphone=(self), geolocation=()" always;
```

Example Caddy:

```caddy
example.test {
  root * /srv/inkstory/dist
  try_files {path} /index.html
  header {
    Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    X-Content-Type-Options nosniff
    Referrer-Policy no-referrer
    Permissions-Policy "camera=(self), microphone=(self), geolocation=()"
  }
  file_server
}
```

For Cloudflare Pages or another static host, copy the checked-in `public/_headers` rules into that host's header configuration. Inspect the actual production response with browser DevTools or `curl -I`; a configuration file alone is not evidence.

## COI variants

1. **No isolation:** simplest and broadest compatibility. ORT-web uses single-thread WASM; features that need `crossOriginIsolated` must stay disabled.
2. **Header isolation:** send COOP `same-origin` and COEP `require-corp` from the host. This can enable threaded WASM where supported, but every subresource must satisfy the embedder policy. Verify `window.crossOriginIsolated` and camera/microphone behavior on target browsers.
3. **Service-worker isolation:** a COI service worker can add isolation to responses when server headers cannot be changed. This is a separate deployment experiment and must be tested for update, cache, and permission regressions.

The current repository includes the header rules for variant 2 and the PWA service-worker source. It does not provide a verified production run for either variant.

## Updates and storage

Use content-hashed assets, revalidate `index.html` and the service worker, and let the in-app update prompt be accepted after the user has saved or exported work. Never purge the site's IndexedDB as part of a static asset deploy. Ask users to export `.inkstory` backups; browser persistence can be evicted under device pressure even when the origin is HTTPS.

Before each release, run the [release checklist](ops/release-checklist.md), inspect CSP and cross-origin requests, and perform the manual browser/device matrix. A static HTTP 200 or a successful build does not prove camera, microphone, PWA, offline, or storage behavior.
