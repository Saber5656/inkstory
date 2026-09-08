# Pose model card — pose-v1

Status: unavailable for the v1 browser bundle (2026-09-08).

The intended model is Meta FAIR AnimatedDrawings' drawn humanoid pose estimator,
packaged as a TorchServe `.mar` and trained for the Amateur Drawings Dataset. Upstream
code and weights are MIT licensed; OpenMMPose/OpenMMDet are conversion tooling. The app
contract is 17 COCO heatmaps decoded into the fixed 16-joint skeleton.
The archived `config.py` specifies a 192x256 (width x height) input, 48x64 heatmap
(width x height), ImageNet mean `[123.675,116.28,103.53]`, and standard deviation
`[58.395,57.12,57.375]`; these values are recorded in the generated manifest.

Pinned source: release `v0.0.1`, commit `b859684857519c7424da51a0b0862fbd1fd258f4`,
asset URL `https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar`.
Verified on 2026-09-08: 374,824,711 bytes, SHA-256
`40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f`. The archive
contains `config.py`, `mmpose_handler.py`, `best_AP_epoch_72.pth`, and
`MAR-INF/MANIFEST.json`; it is not an ONNX graph.

`tools/model-pipeline/pipeline.py inspect` downloads and verifies this exact artifact;
`convert` fails closed. The source MAR is 374MB compressed, already above the 60MB hard
cap (and 30MB target), before export or quantization. The current Python 3.14.5
environment has no `torch`, `onnx`, `mmpose`, or `mmdeploy`, while upstream pins Python
3.8.13. No ONNX export, fp16/int8 delta, fixture parity, or ORT-web latency is claimed.
Candidate remedies are a separately pinned Python 3.8 conversion environment with graph
pruning/quantization, or an audited smaller COCO heatmap model.

`src/pose/modelManifest.generated.json` is machine-readable with `status: "unavailable"`;
no placeholder ONNX is shipped. ADR-004 therefore selects template pose/manual joints.

Reproduction:

```sh
python3 tools/model-pipeline/pipeline.py inspect --download-dir /tmp/inkstory-pose
python3 tools/model-pipeline/pipeline.py verify
python3 tools/model-pipeline/pipeline.py convert # exits 2 with JSON blocker
```
