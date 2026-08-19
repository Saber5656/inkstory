# Title

Rig builder: contour extraction, constrained Delaunay mesh, LBS weights, rig serialization

## Summary

Implement `buildRig(mask, joints, texture) → CharacterRig` exactly per DESIGN §5.6:
simplified contour, CDT mesh with interior Steiner points, two-bone inverse-distance
weights, normalization to rig space, plus the degenerate-input grid-mesh fallback.

## Context

This is the bridge from user-confirmed annotations to the animation engine (15). LBS
choice and weight formula are fixed by ADR-003; robustness fallback is a named risk
(DESIGN §13, ISSUE_PLAN §8).

## Scope

`src/rig/`: `contour.ts` (marching squares + Douglas-Peucker), `mesh.ts` (Steiner grid
+ cdt2d + fallback), `weights.ts`, `buildRig.ts`, golden-file tests.

## Detailed Requirements

1. `contour.ts`: marching squares over the binary mask → closed polygons → take
   largest by area → Douglas-Peucker simplify with ε = bboxDiag/300; clamp result to
   80–400 points by adapting ε (binary search, ≤8 iterations).
2. `mesh.ts`: interior Steiner points on a square grid, spacing = bboxDiag/40, keeping
   only points strictly inside the mask eroded by 1 px; run `cdt2d(points, contourEdges,
   {exterior:false})`; drop triangles whose centroid falls outside the mask.
   **Fallback** (DESIGN §5.6 #5): on cdt2d throw or output with 0 triangles or
   non-manifold result, build a uniform grid mesh over the bbox (cell = bboxDiag/40),
   keep cells whose center is inside the mask, split each into 2 triangles. Record
   which path was taken in the rig's `meshMethod: 'cdt' | 'grid'` field (already part
   of the CharacterRig schema — DESIGN §7.1 / issue 04).
3. `weights.ts`: for each vertex compute Euclidean distance to each of the 15 bone
   segments (point-to-segment); take the two nearest; `wᵢ = 1/(dᵢ+ε)⁴` with
   ε = bboxDiag/1000; normalize to sum 1; vertices above the neck joint's y (in rig
   space) and inside the head lobe of the contour bind 100% to bone `neck`
   (head-region rule DESIGN §5.6 #4 — implement as: nearest bone is `neck` OR distance
   to neck joint < distance to any bone segment × 0.8).
4. `buildRig.ts`: compose the above; normalize per DESIGN §5.6 #6 (origin=root,
   height=1, +y down); vertex count target 800–3000 (assert; adapt grid spacing ×1.5
   once if above); budget ≤1 s (§9.4) measured in tests on fixtures.
5. Golden-file tests: for 4 humanoid fixtures store serialized rigs
   (`tests/goldens/rigs/*.json`); tests compare structurally (counts, bbox, sampled
   weights) with tolerances — not byte equality — so cross-platform float noise
   doesn't flake.
6. Degenerate suite: self-intersecting contour fixture, 1-px-thin limbs fixture,
   mask-with-islands fixture → all produce a usable rig (possibly grid fallback),
   never throw.

## Acceptance Criteria

- All fixture rigs: schema-valid (issue 04), vertex/triangle bounds respected, every
  vertex has 1–2 normalized weights, FK-applied identity pose reproduces rest positions
  exactly.
- Degenerate suite passes with `meshMethod:'grid'` where applicable.
- Build time ≤1 s per fixture in CI.
- Wizard `saved` path now persists a full humanoid rig (integration test extends
  issue 12's).

## Validation

`pnpm test src/rig`; dev harness page rendering mesh wireframe + weight heatmap per
bone over the texture for the 4 fixtures — screenshots in PR.

## Dependencies

09, 12.

## Non-goals

Runtime skinning/animation (15), ARAP (v2 — ADR-003), multi-influence >2 weights.

## Design References

DESIGN.md §5.6, §9.4, §13; ADR-003; ISSUE_PLAN §8 (cdt2d unknown).
