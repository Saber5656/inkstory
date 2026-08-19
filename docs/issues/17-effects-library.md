# Title

Procedural effects library: transforms, particles, cutout mode, reduced-motion

## Summary

Implement the deterministic effect system of DESIGN §6.4: five transform effects, three
particle overlays, an effect registry with intensity, cutout-mode animation, and
`prefers-reduced-motion` behavior.

## Context

Effects are what make non-humanoid drawings ("cutout" rigs) come alive — the G2
guarantee that no drawing is rejected — and they layer over skeletal motion for
humanoids. Determinism (seeded) keeps output testable.

## Scope

`src/render/effects/`: `registry.ts`, transform effects (`float`, `wiggle`, `bounce`,
`drift`, `spin`), particle effects (`sparkles`, `confetti`, `bubbles`), reduced-motion
gate, unit tests.

## Detailed Requirements

1. Effect interface:
   `apply(target: EffectTarget, tMs: number, cfg: {intensity: number, seed: number})`
   where EffectTarget exposes `{position, rotation, scale}` deltas composed
   multiplicatively over the actor's base transform (effects never mutate skinned
   vertices). All effects are pure functions of `(tMs, cfg)` — no internal state, no
   `Math.random()` at runtime (mulberry32 PRNG seeded from cfg.seed for per-particle
   variation, evaluated deterministically per particle index).
2. Transform effects (exact motion definitions):
   - `float`: y = sin(t·2π/2400 ms)·A, A = 2%–6% of character height by intensity;
   - `wiggle`: rotation = sin(t·2π/900)·(2°–8°);
   - `bounce`: scaleY = 1 − |sin(t·2π/1400)|·(3%–10%), scaleX compensates volume;
   - `drift`: x = sin(t·2π/5200)·(3%–10% of stage width);
   - `spin`: rotation = t·(15–60)°/s (cutout only; registry flags allowed rig types).
3. Particles: pooled sprites (≤120 alive), spawn/update from deterministic schedule;
   textures = tiny original PNGs (star, circle, square) committed under
   `public/effects/`; no per-frame allocation (pool reuse asserted like issue 15 §8).
4. Registry: `{id, name:{ja,en}, kind:'transform'|'particles', allowedRigTypes,
   defaultIntensity}`; consumed by stage (16) and page composer (19); max 3 concurrent
   effects per actor (schema bound, issue 04).
5. Cutout default behavior: `float` at 0.4 auto-applied when a cutout character has no
   effects selected (DESIGN §6.6 default).
6. Reduced motion (DESIGN §6.4/§8.6): when `prefers-reduced-motion` OR the settings
   override is on → transform intensities forced to 0, particles disabled, skeletal
   clips still allowed but player speed capped at 1× (motion itself is user-initiated
   content); a subtle static sparkle frame replaces particles.
7. Unit tests: effect outputs at fixed (t, seed, intensity) match golden numbers;
   pool never exceeds cap; reduced-motion gate zeroes outputs.

## Acceptance Criteria

- Dev harness (15's route) shows each effect on a cutout fixture and layered on a
  humanoid fixture — recording in PR.
- Determinism test: two actors with same seed render identical particle positions at
  t=5000 ms.
- Reduced-motion emulation (Playwright `reducedMotion: 'reduce'` or CSS media
  emulation in test) produces zero transform deltas and no particles.
- fps budget maintained with 3 effects + skeletal clip on CI perf smoke (extend
  issue 15's test).

## Validation

`pnpm test src/render/effects`; harness recording; heap-delta assertion over 300
frames with particles active.

## Dependencies

15.

## Non-goals

Stage UI (16), background parallax (kept minimal: not in v1 unless free — if trivial,
implement as background `drift` reuse; otherwise skip), custom user effects (v2).

## Design References

DESIGN.md §6.4, §6.6, §8.6, §9.4; ADR-002 #5 (cutout inclusivity).
