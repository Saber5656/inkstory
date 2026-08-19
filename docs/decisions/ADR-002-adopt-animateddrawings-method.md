# ADR-002: Adopt the AnimatedDrawings method (classical-CV mask, ONNX pose, 16-joint skeleton)

Date: 2026-07-08
Status: Accepted

## Context

The "drawing looks exactly like itself but moves" requirement (Q&A 2026-07-07) rules out
generative image/video AI. Meta's AnimatedDrawings (MIT; docs/research/01) provides a
proven, published method plus trained models and motion data. The upstream repo is
archived (read-only) as of 2025-09-03.

## Decision

1. Reimplement the AnimatedDrawings pipeline for the browser:
   classical-CV segmentation (direct port of `segment()`), ONNX pose estimation
   (converted upstream model), COCO-17 → 16-joint mapping, fixed humanoid skeleton
   exactly as specified in docs/research/01.
2. Skip the ML figure detector in v1; a manual crop step replaces it.
3. Every user-visible auto step (mask, joints) has a manual correction UI; automation
   is a prefill, never a gate.
4. **Vendor all upstream artifacts we depend on** (model weights → converted ONNX, BVH
   clips → converted motion JSON) inside this repository / its release assets, with
   provenance notes, because upstream is archived and immutable.
5. Non-humanoid drawings are supported via a skeleton-less **cutout rig** animated by
   procedural effects (ADR-003 / DESIGN §6.4), so no drawing is ever rejected.

## Consequences

- Deterministic, explainable output; zero inference cost; works offline.
- Humanoid-only skeletal motion in v1 (quadrupeds etc. get effects mode); acceptable and
  clearly communicated in UI copy.
- MIT obligations: retain copyright notice for ported code; per-clip motion attribution
  audit required (issue 14).

## Alternatives rejected

- Generative image-to-video: violates local-only policy, unpredictable output, cost.
- Photo-trained pose models (MediaPipe/MoveNet): trained on photographs, known to perform
  poorly on children's drawings — the whole reason the Amateur-Drawings-trained model exists.
