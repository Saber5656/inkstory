# Title

Image acquisition step: camera/file input with metadata-stripping re-encode

## Summary

Implement the wizard `capture` step: obtain a photo of the drawing via file picker or
camera, normalize orientation, strip all metadata by re-encoding, downscale, and hand a
clean bitmap to the wizard. This step is a privacy control (ADR-005 #2).

## Context

Photos carry EXIF (including GPS) and arrive rotated. DESIGN §5.1 (capture row) and
§10.3 (rows B1/B2) define the required behavior. File-input is the guaranteed path;
live camera preview is progressive enhancement (docs/research/03).

## Scope

`src/capture/`: `acquire.ts` (file/camera intake), `reencode.ts` (pure normalize
function), capture step UI in the wizard route; wizard scaffolding state machine
(`src/app/wizard/machine.ts`) with states from DESIGN §5.1 and placeholder screens for
later steps.

## Detailed Requirements

1. Wizard state machine exactly per DESIGN §5.1 (`capture → crop → mask → rigType →
   joints → preview → saved`; joints skipped for cutout; back allowed; leave-confirm
   discards the in-memory draft). Implemented as a plain typed reducer (no xstate dep).
2. Primary intake: `<input type="file" accept="image/*" capture="environment">` styled
   as two large buttons ("写真をとる" / "しゃしんをえらぶ" – via i18n keys).
3. Enhancement intake: `getUserMedia` live preview modal with shutter, behind feature
   detection AND a runtime probe; any failure silently falls back to file input
   (no error dialog). Streams stopped (`track.stop()`) on close/step exit (DESIGN §10.3
   B1).
4. `reencode(file: Blob): Promise<{bitmap: ImageBitmap, width, height, png: Blob}>`:
   decode via `createImageBitmap` with `imageOrientation: 'from-image'` (EXIF applied),
   downscale longest edge to ≤2048 px (bicubic via canvas draw), re-encode to PNG **in
   memory**, and return the sanitized PNG bytes as `png`; the original File object is
   never stored or referenced afterwards.
   Reject: files >40 MiB, decoded dimensions >8192 px, non-image MIME — each with a
   localized, kid-polite error message key.
5. The re-encoded image is wizard draft state only (memory) as `{bitmap, png}`; persistence
   happens at `saved` by storing the returned sanitized `png` blob, never the original
   file (issue 13 wires final save; this issue saves Drawing + blob when the wizard
   reaches `saved` in the temporary flow used for testing).
6. Unit tests for `reencode`: fixture JPEG with EXIF orientation 6 + GPS → output `png`
   has correct pixel orientation (probe corner pixels) and zero metadata (parse output
   bytes: no `eXIf` chunk, no EXIF marker).

## Acceptance Criteria

- Selecting a rotated GPS-tagged JPEG fixture yields an upright preview and the stored
  bytes contain no EXIF/GPS (automated test).
- Oversized/corrupt files show the localized error and leave the wizard usable.
- Camera path: on a browser with camera (manual check), preview → shutter → same
  pipeline; closing the modal stops the camera indicator.
- Back/leave from `capture` discards the draft after confirm.

## Validation

`pnpm test src/capture` (fixtures under `tests/fixtures/exif/`); manual camera check on
Android Chrome + iOS Safari recorded in the PR description (per docs/research/03 §camera).

## Dependencies

03, 05.

## Non-goals

Crop UI (07), segmentation (08), storing originals (never — ADR-005).

## Design References

DESIGN.md §5.1, §10.3 (B1/B2), §8.7; ADR-005; docs/research/03.
