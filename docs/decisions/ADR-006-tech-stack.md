# ADR-006: v1 technology stack

Date: 2026-07-08
Status: Accepted

## Context

Issues must be executable by lower-capability agents, so the stack is fixed up front,
choosing widely-documented mainstream libraries with permissive licenses.

## Decision

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | single language across app + tools |
| Build | Vite | static SPA output |
| UI | React 18+ | function components only |
| Routing | react-router | routes listed in DESIGN §8.1 |
| State | Zustand | per-feature stores; no Redux |
| Persistence | Dexie (IndexedDB) | schema in DESIGN §7.2 |
| Schema validation | zod (strict mode) | single source of parse/validate at all boundaries |
| Rendering | PixiJS v8 | WebGPU→WebGL auto-fallback; mesh vertex updates |
| Inference | onnxruntime-web | ADR-004 |
| Triangulation | cdt2d (constrained Delaunay) | fallback strategy in issue 13 |
| Zip (export/import) | fflate | streaming-capable, small |
| i18n | i18next + react-i18next | `ja` (default), `en` |
| PWA | vite-plugin-pwa (Workbox) | + coi-serviceworker for GH Pages |
| Unit/component tests | Vitest + Testing Library + fake-indexeddb | |
| E2E | Playwright (chromium + webkit) | |
| Lint/format | ESLint (typescript-eslint) + Prettier | CI-enforced |
| Package manager | pnpm | lockfile committed; CI uses `--frozen-lockfile` |
| CSS | CSS Modules | no runtime CSS-in-JS → keeps CSP free of `'unsafe-inline'` styles if feasible (verified in issue 24) |
| License | MIT | matches upstream assets |

Node.js LTS (≥20) for tooling. No other runtime dependencies without an ADR update;
dependency budget is deliberately small (supply-chain surface, DESIGN §10.6).

## Consequences

- Weak-agent-friendly: every choice has abundant documentation and stable APIs.
- PixiJS + ORT-web are the two heavyweight deps; both are lazy-loaded routes/chunks so
  the app shell stays within the ≤300 KB gz initial-JS budget (DESIGN §9.4).
