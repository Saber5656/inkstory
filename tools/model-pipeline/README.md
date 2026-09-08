# Pose model conversion spike

This pipeline is offline-only and never runs as part of the web build.

Pinned upstream source: `facebookresearch/AnimatedDrawings` tag `v0.0.1`, commit
`b859684857519c7424da51a0b0862fbd1fd258f4`, asset
`drawn_humanoid_pose_estimator.mar`, URL
`https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar`.
The asset is 374,824,711 bytes with SHA-256
`40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f`.

```sh
python3 tools/model-pipeline/pipeline.py inspect --download-dir /tmp/inkstory-pose
python3 tools/model-pipeline/pipeline.py verify
```

`inspect` downloads only that pinned asset and lists MAR members. `convert` exits with
a machine-readable blocker: the source MAR is already over the 60MB hard cap before
export or quantization, and no pinned PyTorch/OpenMMPose/MMDeploy environment exists.
It does not write a fake ONNX file. The app consumes
`src/pose/modelManifest.generated.json`, currently `status: "unavailable"`.
