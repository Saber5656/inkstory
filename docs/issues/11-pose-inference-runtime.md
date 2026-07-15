# Title

Pose inference runtime: model loader with hash verification, EP ladder, pose worker

## Summary

Integrate onnxruntime-web behind a small typed API: fetch the model with progress and
Cache Storage caching, verify sha256 before use, create the session on the best
available execution provider, run inference in a worker, decode heatmaps to 17
keypoints.

## Context

ADR-004 fixes the runtime and the fallback ladder; DESIGN §10.3 (B5) requires integrity
verification of the model asset; docs/research/02 documents EP availability and CSP
constraints. Consumes issue 10's manifest — including its `status:"unavailable"` mode.

## Scope

`src/pose/`: `modelLoader.ts`, `pose.worker.ts`, `inference.ts` (pre/post-processing),
`probe.ts` (capability report for diagnostics), unit tests with a tiny stub ONNX model.

## Detailed Requirements

1. `modelLoader`: read the app-bundled, review-anchored model manifest generated from
   issue 10's output (zod-validated, issue 04 pattern). The expected hash must ship with
   the reviewed app build, not be fetched from the same mutable `/models` area as the
   ONNX asset. If `status:"unavailable"` → resolve to `{available:false}` without
   network noise. Otherwise fetch `/models/<file>` with streamed progress callbacks,
   store response in Cache Storage bucket `models-v1`, and on every load verify sha256
   via `crypto.subtle.digest` against the app-bundled manifest **before** session
   creation; mismatch → purge cache entry, one retry, then
   `{available:false, reason:'integrity'}`.
2. EP selection: try `webgpu`, fall back to `wasm`; set
   `numThreads = crossOriginIsolated ? min(4, hardwareConcurrency-1) : 1`
   (docs/research/02). Record chosen EP + timings in `probe.ts` for the diagnostics
   screen (issue 23).
3. `pose.worker.ts`: owns the ORT session; message protocol mirrors issue 08 (id,
   transferables, supersession). Main-thread facade `estimatePose(texture: ImageBitmap)
   → PoseResult { keypoints: {name, x, y, confidence}[17] } | {available:false}`.
4. `inference.ts`: letterbox resize to manifest input dims, normalization per manifest,
   heatmap argmax decode with sub-pixel refinement (parabolic offset), coordinates
   mapped back to texture space. Pure and unit-tested against a stub model with known
   synthetic heatmaps.
5. Wizard integration point (consumed in issue 12): pose runs once when entering
   `joints` (humanoid) or on the `rigType` probe (issue 09 §6), never per frame; UI
   never blocks on it (spinner with "skip" always visible).
6. All failure classes (no manifest, fetch error, integrity, session error, inference
   throw) collapse to `{available:false, reason}` — no user-facing error dialog; the
   template-pose path proceeds (ADR-004 #4).

## Acceptance Criteria

- With the stub model: end-to-end `estimatePose` returns 17 named keypoints in texture
  coordinates matching the synthetic heatmap peaks (±0.5 px).
- Tampering with the cached model bytes (test hook) triggers purge+retry then
  unavailable-with-integrity-reason; a passing hash never re-downloads on second load
  (network mocked).
- With the app-bundled manifest `status:"unavailable"`, no model fetch happens and the
  wizard's joints step still functions (template pose — verified in issue 12's tests).
- A test or build-time assertion proves the trusted hash manifest is imported from the
  app bundle/reviewed source, not fetched from `/models` at runtime.
- EP/threads selection logic unit-tested via injected fake capabilities.

## Validation

`pnpm test src/pose`; manual: diagnostics screen shows EP + load time on a WebGPU
browser and a wasm-only browser (numbers in PR).

## Dependencies

03, 10 (manifest contract; can develop against the stub + manifest fixture before 10
lands).

## Non-goals

Joint mapping/editor (12), figure detection, batch inference, WebNN.

## Design References

DESIGN.md §5.4, §9.3, §10.3 (B5); ADR-004; docs/research/02.
