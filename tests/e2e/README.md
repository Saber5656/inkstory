# Browser validation

Build with `VITE_PERF_TEST=1 pnpm build`, then run `pnpm test:e2e`. The preview server emulates production CSP/COOP/COEP headers. Chromium and WebKit use fresh profiles. Capture and headerless subpath/COI tests have separate configurations (`pnpm test:capture`, `pnpm test:hosting`).

The default worker count is one so rendering measurements do not compete with another browser. CI permits one retry. A test requiring that retry twice within one week must be investigated and tracked as a flaky-test issue; additional retries are not a substitute for a fix. The JSON report records skipped cases and evidence attachments, while the list reporter exposes progress before the job timeout.

## Rendering

The stage sweep covers each of ten motions on a plain background and each of twelve backgrounds at phone, tablet, and desktop widths in both engines. The plain-background screenshots must contain the sample character's red shirt, so an initialized but blank canvas cannot pass.

The performance test inserts a deterministic 3000-vertex fixture in its isolated profile. It measures completed Pixi `postrender` callbacks for five seconds, with zero and three simultaneous effects. The budget is 55 FPS. It does not substitute `requestAnimationFrame` frequency for rendered frames or sum frames from several canvases.

Headless Chromium commonly selects SwiftShader, a CPU rasterizer, even on a GPU-equipped machine. The test records the renderer identity and measured FPS, checks that frames complete, then explicitly skips the **hardware budget** when only a software renderer is available. A green software-only CI run is not evidence that the hardware budget passed. WebKit does not run this Chromium-specific budget. On an Apple Silicon Mac, explicitly opt into the Metal backend:

```sh
VITE_PERF_TEST=1 pnpm build
INKSTORY_GPU=metal pnpm exec playwright test tests/e2e/security-perf.spec.ts --grep 'renderer hardware' --project chromium
```

This environment qualification is a departure from the original issue's assumption that the hosted Chromium runner has representative GPU performance. Physical iOS/Android performance remains a separate release check.

## Other explicit gaps

- Linux WebKit builds without `MediaRecorder` explicitly mark the recording scenario `fixme`; a separate forced-unavailable test verifies that the explanation and text-story path work. macOS WebKit passes the recording scenario.
- Synthetic Web Audio streams exercise real MediaRecorder encoding, IndexedDB persistence, reload playback, replacement, deletion, and track cleanup in both browsers. Physical microphone permission prompts, indicators, and actual recorded speech are not covered.
- The 200 MiB import measurement is opt-in (`RUN_LARGE_IMPORT_PERF=1`); the ordinary CI corpus tests all checked-in malformed bundles.
- The optional pose model is unavailable in the checked-in manifest. Golden paths exercise template joints; they do not claim real model inference.
- Device installation, OS storage eviction, wake lock, screen readers, and live-host headers require the release checklist.
