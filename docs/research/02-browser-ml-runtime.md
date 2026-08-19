# Research: Running the ML pieces fully in the browser

Date: 2026-07-08
Status: verified via vendor docs and platform release notes

## Requirement being validated

Decision Q2/Q4 (see DESIGN.md §2): all processing — including pose estimation — must run
on-device in a web app, with zero server calls. This document confirms feasibility and
records the constraints that shape the architecture.

## onnxruntime-web (ORT-web)

- npm package `onnxruntime-web`; execution providers relevant to inkstory:
  - **`wasm` (CPU)** — universal baseline. Multi-threading + SIMD give large speedups but
    **threads require `SharedArrayBuffer`, which requires cross-origin isolation**
    (COOP/COEP headers). Without isolation ORT-web silently runs single-threaded — slower
    but functional. inkstory's pose inference is a single image per character creation
    (not per-frame), so even single-threaded latency of a few seconds is acceptable UX
    (progress indicator required).
  - **`webgpu`** — shipping by default in Chrome/Edge (Windows/macOS/Android/ChromeOS);
    **Safari 26 (2025) ships WebGPU on macOS, iOS, iPadOS, visionOS** (WebKit WWDC25
    announcement). Firefox: behind flag on some platforms. WebGPU does not require
    cross-origin isolation. Treat as progressive enhancement over wasm.
- Sources: onnxruntime.ai web tutorials (WebGPU EP, build docs), npm `onnxruntime-web`,
  webkit.org "News from WWDC25: WebKit in Safari 26 beta".

### CSP interaction

ORT-web executes WebAssembly → the Content-Security-Policy must include
`script-src 'wasm-unsafe-eval'` (exact minimal policy to be verified empirically in
issue 24; do not ship `'unsafe-eval'`).

## Cross-origin isolation on static hosting

COOP/COEP response headers are required for wasm threads:

| Host | Custom headers? | Approach |
|---|---|---|
| GitHub Pages | **No** (community discussion #13309) | `coi-serviceworker` (gzuidhof/coi-serviceworker, MIT): a service worker that injects COOP/COEP; requires same-origin unbundled script and one first-visit reload |
| Cloudflare Pages / Netlify | Yes (`_headers` file) | set `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` |
| Self-host (any static server) | Yes | documented in self-hosting guide |

Design consequence: the app must work **without** isolation (single-thread wasm path),
and treat isolation as an optimization. `coi-serviceworker` is bundled for the GitHub
Pages deployment. `crossOriginIsolated` is surfaced on a diagnostics screen.

## Model conversion path

- Upstream pose model is an OpenMMPose top-down heatmap model packaged as TorchServe
  `.mar`. Conversion route: unpack `.mar` → mmdeploy/PyTorch → ONNX export → (optional)
  int8/fp16 quantization → validate output parity on fixture drawings.
- A community Flutter port of AnimatedDrawings already runs this pose model as ONNX on
  web/native (linear blend skinning + BVH), which is strong evidence the conversion works.
- Unknowns to resolve in spike issue 10: exported opset compatibility with ORT-web,
  final file size (budget ≤ 30 MB quantized; hard cap 60 MB), preprocessing details
  (input resolution, normalization, heatmap decode), latency on mid-range hardware.

## Model distribution & integrity

- Models are static assets served same-origin under `/models/`, versioned by content
  hash, cached in Cache Storage after first use (app works offline afterwards).
- A build-time manifest records `sha256` per model; the loader verifies the hash via
  `crypto.subtle.digest` before session creation (defends against host/CDN tampering and
  truncated downloads).
- Because upstream is archived, converted ONNX artifacts are stored in this repository's
  release assets (vendored), with provenance notes (source commit, conversion script) in
  `tools/model-pipeline/`.

## Fallback ladder (must-hold product guarantee)

1. WebGPU available → fastest inference.
2. wasm + threads (cross-origin isolated) → fast.
3. wasm single-thread → seconds-level, progress UI.
4. **Model unavailable / load failed / low-confidence output → template-pose prefill +
   manual joint placement UI.** The product is fully usable with zero ML.

This ladder is the reason the joint-correction UI (issue 12) is a core surface, not an
error path.
