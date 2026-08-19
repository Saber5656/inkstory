# Title

Motion pipeline (BVH → motion JSON) and the v1 10-clip library with license audit

## Summary

Build the offline converter `tools/motion-pipeline/` that turns upstream BVH mocap into
inkstory's 2D motion JSON (DESIGN §6.2), produce the curated 10-clip v1 library with
localized names/keywords, and complete the per-clip license/attribution audit.

## Context

Upstream bundles BVH under `examples/bvh/{cmu1,fair1,rokoko}` in the MIT repo, but
per-source attribution needs auditing (docs/research/01; ISSUE_PLAN §8). The retarget
rule (orientation matching + FK with the character's own bone lengths) is fixed in
DESIGN §6.2 and is what keeps characters looking like the drawing (ADR-002).

## Scope

`tools/motion-pipeline/` (Node + TypeScript CLI), `public/motions/*.json`,
`public/motions/index.json` (catalog), `public/motions/CREDITS.md`.

## Detailed Requirements

1. CLI `pnpm motion:convert <in.bvh> --config <clip.yaml> --out public/motions/`:
   - parse BVH (hierarchy + channels);
   - map BVH joints → the 16-joint skeleton via a per-source mapping table in the clip
     config (CMU/Rokoko-Mixamo joint name tables committed as data files);
   - project joint world positions onto the config-specified 2D plane (default X-Y,
     per-clip override) per upstream approach;
   - compute per-frame **global bone angles** (deg) and clip `restAngles` from the
     first frame of the source's T-pose/rest reference (config-selectable frame);
   - root translation normalized to character-height units (source skeleton height
     measured at rest);
   - resample to 30 fps, trim/loop-window per config, write DESIGN §6.2 JSON.
2. Clip configs + outputs for the 10 v1 clips (DESIGN §6.3): idle_breathe, wave, walk,
   run, jump, dance_1, dance_2, spin, sit_down, cheer — each with `name`/`keywords` in
   ja and en (keywords: ≥5 ja, ≥5 en per clip; ja includes hiragana child-language
   variants, e.g. run → はしる/かける/ダッシュ).
3. Curation rule (ADR-003): per-frame joint-angle deltas from rest clamped to the
   configured max (default ±135°); clips exceeding it must be edited (config clamp)
   — keeps LBS artifacts acceptable.
4. Loopability: for `loop:true` clips, first/last frame angle difference ≤4° per bone
   (converter blends the last 10% toward frame 0; assert post-blend).
5. Validation step in the CLI: output must pass the issue-04 MotionClip schema; CLI
   exits non-zero otherwise. `index.json` lists `{id, file, category, sha256}` and is
   also schema-validated.
6. **License audit**: for each source BVH record origin (cmu1/fair1/rokoko), the
   license/terms conclusion with citation, and required attribution text in
   `public/motions/CREDITS.md`. Any clip whose provenance cannot be established to be
   redistributable is **excluded** and replaced (pick another upstream clip); the audit
   table is part of this issue's deliverable.
7. Determinism: same inputs → byte-identical outputs (stable float formatting, fixed
   precision 4 decimals).

## Acceptance Criteria

- `pnpm motion:convert:all` regenerates the library reproducibly from vendored BVH
  inputs (vendoring path documented; upstream is archived — record source commit).
- All 10 clips schema-valid, loop rule and clamp rule asserted by converter tests.
- CREDITS.md covers 10/10 clips with explicit license conclusions.
- A synthetic 3-joint BVH fixture converts to hand-computed expected angles (unit test
  of the math).

## Validation

Converter unit tests + `pnpm test tools/motion-pipeline`; visual spot-check happens in
issue 15's harness (angles are meaningless until skinning exists) — coordinate.

## Dependencies

01 (04 for schema reuse in validation).

## Non-goals

Runtime playback (15), motion editing UI (v2), additional locales.

## Design References

DESIGN.md §6.1–§6.3; ADR-002, ADR-003; docs/research/01 (BVH sources); ISSUE_PLAN §8.
