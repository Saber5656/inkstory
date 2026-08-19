# Title

Auto-segmentation worker: TypeScript port of AnimatedDrawings `segment()`

## Summary

Port the upstream classical-CV mask extraction to a pure TypeScript function running in
`vision.worker`, with fixtures and quality gates. No ML involved.

## Context

DESIGN §5.2 fixes the algorithm (verified upstream in docs/research/01): adaptive
threshold → morphology → edge flood-fill → largest component → hole fill. It must run
off-main-thread within the §9.4 budget (≤2 s @2048²).

## Scope

`src/vision/segment.ts` (pure, typed-array based), `src/vision/vision.worker.ts`
(comlink-free postMessage protocol), `src/vision/morphology.ts` helpers, fixture-based
unit tests. UI integration happens in issue 09.

## Detailed Requirements

1. `segment(img: ImageData, opts?: {sensitivity?: number}): SegmentResult` where
   `SegmentResult = { mask: Uint8Array /* w*h, 0|255 */, coverage: number, ok: boolean }`.
2. Steps, in order (port faithfully from upstream `examples/image_to_annotations.py`
   (MIT), keeping a provenance comment with the upstream path/commit):
   a. grayscale = min(R,G,B) per pixel;
   b. adaptive Gaussian threshold (binary inverse) — implement the Gaussian-weighted
      local mean with separable/sliding kernels using the upstream block size and C
      constant; expose C offset scaled by `sensitivity ∈ [0,1]` (default mid) for issue
      09's slider. Do not use an integral-image box-sum approximation for this Gaussian
      path; if profiling proves Gaussian cannot meet the budget, file a follow-up design
      decision before intentionally switching to adaptive mean thresholding;
   c. morphological close ×2 then dilate ×2 with 3×3 rect kernel;
   d. flood fill background from 10 evenly spaced seeds per edge (BFS on the binary
      image); anything reached is background;
   e. connected-component labeling → keep the largest foreground component;
   f. fill interior holes (invert-flood from outside, holes = unreached background).
3. All buffers preallocated typed arrays; no per-pixel object allocation; must process
   2048×2048 within 2 s on a 2020 mid-range phone (§9.4) — CI asserts ≤1 s on the CI
   runner as a proxy.
4. `ok=false` when the largest component covers <2% or >98% of pixels (DESIGN §5.2
   failure rule) — the caller decides UX.
5. Worker protocol: request `{id, imageData, opts}` / response `{id, result}` with
   transferable buffers both ways; single in-flight job, later requests supersede
   (cancellation by generation counter).
6. Fixtures: ≥6 project-created photos (DESIGN §12) with hand-authored golden masks
   (PNG). Metric: IoU(auto, golden) ≥0.9 on ≥4 of 6 fixtures; the two allowed misses
   must still produce `ok=true` plausible masks (eyeballed goldens with lower bound
   IoU ≥0.6).

## Acceptance Criteria

- Fixture IoU thresholds above met; failure rule triggers on an all-white and an
  all-scribble fixture.
- Worker round-trip test (jsdom + worker shim or vitest browser mode) returns a mask
  for a small fixture and honors supersession.
- Perf assertion in CI (≤1 s @2048² on runner) passes.
- No usage of OffscreenCanvas 2D APIs inside `segment()` itself (pure typed arrays) —
  keeps it testable in Node.

## Validation

`pnpm test src/vision`; a `tools/dev/segment-preview.html` dev harness (plain page
loading the worker) for manual eyeballing of the 6 fixtures — screenshots in PR.

## Dependencies

04, 06 (fixtures pipeline & bitmap source).

## Non-goals

Mask editing UI (09), ML segmentation (none in v1), sensitivity slider UI (09).

## Design References

DESIGN.md §5.2, §9.4, §12; docs/research/01 (algorithm provenance); ADR-002.
