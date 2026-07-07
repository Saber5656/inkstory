# Title

Stage mode screen (`/characters/:id`) and bundled background assets

## Summary

Build the single-drawing experience: the saved character performs motions on a chosen
background with effect toggles and fullscreen — plus create the 12 bundled background
assets used across stage and book modes.

## Context

Stage mode is journey A's payoff (DESIGN §3) and the first full integration of engine
(15) + effects (17). Backgrounds are shared with page layout (§8.4).

## Scope

`src/render/StageScene.ts`, stage route UI (motion picker, background picker, effect
toggles, fullscreen), `public/backgrounds/` assets + `backgrounds/index.json` catalog.

## Detailed Requirements

1. StageScene (Pixi): background layer (cover-fit), character actor centered per
   DESIGN §8.4 vertical band, optional particle layer (17). Resize/orientation-safe
   (listen to `resize`/`visualViewport`; letterbox, never distort).
2. Motion picker: horizontal thumbnail rail; localized clip names from clip metadata;
   selecting swaps clip with a 200 ms crossfade of pose (linear blend between old/new
   sampled angles over the fade window). Default per DESIGN §6.6 (`idle_breathe` /
   `float` for cutout).
3. Background picker: 12 bundled backgrounds — 8 original flat-illustration scenes
   (meadow, sky, sea, night, forest, castle, snow, space) + 4 plain colors. Assets
   are **project-created original SVG sources** committed under
   `assets-src/backgrounds/`, exported to 1920×1080 PNG (and 2× not needed — vector
   source retained) via a checked-in export script; licensed with the repo (MIT) and
   listed in `backgrounds/index.json` `{id, file, name:{ja,en}}` (zod-validated).
4. Effect toggles: chips for available effects (from 17's registry) with intensity
   preset (off/soft/strong → 0/0.4/0.8); persisted per character in
   `Character.effectPrefs`.
5. Fullscreen: Fullscreen API with iOS fallback (hide chrome, `100dvh`); exit returns
   to the same state. Screen Wake Lock while fullscreen (feature-detected,
   docs/research/03).
6. Speed control (0.5×/1×/2×) mapped to player speed.
7. Empty/edge states: character without rig (cutout) hides motion picker and shows
   effect chips prominently; missing clip file → toast + fallback to idle.

## Acceptance Criteria

- E2E-able flow: from library, open a fixture character → plays idle on default
  background; switch motion, background, effects, speed; enter/exit fullscreen — state
  consistent throughout (component/integration tests + Playwright happy path if 27
  infra exists).
- All 12 backgrounds render correctly at 3 viewport shapes (phone portrait, tablet
  landscape, desktop) — screenshot set in PR.
- Crossfade has no pose "pop" (visual check recorded).
- `backgrounds/index.json` schema-valid; SVG sources present for all 8 scenes.

## Validation

`pnpm test src/render/stage`; manual device pass (phone portrait) recorded in PR;
fps stays within §9.4 budget with effects at "strong" (probe screenshot).

## Dependencies

15, 17.

## Non-goals

Book player (21), custom/user backgrounds (v2), sample characters (25).

## Design References

DESIGN.md §3 (journey A), §6.4–§6.6, §8.4, §9.4; docs/research/03 (wake lock,
fullscreen).
