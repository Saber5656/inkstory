# ADR-003: Linear blend skinning for v1 deformation (ARAP deferred to v2)

Date: 2026-07-08
Status: Accepted

## Context

Upstream AnimatedDrawings deforms the character mesh with As-Rigid-As-Possible (ARAP)
optimization (precomputed factorization + per-frame solve). Porting a robust ARAP solver
to TypeScript/WASM is a significant numerical-code effort with hard-to-debug failure
modes — a poor fit for granular issues executed by lower-capability agents.

## Decision

v1 uses **linear blend skinning (LBS)**:

- Mesh: constrained Delaunay triangulation of the simplified mask contour plus interior
  Steiner grid points (issue 13).
- Weights: per-vertex inverse-distance weighting to the two nearest bone segments
  (exact formula fixed in issue 13), normalized; computed once at rig build.
- Per frame: bone transforms from the motion player → CPU vertex skinning in a typed
  array → PixiJS mesh position buffer update.

ARAP (or a bounded-biharmonic-weights upgrade) is a v2 quality item, listed in
ISSUE_PLAN §Deferred. The rig data model stores enough (mesh + joints + weights version
field) that a future deformer can be introduced without re-authoring characters.

## Consequences

- Simple, fast (≤3k vertices × ≤4 influences at 60 fps is trivial on 2020-class phones),
  mechanically implementable and unit-testable.
- Known artifacts: volume loss ("candy-wrapper") at extreme joint angles. Accepted for
  v1: bundled motion clips are curated to moderate joint ranges (issue 14 criterion).
- A community Flutter port of AnimatedDrawings ships LBS and demonstrates acceptable
  visual quality for this content class (docs/research/02).
