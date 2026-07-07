# Title

Animation engine: motion player, FK, CPU LBS skinning, Pixi skinned mesh

## Summary

Implement runtime playback per DESIGN §6.5: sample motion clips, apply the retarget
rule, forward-kinematics with the character's bone lengths, CPU linear-blend skinning
into a PixiJS mesh, meeting the §9.4 frame budgets.

## Context

The heart of "the drawing moves". Consumes rigs (13) and clips (14). PixiJS v8 renders
WebGPU→WebGL (ADR-006). Perf floor: 30 fps on Pixel-4a-class, 60 target (§9.4).

## Scope

`src/motion/`: `clipLoader.ts` (fetch+schema+cache), `player.ts` (sampling), `fk.ts`;
`src/render/`: `SkinnedMesh.ts` (Pixi mesh wrapper), `CharacterActor.ts` (compose),
perf probe; dev harness route (`/dev/anim` behind `import.meta.env.DEV`).

## Detailed Requirements

1. `clipLoader`: load `/motions/index.json` + clip files; zod-validate (issue 04);
   verify per-clip sha256 from the index; in-memory cache; typed errors.
2. `player.ts`: `sample(clip, tMs, speed) → {angles: Record<boneId, deg>, rootT: [x,y]}`
   — linear interpolation between frames with shortest-arc angle lerp; loop and
   play-once modes; `speed ∈ [0.5, 2]`; pure and unit-tested against hand-computed
   samples (incl. wraparound at the loop seam).
3. `fk.ts`: retarget rule DESIGN §6.2 —
   `charGlobal(b) = charRest(b) + (clipFrame(b) − clipRest(b))`; joint positions by FK
   from root along DESIGN §6.1 hierarchy using the **character's own bone lengths**;
   root translation added in character-height units. Output per-bone 2D affine
   matrices (rotate about parent joint, translate). Unit tests: identity clip
   reproduces rest pose; 90° single-bone fixture moves exactly the child chain.
4. `SkinnedMesh`: Pixi v8 `Mesh` with the rig's triangles + texture; per-frame CPU LBS:
   `v' = Σ wᵢ · Mᵢ · v` over ≤2 influences into a preallocated Float32Array; upload via
   buffer update (no realloc). Bounds updated for culling.
5. `CharacterActor`: composes texture, rig, player; API
   `{setClip(id), setSpeed, play, pause, tick(dtMs)}`; cutout rigs get an identity
   actor (sprite) sharing the interface (effects attach in issue 17).
6. Perf probe: rolling-average fps + frame-time histogram, exposed to diagnostics;
   dev harness renders N sliders (1/2/4 actors) and shows the probe.
7. CI perf smoke: headless chromium (Playwright, coordinated with issue 27 infra or a
   vitest-browser perf test if 27 not yet landed): 1 actor with a 3000-vertex fixture
   rig ≥55 fps average on runner over 5 s; document runner variance allowance (±10%).
8. No allocation in the per-frame path (verified by heap-delta assertion over 300
   frames in the perf test).

## Acceptance Criteria

- Unit suites for player/fk pass incl. seam and retarget fixtures.
- Fixture character (issue 13 golden rig) visually plays all 10 clips in the dev
  harness — screenshots/recording in PR; no mesh tearing at contour (spot-check).
- Perf smoke green in CI; heap-delta assertion green.
- `preview` wizard step (issue 12 seam) now shows the real animated character with the
  `wave` clip.

## Validation

`pnpm test src/motion src/render`; dev-harness recording attached; run on a mid-range
Android device and note fps in PR (manual matrix row for §9.4).

## Dependencies

13, 14.

## Non-goals

Stage screen UI (16), effects (17), book playback orchestration (21), ARAP (v2).

## Design References

DESIGN.md §6.1, §6.2, §6.5, §9.4; ADR-003, ADR-006.
