# v2 mobile approach study

_Status: design input only, 2026-09-08. MVP delivery remains the web/PWA app. No mobile project, store account, signing key, or device test is part of this document._

## Decision boundary

The product owner must choose whether v2 needs store distribution. This study keeps PWA-only as a valid outcome. A wrapper or rewrite must preserve the local-only pledge: no analytics, advertising, account, sync, remote inference, or upload SDK may be introduced as an incidental dependency.

The comparison uses current primary documentation: [Capacitor](https://capacitorjs.com/docs) describes a web-focused native runtime and plugin API; [Expo's project guide](https://docs.expo.dev/get-started/create-a-project/) describes React Native apps and its native build services; [Expo's workflow overview](https://docs.expo.dev/workflow/overview/) describes native projects, permissions, and prebuild; and [MDN's PWA guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/What_is_a_progressive_web_app) documents manifest, service-worker, install, and browser constraints.

## Evaluation matrix

Percentages are planning estimates from the current repository boundaries, not measured migration results. “Reuse” means code that can remain in the web core after adapters are extracted.

| Criterion | Capacitor wrapper | Expo/React Native UI | PWA-only |
| --- | --- | --- | --- |
| Estimated code reuse | 80–95% UI and domain; native adapters for camera/filesystem/audio | 35–55% domain/rig/motion; most UI and rendering rewritten | 100% current web code |
| Camera and microphone | Native plugins can expose platform APIs; web fallback remains | Native camera/audio modules and permissions; separate UI behavior | Browser permissions and `getUserMedia`; quality and install support vary by browser |
| On-device inference | Keep ORT-web in WebView first; a native ORT plugin is a later optimization | Native ORT/Expo module is possible, but requires native module/build work; ORT-web remains a fallback | ORT-web `webgpu`/WASM; single-thread fallback is required |
| Storage durability | App-private filesystem/SQLite adapter can reduce browser eviction risk; migration must be designed | Native filesystem/database; more predictable than browser storage, with backup behavior to define | IndexedDB and Cache Storage; request persistence, export often, and document eviction |
| Offline | Bundle web assets and model/motions; native bridge must reject unexpected network | Bundle assets in native build or use an update service; confirm update policy and hashes | Service worker cache; install/offline support differs by browser (see MDN) |
| Kids and store policy | Review Apple and Play rules even for local-only photos, drawings, and microphone | Same store review plus native SDK/data disclosures | No store review when distributed directly from a website, but web privacy and child-safety laws still apply |
| Release/signing load | Two native projects, certificates, store review, plugin maintenance | Two native projects plus Expo/EAS account, builds, signing, native modules | Static hosting and browser compatibility; no signing |
| Binary/asset size | Web assets plus WebView shell; native plugin/model size needs measurement | Native runtime plus JS bundle and model; needs per-ABI measurement | No binary; browser cache and model download budgets apply |
| Update cadence | Web assets can update with wrapper policy; native code waits for review | JS/native update channels have distinct policy and compatibility constraints | Static deploy and service-worker update; browser cache needs stale-asset tests |
| Refactor cost (planning) | 3–6 person-weeks for bridge, import/export, permissions, and store hardening | 8–16 person-weeks for RN UI/render adapters plus native inference/storage | 1–3 person-weeks for install UX, durability messaging, and browser QA |

### Evidence and policy constraints

A web app can be installed from a manifest and may work offline through a service worker, but [browser install support varies by browser and platform](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). PWA-only therefore has the smallest operational cost and the widest direct web reach, with the clearest storage limitation.

A Capacitor app is explicitly web-first and can add Swift/Java plugins ([official docs](https://capacitorjs.com/docs)). That makes it the shortest route to native filesystem, camera, and microphone adapters while retaining the existing React/Pixi screens. Google Play's [Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335) says a child-targeted app must accurately disclose data practices, including camera and microphone sensor data, and must not be merely a webview of a website. A Capacitor build must therefore add meaningful native integration and complete the target-audience/Data safety review.

Expo provides a React Native framework and native build path ([project creation](https://docs.expo.dev/get-started/create-a-project/), [workflow](https://docs.expo.dev/workflow/overview/)). Its native projects handle permissions and platform configuration, which improves native control but adds an RN UI/rendering migration and native build surface. EAS is an operational option, not evidence that this project has an account or a configured build.

Apple requires an accessible privacy policy and accurate disclosure of collection/storage/sharing ([App Review Guidelines 5.1](https://developer.apple.com/app-store/review/guidelines/#5-privacy), [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)). Its Kids guidance restricts third-party analytics/advertising and treats photos, videos, drawings, and similar data from minors as personal information. Google requires accurate Target Audience, Data safety, and IARC answers and specifically lists microphone/camera data in its Families data-practice rules. These policies can change; re-check them at submission time.

## Privacy model and migration

All three approaches can preserve the pledge if the same rules are enforced: process images/audio locally, vendor or hash-check inference assets, allow only same-origin or explicitly offline asset access, omit telemetry/ads/auth, and keep export/import user-controlled. A native wrapper does not make a network SDK acceptable; it makes the OS permission prompt, filesystem, SDK inventory, and store labels additional surfaces to audit.

- **Capacitor:** retain IndexedDB initially, then add a versioned native storage adapter only after an eviction test demonstrates the need. Explain camera/microphone permissions in the app and list native plugins in store disclosures. Do not silently copy private media to shared photo storage.
- **Expo:** share domain schemas, rig, motion, and `.inkstory` validation. Native camera/audio/filesystem and possibly render/inference adapters need explicit permission and data-flow tests. Keep a web build for the MVP and migration fallback.
- **PWA-only:** keep the current IndexedDB/export model, request persistent storage, show usage, and make backups prominent. Browser storage and service-worker cache remain subject to browser policy.

The `.inkstory` ZIP is a useful bridge for all three: IDs, schema-versioned JSON, texture/thumb PNGs, and narration binaries are already portable. Format v2 should add an explicit `sourceImage` entry only with an opt-in flag, a `storageProvenance` field, an integrity digest per binary, and a migration version; these are proposals, not current format behavior. A mobile import must reject unknown or unsafe paths just as the web importer does.

## Shared package boundary

Extract only after web behavior is stable:

1. `packages/domain`: Zod schemas, IDs, skeleton, pose mapping, template joints, motion selection.
2. `packages/vision`: ImageData segmentation and mask operations with no DOM dependency.
3. `packages/rig`: contour, triangulation fallback, normalized vertices/weights, serialization.
4. `packages/motion`: clip schema, FK, retarget math.
5. `packages/exchange`: `.inkstory` schema and byte limits.
6. Thin platform adapters: `capture`, `audio`, `storage`, `inference`, and `render`.

Capacitor can initially keep `src/app` and `src/render` in the web bundle and replace only adapters. Expo requires a new RN screen/render layer; Pixi/WebGL assumptions must be tested or replaced. No package extraction is approved by this study.

## Draft v2 issue breakdown (for ISSUE_PLAN wave 6+)

The list is intentionally granular; each item is one focused task for a later plan update.

- M1: record product-owner choice of store distribution and target age audience.
- M2: extract and test `packages/domain` with web compatibility.
- M3: extract pure vision and mask packages; compare browser/native pixel results.
- M4: extract rig and motion packages; establish golden fixtures and coordinate parity.
- M5: specify `.inkstory` v2 optional source-image and per-entry-integrity fields.
- M6: implement a mobile import/export adapter and migration tests.
- M7: prototype Capacitor camera, microphone, filesystem, and permission explanations.
- M8: prototype Capacitor offline asset/model integrity and WebView isolation.
- M9: measure Capacitor storage durability and recovery after OS pressure.
- M10: prototype Expo/RN capture, audio, storage, and render adapters.
- M11: measure Expo native inference versus ORT-web fallback on representative devices.
- M12: build a PWA install/offline/storage matrix for current target browsers.
- M13: create the native threat model, SDK inventory, privacy labels, and child-safety review.
- M14: set up signing, store metadata, review gates, and reproducible release artifacts.
- M15: run iOS/Android golden-path, accessibility, migration, and deletion acceptance.

## Recommendation and open risks

**Provisional recommendation: Capacitor, only if the owner approves store distribution.** It preserves the current web UI and pure TypeScript engine while allowing native storage and media adapters where browser durability is inadequate. The main risk is store scrutiny of a web-first app; the native build must provide a meaningful offline/native experience and pass the Families rules. Do not commit to this recommendation through ADR-007 without human approval.

PWA-only remains the best MVP and lowest-risk v2 outcome when store reach is not required. Expo is attractive if a native interaction/rendering redesign is a product goal, but its migration cost and native inference surface are larger. The next evidence needed is a small prototype on one iOS and one Android device, with measured storage recovery, camera/audio behavior, model latency, and a completed policy inventory.
