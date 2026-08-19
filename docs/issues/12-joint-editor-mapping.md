# Title

Joint editor (wizard `joints` step): COCO-17→skeleton mapping, template pose, drag-pin UI

## Summary

Implement the guaranteed rigging path: map pose keypoints (when available) to the
16-joint skeleton, otherwise prefill a template pose, and let the user place/correct
all joints with draggable pins. Completes the wizard through `preview`.

## Context

ADR-004 makes this UI the product's floor: it must be fully usable with zero ML. The
mapping formulas come from upstream MIT source (docs/research/01). DESIGN §5.4–§5.5
define behavior; §6.1 fixes the skeleton.

## Scope

`src/domain/poseMapping.ts` (pure), `src/domain/templatePose.ts` (pure),
`src/rig/jointEditor/` (canvas UI), wizard `joints` + `preview` step integration.

## Detailed Requirements

1. `cocoToSkeleton(keypoints17, textureSize) → joints16`: port formulas from upstream
   `examples/image_to_annotations.py` (provenance comment required): neck = midpoint of
   shoulders; hip = midpoint of hips; root = hip offset slightly downward as per source;
   torso = midpoint(neck, hip); limbs map directly (shoulder/elbow/wrist→hand,
   hip/knee/ankle→foot). Table-driven unit tests with ≥3 keypoint fixtures.
2. `templatePose(maskBbox) → joints16` — fractions of the mask bbox (x measured from
   bbox left, y from top):
   neck (0.50, 0.18), torso (0.50, 0.38), hip (0.50, 0.55), root (0.50, 0.57),
   right_shoulder (0.35, 0.22), right_elbow (0.22, 0.35), right_hand (0.15, 0.50),
   left_shoulder (0.65, 0.22), left_elbow (0.78, 0.35), left_hand (0.85, 0.50),
   right_hip (0.42, 0.57), right_knee (0.40, 0.75), right_foot (0.39, 0.93),
   left_hip (0.58, 0.57), left_knee (0.60, 0.75), left_foot (0.61, 0.93).
   ("right_*" = character's right = viewer-left; keep upstream convention — document it
   in code and UI copy uses mirror-neutral labels with a small avatar hint.)
3. Joints step behavior: on entry run `estimatePose` (issue 11); if available AND mean
   confidence ≥0.3 → prefill from mapping, show subtle "auto" badge; else template
   prefill + hint toast "put the dots on the body" (DESIGN §5.4 low-confidence rule).
4. Pin UI: 16 pins (44 px hit target, magnifier loupe while dragging), bones drawn as
   lines per DESIGN §6.1 hierarchy; tap a list entry or pin to select; selected pin
   movable by drag or arrow keys; "reset to template" and "re-run auto" (if available)
   buttons; zoom/pan shared with mask editor component patterns (issue 09).
5. Non-blocking validation warnings (DESIGN §5.5): pin outside mask; left/right limb
   pins crossing over the torso line; warnings shown as pulsing outline + list, never
   preventing "next".
6. `preview` step: render a draft skeleton overlay using the current joint annotations.
   When issue 15 is available and a full `CharacterRig` exists, the same interface can
   render the bundled `wave` clip; until issue 13 builds the full rig, this issue keeps
   humanoid joints in wizard draft state only. The wizard `saved` step must not persist a
   partial joints object into `Character.rig`; it either stays draft-only for humanoids
   until issue 13, or persists a schema-valid cutout Character with `rig:null` for the
   cutout path. Thumbnail: 256 px cutout PNG.
7. All strings i18n; step fully touch-operable.

## Acceptance Criteria

- Mapping fixtures reproduce upstream-derived expected joints (±1 px).
- With pose unavailable (mock), the step opens with the exact template table above.
- Dragging each pin updates the draft; no test persists partial humanoid joints as
  `Character.rig`. Any saved Character written by this issue is schema-valid and readable
  back via repos (integration test with fake-indexeddb).
- Warnings trigger on planted fixture cases and never block progression.
- Wizard completes capture→preview for the humanoid draft path without persisting partial
  joints, and capture→saved for the cutout path (cutout skips joints) in a component-level
  integration test.

## Validation

`pnpm test src/domain src/rig/jointEditor`; manual tablet run-through of both paths
attached to PR (photos of steps).

## Dependencies

04, 09 (soft: 11 — must function without it).

## Non-goals

Mesh/weights (13), motion playback quality (15), pose model itself (10/11).

## Design References

DESIGN.md §5.1, §5.4, §5.5, §6.1, §8.7; ADR-004; docs/research/01 (skeleton table).
