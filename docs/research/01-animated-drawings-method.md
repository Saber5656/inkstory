# Research: Meta AnimatedDrawings — method, assets, licensing

Date: 2026-07-08
Status: verified against primary sources (repository content fetched directly)

## Why this matters for inkstory

inkstory's core promise — "a scanned child's drawing becomes a moving character that still
looks exactly like the drawing" — is the problem solved by Meta FAIR's *AnimatedDrawings*
(paper: "A Method for Animating Children's Drawings of the Human Figure", ACM TOG 2023).
Their method, models, and data are MIT-licensed, so inkstory can reimplement the pipeline
for the browser and reuse the trained models and motion data.

## Primary sources

- Repository: <https://github.com/facebookresearch/AnimatedDrawings> — **MIT license**
  (code, model weights, Amateur Drawings dataset). ChildlikeSHAPES dataset is CC-BY 4.0
  (not needed by inkstory).
- **The repository was archived on 2025-09-03 and is read-only.** Assets remain
  downloadable, but there is no upstream maintenance. Consequence: inkstory must vendor
  (copy into its own distribution) every artifact it depends on — model weights, BVH
  clips, and any ported source. Tracked as a hard requirement in the issue plan.
- Public demo: <https://sketch.metademolab.com/> (UX reference for correction steps).
- Pipeline reference implementation: `examples/image_to_annotations.py` (fetched and read).
- Character config reference: `examples/characters/char1/char_cfg.yaml` (fetched and read).

## Pipeline (as implemented upstream)

1. **Figure detection** — ML model (`drawn_humanoid_detector`, Mask R-CNN family via
   OpenMMDet) returns a bounding box around the drawn figure. Served via TorchServe
   (`.mar` archive) in Docker.
2. **Segmentation — classical image processing, not ML.** `segment()` in
   `image_to_annotations.py`:
   1. per-pixel min across color channels → grayscale
   2. adaptive Gaussian threshold (binary)
   3. invert
   4. morphological close ×2, dilate ×2 (3×3 rect kernel)
   5. flood fill from ~10 seed points along each image edge to mark background
   6. keep largest connected contour
   7. fill interior holes
3. **Pose estimation** — ML model (`drawn_humanoid_pose_estimator`, OpenMMPose top-down
   heatmap model trained on the Amateur Drawings dataset) returns **17 COCO-style
   keypoints** on the cropped figure.
4. **Manual correction** — the demo lets users fix the bbox, mask, and joints. Correction
   UI is a first-class part of the product, not an afterthought.
5. **Rigging** — keypoints are mapped to a fixed 16-joint skeleton; the masked texture is
   triangulated into a mesh.
6. **Motion retargeting** — BVH mocap clips are projected onto a 2D plane and drive bone
   orientations of the character skeleton.
7. **Deformation & render** — As-Rigid-As-Possible (ARAP) mesh deformation, OpenGL render.

### Implication for a browser port

Only step 3 (pose) strictly needs a neural network. Step 1 (detection) can be replaced by
a manual crop step in v1. Step 2 is pure image processing implementable on `ImageData` in
a Web Worker. Step 7 can be simplified to linear blend skinning (LBS) for v1 (see
ADR-003). This makes a fully client-side implementation realistic.

## Skeleton specification (verified from `char_cfg.yaml`)

16 joints, fixed hierarchy:

| # | joint | parent |
|---|-------|--------|
| 1 | root | — |
| 2 | hip | root |
| 3 | torso | hip |
| 4 | neck | torso |
| 5 | right_shoulder | torso |
| 6 | right_elbow | right_shoulder |
| 7 | right_hand | right_elbow |
| 8 | left_shoulder | torso |
| 9 | left_elbow | left_shoulder |
| 10 | left_hand | left_elbow |
| 11 | right_hip | root |
| 12 | right_knee | right_hip |
| 13 | right_foot | right_knee |
| 14 | left_hip | root |
| 15 | left_knee | left_hip |
| 16 | left_foot | left_knee |

15 bones (parent→child edges). The 17 COCO keypoints (nose, eyes, ears, shoulders,
elbows, wrists, hips, knees, ankles) are reduced to these 16 joints in
`image_to_annotations.py` (e.g., neck = midpoint of shoulders, hip = midpoint of hips);
the exact formulas must be ported from that MIT source file.

## Model artifacts

- Distributed as TorchServe `.mar` archives in the repo releases; built with OpenMMDet /
  OpenMMPose (both Apache-2.0 — used only offline for conversion, never shipped).
- Weights themselves: MIT. Conversion to ONNX (for onnxruntime-web) goes through the
  OpenMMLab `mmdeploy` toolchain; a community Flutter port of AnimatedDrawings already
  runs the pose model via ONNX on web and native, which demonstrates conversion is
  practical. Conversion effort, final size, and quantization results are still an
  **open unknown** → dedicated spike issue (10).

## Motion data

`examples/bvh/` contains subdirectories `cmu1` (CMU mocap), `fair1` (FAIR-recorded), and
`rokoko` (Rokoko-provided). All live inside the MIT-licensed repo, but per-file
attribution requirements (CMU mocap asks for attribution; Rokoko exports use the Mixamo
skeleton preset) must be audited when building the motion library → explicit acceptance
criterion in issue 14.

## What inkstory reuses vs. reimplements

| Component | Decision |
|---|---|
| Detection model | **Not used in v1** — manual crop instead |
| `segment()` algorithm | **Port to TypeScript** (pure function on ImageData) |
| Pose model | **Convert to ONNX**, run with onnxruntime-web; manual fallback |
| 16-joint skeleton + COCO-17 mapping | **Adopt as-is** |
| BVH clips | **Convert offline** to a compact 2D motion JSON at build time |
| ARAP deformation | **Replace with LBS** in v1 (ARAP = v2 quality upgrade) |
| OpenGL renderer | **Replace with PixiJS (WebGL/WebGPU) mesh rendering** |

## Comparable products (positioning)

- *sketch.metademolab.com* — single-character animation demo; uploads the drawing to
  Meta's servers; no book concept; not installable/offline.
- Commercial "draw-and-it-comes-alive" apps exist on mobile app stores, but none combine:
  open source + fully local processing + a multi-page narrated picture-book mode.
  inkstory's differentiator is the **privacy stance (nothing leaves the device)** plus
  the **book mode**.
