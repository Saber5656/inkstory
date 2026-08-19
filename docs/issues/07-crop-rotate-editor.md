# Title

Crop & rotate editor step (wizard `crop`)

## Summary

Implement the `crop` wizard step: rectangular crop with rotate controls so the user
isolates the drawing region before segmentation. Replaces the upstream ML figure
detector in v1 (ADR-002 #2).

## Context

Upstream AnimatedDrawings crops via a detection model; inkstory v1 substitutes a manual
step (DESIGN §5.1). A tight crop is the main lever for segmentation quality on busy
photos (DESIGN §13).

## Scope

`src/capture/crop/`: crop math (pure), CropEditor component wired into the wizard
between `capture` and `mask`.

## Detailed Requirements

1. UI: image fills the work area; draggable/resizable crop rectangle with 8 handles;
   rule-of-thirds grid inside the rect; pinch/wheel zoom + pan of the underlying image.
2. Rotation: 90° left/right buttons + fine-rotation slider ±15° (0.5° steps). Rotation
   applies before crop; the crop rect stays axis-aligned in view space.
3. Defaults: initial crop = 90% centered; minimum crop size 128×128 source pixels.
4. Output: `applyCrop(bitmap, {rect, rotationDeg}) → ImageBitmap` — pure function,
   canvas-based, output longest edge re-clamped to ≤2048 px.
5. Touch-first interactions (48 px handle hit areas, DESIGN §8.7) and keyboard nudging
   (arrows move rect 1px/10px with shift) for a11y.
6. Localized helper text: "draw a box around your character" (i18n keys ja/en).
7. State machine integration: `crop` accepts back→`capture` (re-pick keeps nothing) and
   next→`mask` carrying the cropped bitmap in the draft.

## Acceptance Criteria

- Unit tests for crop math: rect+rotation combinations produce expected output
  dimensions and pixel content (corner-probe fixtures at 0°, 90°, +7.5°).
- Min-size and bounds clamping enforced (rect can't leave the image or invert).
- Manual: full step usable with touch only (Android/iOS) and with keyboard only.

## Validation

`pnpm test src/capture/crop`; manual touch pass recorded in PR (screen recording or
step list). Component test drives handle drag via Testing Library pointer events.

## Dependencies

06.

## Non-goals

Perspective/quad correction (v2 idea), auto-detection (none in v1), contrast
adjustments (segmentation handles this — 08).

## Design References

DESIGN.md §5.1 (crop row), §8.7, §13; ADR-002 #2.
