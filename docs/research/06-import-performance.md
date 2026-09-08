# Import performance measurement

Date: 2026-09-08  
Environment: local Chromium through the root integration production server at `http://127.0.0.1:4173`  
Purpose: issue 23's 200 MiB synthetic bundle responsiveness acceptance

## Fixture and validity

`tools/generate-large-import.mjs` produced `/tmp/inkstory-200mb.inkstory` with the following measured sizes:

| Property | Value |
|---|---:|
| ZIP archive bytes | 209,720,307 bytes |
| Uncompressed entry bytes | 209,715,200 bytes (200 MiB) |
| Pages | 10 |
| Audio entries | 10 × 20 MiB |
| Largest entry | 20 MiB |
| Entry count | 12 (manifest, book, and 10 audio entries) |

The archive uses a valid `formatVersion: 1` manifest and book/page schema, allowed UUID paths, `audio/ogg` MIME, and low compression (`level: 0`) so its declared compression ratio stays near 1:1. Each audio entry begins with `OggS` to satisfy the importer's container check and remains below the 20 MiB audio cap. The rest is deterministic pseudo-random bytes; it is synthetic payload, not playable narration and does not represent real audio decode performance. There are no image entries, so this result does not measure image decode or canvas re-encode cost.

## Browser result

The optional test `tests/e2e/large-import.spec.ts` runs only when `RUN_LARGE_IMPORT_PERF=1` and only under Chromium. It uploads the bundle through the real Settings import input, waits for the worker-backed import preview, and records Worker progress messages, a 50 ms main-thread heartbeat, and Chromium CDP `JSHeapUsedSize` before/after preview.

Observed run:

| Metric | Result |
|---|---:|
| Preview result | passed; title `Synthetic 200 MiB import` visible |
| Import to preview | 406 ms |
| Worker progress messages | 12 |
| Heartbeat count | 7 |
| Maximum heartbeat gap | 105.7 ms |
| JS heap before / after | 2,582,184 / 4,343,296 bytes |
| JS heap delta | 1,761,112 bytes |

Command used from this worktree while the already-running root integration server remained at 4173 (an ephemeral Playwright config in this worktree supplied the base URL; no file was added to the root worktree):

```sh
RUN_LARGE_IMPORT_PERF=1 \
INKSTORY_LARGE_IMPORT_FIXTURE=/tmp/inkstory-200mb.inkstory \
pnpm exec playwright test tests/e2e/large-import.spec.ts \
  --config playwright.large-import.config.ts --project=chromium --workers=1
```

Result: one Chromium test passed. The test treats a heartbeat gap under 2,000 ms and at least one progress event as the local responsiveness gate. The measured run was well below that gap, and the preview was reached without a main-thread stall visible to the probe.

## Limits of this evidence

This is a local Chromium result against the current root integration checkout. It is not a CI, Safari/WebKit, low-memory device, or production deployment result. CDP `JSHeapUsedSize` excludes some browser-managed and external memory, including all costs that may be held outside the JavaScript heap. The Settings UI currently does not render progress percentage; the test observes progress messages from the import worker. The fixture's audio bytes are magic-valid synthetic data, so no claim is made about audio playback or media decoder behavior. Repeat the test after changes to exchange worker, storage commit, or browser support.
