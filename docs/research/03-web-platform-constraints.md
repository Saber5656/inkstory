# Research: Web platform constraints (camera, audio, storage, PWA)

Date: 2026-07-08
Status: verified via WebKit release notes and current PWA platform guides

## Camera capture (drawing acquisition)

- `getUserMedia` works in Safari/Chrome/Firefox; iOS has a history of bugs specifically
  in **standalone (installed PWA) mode** (WebKit bug 185448 and follow-ups) and repeated
  permission prompts inside PWAs are still reported in 2025/2026 threads.
- `<input type="file" accept="image/*" capture="environment">` opens the native camera on
  iOS/Android with no permission-persistence issues and returns a photo file.
- **Design rule:** file-input capture is the primary, always-available path; live
  `getUserMedia` preview is a progressive enhancement. EXIF orientation must be
  normalized on import (photos arrive rotated); re-encode strips EXIF (incl. GPS).

## Audio narration recording

- `MediaRecorder` is supported in Safari since 14.3+; Safari 26 adds ALAC/PCM options.
- Codec output differs by browser: Safari produces `audio/mp4` (AAC); Chromium/Firefox
  produce `audio/webm` (Opus). Both play back via `<audio>`/`blob:` URLs in the browser
  that recorded them, but **cross-browser playback of exported bundles is not guaranteed**
  (webm/opus does not play on older Safari). v1 rule: store whatever the recorder
  produces + record `mimeType`; playback uses the same engine; the export format keeps
  the original container and documents the limitation. Transcoding is out of scope for v1.

## Storage

- IndexedDB stores `Blob`s in all modern browsers; OPFS exists but adds little for
  inkstory's access pattern → **IndexedDB (via Dexie) is the single store**.
- **iOS eviction risk:** Safari may evict site data after ~7 days of non-use for
  non-installed sites, and PWA storage quotas on iOS are conservative (guides in 2026
  still cite ~50 MB Cache Storage for PWAs and aggressive eviction).
  Mitigations (all in v1):
  1. call `navigator.storage.persist()` and surface the result,
  2. promote installing the PWA (installed-app storage is more durable),
  3. first-class **export to `.inkstory` file** as the user-controlled backup,
  4. show storage usage (`navigator.storage.estimate()`) in settings.
- Quota errors (`QuotaExceededError`) must be caught at every write site and routed to a
  single "storage full" dialog that offers export + cleanup.

## PWA / offline

- `vite-plugin-pwa` (Workbox) precaches the app shell; ML models are runtime-cached in a
  separate versioned cache (they are too large for precache-on-install UX; cache on first
  successful load with progress UI).
- iOS installs via Share→Add to Home Screen (no `beforeinstallprompt`); provide manual
  instructions per platform.
- Service-worker update flow: show "new version available" toast; never auto-reload
  during book playback or an unsaved editing session.
- Screen Wake Lock API keeps the screen on during book playback (supported in modern
  Chrome/Safari); feature-detect and degrade silently.

## Rendering

- PixiJS v8 renders via WebGPU with automatic WebGL fallback — matches the ORT-web
  progressive-enhancement story. Mesh with per-vertex positions updated per frame (CPU
  LBS at ≤ ~3k vertices, 16 bones) is well within 60 fps budgets on 2020-class phones;
  perf budget enforced by issue 15 acceptance criteria.

## Hosting header matrix (for the self-hosting guide)

| Header | Purpose | GH Pages | CF Pages/Netlify | self-host |
|---|---|---|---|---|
| COOP/COEP | wasm threads | via coi-serviceworker | `_headers` | server config |
| CSP | XSS defense-in-depth | `<meta http-equiv>` fallback | header | header |
| HTTPS | required for camera/mic/SW | ✔ | ✔ | operator duty (documented) |

Sources: webkit.org Safari 26 beta notes; WebKit MediaRecorder blog; WebKit bug 185448;
magicbell.com "PWA iOS Limitations and Safari Support [2026]"; GitHub community
discussion #13309; gzuidhof/coi-serviceworker README; onnxruntime.ai web docs.
