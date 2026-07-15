# Title

SPIKE: pose model conversion pipeline (.mar → ONNX → quantized) and vendored artifact

## Summary

Timeboxed spike: build `tools/model-pipeline/` that converts the upstream (archived,
MIT) drawn-humanoid pose estimator to ONNX usable by onnxruntime-web, quantize it,
measure it, and vendor the artifact with provenance + hash manifest. Outcome may be
"success" or a documented "not shippable yet" — the release does not block on it
(ADR-004 #4).

## Context

The only neural component (ADR-002). Upstream ships TorchServe `.mar` archives built
with OpenMMPose (docs/research/01). Conversion route via mmdeploy/PyTorch export is
documented as practical (community port evidence, docs/research/02) but unverified for
ORT-web specifically. Upstream repo is read-only → we must vendor everything we use.

## Scope

`tools/model-pipeline/` (Python, offline only — never shipped to the browser),
`public/models/` ONNX artifact, an app-bundled reviewed model manifest source,
`docs/research/04-pose-model-card.md` report. Timebox: 3 focused working days; report
whatever is true at the end.

## Detailed Requirements

1. Scripted, reproducible steps (README + `make` targets or numbered scripts):
   download pinned upstream release artifacts (record URL + sha256), unpack `.mar`,
   reconstruct the mmpose model, export ONNX (opset compatible with current ORT-web),
   validate parity: keypoint outputs on ≥10 fixture drawings within 2 px (at model
   input scale) of the PyTorch reference.
2. Quantize (fp16 and int8 dynamic; pick best size/accuracy trade-off): budget ≤30 MB,
   hard cap 60 MB (ADR-004). Record accuracy deltas on the fixture set.
3. Measure latency: ORT-web wasm single-thread + WebGPU on a dev machine (numbers are
   indicative only; recorded in the model card).
4. Deliver `public/models/pose-v1.onnx` plus an app-bundled reviewed manifest source
   (for example `src/pose/modelManifest.generated.json`, consumed by issue 11 rather
   than fetched from `/models` at runtime):
   `{id:"pose-v1", file, sha256, sizeBytes, inputWidth, inputHeight, normalization,
   outputSpec:"coco17-heatmaps", license:"MIT", provenance:{sourceRepo, sourceCommit,
   convertedBy, date}}` (consumed by issue 11).
5. Model card `docs/research/04-pose-model-card.md`: architecture, dataset (Amateur
   Drawings), conversion steps, measurements, limitations, license chain.
6. Python env pinned (`uv`/`requirements.txt` with hashes); pipeline never touches the
   web app build; artifacts committed via Git LFS **only if** repo policy allows, else
   attached to a GitHub release and fetched by a checked-in script with hash verify —
   decide in-PR with the maintainer and document the choice in the model card.
7. If blocked (opset gap, unsupported op): document the exact blocker + candidate
   remedies in the model card, mark the app-bundled manifest source
   `status:"unavailable"`, and close the spike — the app ships with template-pose
   fallback (ADR-004).

## Acceptance Criteria

- Either: app-bundled manifest source + ONNX artifact pass a scripted verification
  (`pnpm|python verify`) re-running parity on fixtures and hash check; **or** the model
  card documents the blocker and `status:"unavailable"` is machine-readable by issue 11.
- Every download in the pipeline is pinned (URL + sha256) — no floating "latest".
- The model card exists and covers all §5 fields.

## Validation

Run the pipeline end-to-end from a clean clone following only the README; verification
script output attached to PR.

## Dependencies

01 (repo only). Independent of all UI issues — start any time; 11 consumes the output.

## Non-goals

Browser integration (11), figure-detector conversion (not used in v1, ADR-002 #2),
training/fine-tuning.

## Design References

ADR-002, ADR-004; docs/research/01, 02; DESIGN.md §5.4, §9.4, §13.
