# ADR-004: In-browser inference via onnxruntime-web, with manual annotation as the guaranteed path

Date: 2026-07-08
Status: Accepted

## Context

Pose estimation is the only neural component (ADR-002). It must run on-device (ADR-001).
docs/research/02 documents runtime options and the conversion unknowns (opset
compatibility, size after quantization, latency).

## Decision

1. Runtime: **onnxruntime-web**, EP order `webgpu` → `wasm`; wasm threads used only when
   `crossOriginIsolated`; single-thread wasm is a supported configuration.
2. Model artifact: converted+quantized ONNX, budget ≤ 30 MB (hard cap 60 MB), served
   same-origin under `/models/` with a build-time `sha256` manifest verified via
   SubtleCrypto before use; runtime-cached in Cache Storage.
   The same reviewed manifest must carry the ORT wasm file, SHA-256, and byte length when
   a model is available. `modelLoader` verifies both assets (including cache purge and one
   retry), transfers the wasm bytes to the worker, and the worker sets
   `ort.env.wasm.wasmBinary` only after verification immediately before a wasm session is
   created. An unverified or missing wasm asset cannot reach `InferenceSession.create`.
3. Conversion happens offline in `tools/model-pipeline/` (spike issue 10) and artifacts
   are vendored in repo release assets with provenance (source commit, script, hashes).
4. **The product must be 100% functional with no model**: template-pose prefill + the
   joint editor (issue 12) is the guaranteed path. Model failure/absence degrades UX, not
   capability. This inverts the usual dependency: UI issues do not depend on the spike.

## Consequences

- The riskiest technical item (model conversion) is isolated in one timeboxed spike that
  cannot block the release.
- CSP must allow `'wasm-unsafe-eval'` (verified/minimized in issue 24).
- The current bundled manifest is `status:"unavailable"`, so no model or wasm fetch is
  attempted; the manual template-pose path remains the shipped behavior. The eventual
  available manifest must include both model and wasm integrity records before enabling
  runtime inference.
- If the spike fails outright, v1 ships with manual joints only and the model becomes a
  post-v1 fast-follow — an explicitly acceptable outcome recorded here.
