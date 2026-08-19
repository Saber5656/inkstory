# inkstory — v1 Issue Plan

Date: 2026-07-08
Derived from: docs/DESIGN.md (canonical). GitHub Issues are generated from
docs/issues/NN-*.md; if they diverge, these files win.

## 1. v1 completion statement

When issues **01–28** are completed and each issue's Acceptance Criteria and Validation
sections pass, inkstory v1 as specified in DESIGN.md §1–§12 is feature-complete and
releasable: a fully local, offline-capable PWA that (a) turns a photographed child's
drawing into an animated character — skeletal motion for humanoid drawings, effects mode
for everything else — with manual correction at every automated step, (b) composes
characters into multi-page picture books with story text, story-matched motion
suggestions, and recorded narration, (c) plays books back fullscreen, (d) exports/imports
user-owned `.inkstory` backups, and (e) ships with the security controls of DESIGN §10,
including the tested zero-cross-origin-network guarantee. Issue 29 is post-v1 planning
(v2 mobile) and is **not** required for the v1 release.

## 2. Issue list (recommended execution order)

| # | File | Title | Wave | Size |
|---|------|-------|------|------|
| 01 | issues/01-repo-scaffolding.md | Project scaffolding (Vite+React+TS, lint, test) | 0 | M |
| 02 | issues/02-ci-pipeline.md | CI quality gates & supply-chain baseline | 0 | S |
| 03 | issues/03-app-shell-i18n.md | App shell: routing, theme, i18n, settings skeleton | 0 | M |
| 04 | issues/04-domain-model-schemas.md | Domain entities & zod schemas | 0 | M |
| 05 | issues/05-storage-layer.md | IndexedDB storage layer (Dexie) + blob GC + quota | 0 | M |
| 06 | issues/06-image-acquisition.md | Image acquisition + metadata-stripping re-encode | 1 | M |
| 07 | issues/07-crop-rotate-editor.md | Crop & rotate editor step | 1 | S |
| 08 | issues/08-auto-segmentation.md | Auto-segmentation worker (segment() port) | 1 | M |
| 09 | issues/09-mask-editor.md | Mask editor UI + cutout texture output | 1 | L |
| 10 | issues/10-pose-model-pipeline-spike.md | SPIKE: pose model → ONNX pipeline + vendored artifact | 1 | L |
| 11 | issues/11-pose-inference-runtime.md | Pose inference runtime (loader, hash verify, worker) | 1 | M |
| 12 | issues/12-joint-editor-mapping.md | Joint editor + COCO-17→skeleton mapping + template pose | 1 | L |
| 13 | issues/13-rig-builder.md | Rig builder: mesh + LBS weights | 1 | L |
| 14 | issues/14-motion-pipeline-library.md | Motion pipeline (BVH→JSON) + 10-clip library + license audit | 2 | M |
| 15 | issues/15-animation-engine.md | Animation engine: player, FK, skinning, Pixi mesh | 2 | L |
| 16 | issues/16-stage-mode.md | Stage mode screen + background assets | 2 | M |
| 17 | issues/17-effects-library.md | Procedural effects + particles + cutout mode | 2 | M |
| 18 | issues/18-book-editor-shell.md | Book editor shell: list, pages, reorder, autosave | 3 | M |
| 19 | issues/19-page-composer-suggestion.md | Page composer + motion suggestion engine | 3 | M |
| 20 | issues/20-narration-recording.md | Narration recording per page | 3 | M |
| 21 | issues/21-book-player.md | Book player (kid mode) | 3 | M |
| 22 | issues/22-export-import-bundle.md | `.inkstory` export/import (hostile-input hardened) | 4 | L |
| 23 | issues/23-pwa-offline.md | PWA: offline, model cache, install, durability | 4 | M |
| 24 | issues/24-security-hardening.md | Security hardening: CSP, headers, integrity, guards | 4 | M |
| 25 | issues/25-sample-content-onboarding.md | Sample content & first-run onboarding | 4 | S |
| 26 | issues/26-a11y-kid-ui-pass.md | Accessibility & kid-safety UI pass | 4 | M |
| 27 | issues/27-e2e-suite.md | E2E suite: golden paths, malicious imports, network audit, perf smoke | 4 | L |
| 28 | issues/28-docs-release.md | Docs & release: guides, privacy statement, SECURITY.md, deploy | 4 | M |
| 29 | issues/29-v2-mobile-scoping.md | v2 scoping: native mobile apps study | 5 | M |

## 3. Dependency table

`A ← B` means A depends on B. "soft" = improves the result but must not block.

| Issue | Depends on |
|---|---|
| 01 | — |
| 02 | 01 |
| 03 | 01 |
| 04 | 01 |
| 05 | 04 |
| 06 | 03, 05 |
| 07 | 06 |
| 08 | 04, 06 |
| 09 | 08 |
| 10 | 01 (independent spike; start in Wave 0/1 in parallel) |
| 11 | 03, 10 |
| 12 | 04, 09 (soft: 11) |
| 13 | 09, 12 |
| 14 | 01 |
| 15 | 13, 14 |
| 16 | 15, 17 |
| 17 | 15 |
| 18 | 03, 05 |
| 19 | 14, 15, 18 |
| 20 | 05, 18 |
| 21 | 17, 19, 20 |
| 22 | 04, 05 |
| 23 | 03 (soft: 11 — model cache) |
| 24 | 02, 11, 23 |
| 25 | 16, 21 |
| 26 | 16, 19, 21 |
| 27 | 16, 21, 22, 25 |
| 28 | 23, 24 |
| 29 | — (post-v1; needs v1 architecture as input) |

Critical path: 01 → 04 → 05 → 06 → 08 → 09 → 12 → 13 → 15 → 19/17 → 21 → 27 → 28.
Issue 10 is deliberately **off** the critical path (ADR-004): 12/13 use the template
pose; 11 plugs the model in when ready.

## 4. Implementation waves

| Wave | Goal / exit gate |
|---|---|
| 0 — Foundation (01–05) | CI green on scaffold; schemas + storage unit-tested. |
| 1 — Drawing → Character (06–13; 10 in parallel) | E2E: fixture photo → cutout → joints (manual path, no model) → rig persisted. |
| 2 — Motion & Stage (14–17) | Stage plays 10 clips + effects at perf budget (DESIGN §9.4). |
| 3 — Book mode (18–21) | E2E: create book → 3 pages with text/motion/narration → fullscreen playback. |
| 4 — Ship (22–28) | Release checklist: malicious-import suite green, zero-cross-origin test green, budgets met, docs complete, Pages deploy from tag. |
| 5 — Post-v1 (29) | v2 mobile scoping doc merged. |

## 5. Coverage: DESIGN.md § → issues

| DESIGN section | Issues |
|---|---|
| §4.1 module map / §4.2 threading | 01, 03, 08, 11 |
| §5.1 wizard state machine | 06, 07, 09, 12 (integration owner: 12) |
| §5.2 auto-segmentation | 08 |
| §5.3 mask editor | 09 |
| §5.4 pose + mapping | 10, 11, 12 |
| §5.5 joint editor | 12 |
| §5.6 rig build | 13 |
| §6.1 skeleton | 12, 13, 14 |
| §6.2 motion format / §6.3 library | 14 |
| §6.4 effects & cutout mode | 17 |
| §6.5 playback engine | 15 |
| §6.6 stage mode | 16 |
| §7.1 entities | 04 |
| §7.2 IndexedDB / GC / quota | 05 |
| §7.3 export/import bundle | 22 |
| §8.1 routes / §8.7 i18n & a11y | 03, 26 |
| §8.2 book editor / §8.3 suggestion / §8.4 layout | 18, 19 |
| §8.5 narration | 20 |
| §8.6 player | 21 |
| §9.1–9.3 PWA/offline/isolation | 23, 24 |
| §9.4 budgets | 15, 23, 27 |
| §10 security & privacy | 02, 04, 05, 06, 11, 20, 22, 23, 24, 27, 28 |
| §11 distribution | 28 |
| §12 testing strategy | 01, 02, 27 (+ per-issue Validation) |
| §13 risks | 10, 13, 14, 23 |

Every normative DESIGN section is owned by at least one issue; no v1 behavior exists
only in prose.

## 6. Product-wide validation strategy

1. **Per-issue gates** — every issue defines Acceptance Criteria + a Validation recipe
   (commands, fixtures, budgets); CI (issue 02) enforces lint/typecheck/unit on every PR.
2. **Wave exit gates** — table in §4; a wave is done only when its gate scenario passes
   on chromium **and** webkit (Playwright).
3. **Security validation** — the DESIGN §10.3 control table is executable: each control
   maps to a test (malicious-bundle corpus in 22/27, network-audit test in 27, CSP/header
   checks + lint guards in 24, audit gate in 02). A release is blocked if any §10.3
   control lacks its passing test.
4. **Privacy validation** — `test:privacy` (27): Playwright intercepts all requests over
   full golden paths and fails on any non-same-origin request.
5. **Performance validation** — §9.4 budgets asserted in 15 (fps probe), 23 (bundle
   size), 27 (CI smoke on chromium; manual matrix on real devices pre-release, checklist
   in 28).
6. **Manual pre-release matrix** (28): iOS Safari (installed PWA), Android Chrome,
   desktop Chrome/Firefox/Safari — golden path + storage-durability behaviors that
   automation cannot cover.

## 7. Deferred v2 items

| Item | Notes |
|---|---|
| Native mobile apps | Scoping issue 29 (product-owner decision 2026-07-07: v2 target); likely Capacitor wrapper reusing the web core vs Expo rewrite — decided by the study |
| ARAP deformation upgrade | ADR-003; rig format already carries what it needs |
| Video/GIF export of scenes & books | wants WebCodecs research |
| BYO-API-key story generation + consent UX | requires ADR revision of ADR-005 boundaries |
| Local TTS (Web Speech, `localService`-only) | codec/voice availability audit first |
| Multi-character pages & free layout | data model extension (Page.characters[]) |
| Motion editor / custom motions | depends on motion format stability |
| Additional locales beyond ja/en | i18n scaffold already supports |

## 8. Known unknowns (may spawn new issues during implementation)

| Unknown | Where it lands |
|---|---|
| ONNX conversion outcome: opset gaps, final size, ORT-web compat | Spike 10; fallback ladder ADR-004 keeps release unblocked |
| Per-clip license/attribution results for CMU/Rokoko BVH files | 14 — if any clip fails audit, replace clip (library composition may change) |
| Minimal CSP that keeps ORT-web + Pixi functional (`wasm-unsafe-eval` etc.) | 24 |
| **Single-SW conflict:** coi-serviceworker and the Workbox SW share one scope — COI header injection must be merged into the Workbox SW (injectManifest) for GitHub Pages | 23/24 — flagged so implementers don't ship two competing SWs |
| Real iOS eviction/persist() behavior on installed PWA | 23 + manual matrix in 28 |
| cdt2d robustness on pathological contours | 13 grid-mesh fallback; may need epsilon tuning |
| Playwright-webkit parity for MediaRecorder/camera emulation | 27 — some paths may be chromium-only in CI, moved to the manual matrix |
| Segmentation params on phone photos of pencil drawings | 08 fixtures; params may need exposure as "sensitivity" control in 09 |
