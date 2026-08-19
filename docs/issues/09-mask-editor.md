# Title

Mask editor UI (wizard `mask` step) and cutout texture output

## Summary

Build the mask review/repair step: show the auto mask over the drawing, provide brush
add/erase with undo/redo and zoom/pan, re-run auto with a sensitivity slider, and emit
the final cutout texture + rigType chooser handoff.

## Context

Auto-segmentation is a prefill, never a gate (ADR-002 #3). This screen is where "the
character looks exactly like the drawing" is guaranteed — the cutout produced here is
the character's texture forever (DESIGN §5.3).

## Scope

`src/vision/maskEditor/` (canvas component, tools, history), wizard `mask` +
`rigType` steps UI, `toTexture()` output function.

## Detailed Requirements

1. On step entry: run worker `segment()` (issue 08) with a progress spinner; if
   `ok=false`, show the localized "couldn't find the drawing" hint and open with an
   empty mask and the brush pre-selected (DESIGN §5.2 failure rule).
2. Rendering: drawing at full opacity; mask as 50% tinted overlay + animated
   marching-ants outline; live preview toggle ("see cutout") that shows the cutout on a
   checkerboard.
3. Tools: brush **add** / **erase**, sizes S/M/L (relative to zoom), pointer +
   touch + pen; pan/zoom via two-finger gesture and wheel; all edits go through an
   undo/redo stack ≥20 entries (command pattern over mask diffs, memory-bounded).
4. "Re-run auto" button with sensitivity slider (maps to issue-08 `sensitivity`);
   re-running replaces the mask but is itself undoable.
5. `toTexture(drawing, mask) → {texturePng: Blob, bbox, maskPng: Blob}`:
   cutout = drawing×mask alpha, cropped to mask bbox + 8 px padding (DESIGN §5.3);
   longest edge ≤1024 px for the texture (rescale mask consistently).
6. `rigType` step: two localized cards — "うごく からだ が ある（ひとがた）" (humanoid)
   vs "そのまま うごかす" (cutout) with example thumbnails; default = humanoid
   preselected only when issue 11's pose probe reports confident keypoints, else no
   default (explicit choice). Works fully without the model.
7. Draft carries: mask, texture, bbox, rigType → next step (`joints` or `preview`).

## Acceptance Criteria

- Component tests: brush stroke changes mask; undo/redo restores exact buffers;
  re-run-auto is undoable; `toTexture` bbox/padding/alpha verified on fixtures.
- The full step is operable with touch only; brush cursor honors zoom level.
- Cutout preview shows no background pixels on the 6 fixtures (visual check recorded).
- With the pose model absent, the step completes and `rigType` requires an explicit
  choice.

## Validation

`pnpm test src/vision/maskEditor`; manual pass on tablet (touch) attached to PR;
memory check: editing a 2048² mask for 100 strokes keeps heap growth <150 MB
(Chrome performance panel, noted in PR).

## Dependencies

08.

## Non-goals

Joint editing (12), texture filters/beautification (never — the drawing stays as-is),
multi-figure support (v2).

## Design References

DESIGN.md §5.1 (mask/rigType rows), §5.2, §5.3, §8.7; ADR-002 #3, #5.
