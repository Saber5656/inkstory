# Vision and rig validation fixtures

Date: 2026-09-08
Status: reproducible fixture validation complete; real-camera and visual device acceptance pending

## Purpose

The original vision unit used a small synthetic rectangle. That proves array plumbing,
but it does not exercise the drawing segmentation acceptance described in issue 08.
This validation set adds six project-created, photo-like PNG inputs and binary golden
annotations: four humanoids (faint pencil, colored, shadowed, and non-ideal) and two
nonhumanoids (cat and rocket). They are generated without personal or external media by
`tools/generate-vision-fixtures.mjs`.

Each source has a warm-paper gradient and deterministic low-amplitude noise. The golden
mask is a separate annotated silhouette with a two-pixel edge tolerance for the expected
morphological expansion. The test decodes the PNG and calls the production typed-array
`segment()` function; it does not call the generator or compare against a saved algorithm
output.

## Observed results

Command:

```text
pnpm vitest run tests/fixtures/vision/fixtures.test.ts
```

Observed on the local Node/Vitest runner:

| Fixture group | IoU threshold | Observed result |
| --- | ---: | --- |
| Four humanoids | ≥ 0.90 each | pencil 0.9356, colored 0.9356, shadow 0.9356, non-ideal 0.9421 |
| Two nonhumanoids | ≥ 0.60 each | cat 0.9619, rocket 0.9610 |
| All-white / full-black input | `ok=false` | pass |
| Four rig goldens | structural parity, normalized weights, <1 s | pass; CDT path on current fixture annotations |

The four rig builds measured approximately 35–75 ms each on this machine, with 499–720
vertices and 647–741 triangles. The one-second test budget is a CI proxy, not a phone
benchmark. The serialized JSON goldens are compared by counts and sampled values so float
serialization noise does not require byte identity.

## Reproduction and ownership

Regenerate only when the intended annotation changes:

```sh
node tools/generate-vision-fixtures.mjs
UPDATE_FIXTURES=1 pnpm vitest run tests/fixtures/vision/fixtures.test.ts
pnpm vitest run tests/fixtures/vision/fixtures.test.ts
```

The PNG decoder and fixture test live under `tests/fixtures/vision/`; rig goldens live under
`tests/fixtures/rigs/`. The source generator records dimensions and fixture classes in
`tests/fixtures/vision/manifest.json`.

## Limits and uncompleted acceptance

- These are synthetic photo-like images, not real camera captures. EXIF orientation,
  camera decoder behavior, lighting variation, and device color pipelines require the
  separate capture acceptance run.
- The two nonhumanoid IoU results are required to be plausible masks; they do not prove
  humanoid pose quality or rig suitability.
- Issue 09's touch brush, undo history, visual checkerboard, and six-fixture canvas review
  are not completed by this fixture commit.
- Issue 14's motion-library attribution, renderer screenshots, and visual deformation
  review remain separate. These fixtures prove only the rig structure/performance seam.
- Parent-provided `assets-src/samples/ink.svg` was used as a read-only reference boundary;
  no child or external personal media was copied.
