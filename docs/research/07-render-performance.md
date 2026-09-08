# Renderer performance evidence

Measured on 2026-09-08 in production-build Chromium on an Apple M4 Mac. The stage canvas was 842 × 632 pixels, antialiasing enabled. The test replaced the sample's rig in its isolated IndexedDB profile with a deterministic 60 × 50 grid: 3000 vertices, 5782 triangles, at most two existing joint influences per vertex. This is synthetic performance data, not a saved family drawing.

| Backend | Fixture | Effects | Completed-render FPS over 5 seconds | 55 FPS budget |
| --- | --- | --- | --- | --- |
| ANGLE Metal Renderer: Apple M4 | 3000 vertices | 0 | 59.980 | Pass |
| ANGLE Metal Renderer: Apple M4 | 3000 vertices | 3 | 59.981 | Pass |
| ANGLE Vulkan SwiftShader | Original sample | 0 | 22–48 across diagnostic runs | Hardware budget not qualified |

The probe attaches to Pixi's `postrender` runner, removes listeners after measurement, and reports the slowest active renderer if several exist. It does not measure only animation-frame callbacks. A regression test demonstrates that two 60/30 FPS renderers produce 30, not their misleading sum of 90.

The diagnostic compared tracing on/off and antialiasing on/off. Neither explained the large difference. Explicitly enabling Chromium's Metal backend did. Software-only hosted runners therefore report their backend and measured cadence, but mark the hardware budget skipped. This is an explicit limitation relative to the issue's original hosted-GPU assumption; it must not be presented as CI-proven hardware performance.

Reproduce using the commands in [the browser validation guide](../../tests/e2e/README.md). Physical-device thermal behavior, long-session heap stability, and iOS/Android frame rates remain release checks. The separate three-viewport Chromium/WebKit stage sweep verifies that the sample remains visible for every bundled motion and background.
