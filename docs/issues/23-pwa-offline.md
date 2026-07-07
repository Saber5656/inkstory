# Title

PWA: service worker, model runtime cache, install promotion, update flow, storage durability UI

## Summary

Make inkstory an installable offline app per DESIGN §9.1–§9.2: Workbox precache via
vite-plugin-pwa, dedicated model cache with progress, update toast, install promotion,
storage persistence/usage UI, and the global storage-full dialog.

## Context

Offline-after-first-load is goal G4. iOS eviction is a top data-loss risk
(docs/research/03) — this issue ships the durability mitigations. The single-SW
constraint with coi-serviceworker (ISSUE_PLAN §8) is resolved here together with
issue 24.

## Scope

`src/pwa/`: SW config (injectManifest), registration + update UI, install promotion,
persistence/usage panel in settings, storage-full dialog (event from issue 05),
diagnostics screen assembly (probes from 11/15).

## Detailed Requirements

1. vite-plugin-pwa in **injectManifest** mode (custom `sw.ts`): Workbox precache of
   app shell (JS/CSS/HTML/backgrounds/motions/effects textures — everything except
   `/models/**`); navigation fallback to `index.html`; cleanup of outdated caches.
2. `/models/**`: cache-first runtime strategy in named cache `models-v1`; first fetch
   shows progress (bytes streamed / manifest size) surfaced where 11's loader runs;
   cache versioning keyed by manifest sha (change → old entry purged).
3. **COI integration seam** (coordinate with 24): `sw.ts` contains a build-flagged
   block replicating coi-serviceworker's COOP/COEP header injection for GH Pages
   builds (`VITE_COI=sw`), so exactly one SW exists (ISSUE_PLAN §8 known unknown —
   implement + document in code comments and self-host guide input to 28).
4. Update flow: `registerSW` with manual prompt — toast 「あたらしい inkstory が
   あるよ」 with apply/later; apply = skipWaiting+reload; toast suppressed while a
   wizard draft, unsaved composer state, or the player route is active (DESIGN §9.1).
5. Manifest (webmanifest): name/short_name (ja default), display `standalone`, portrait
   orientation, theme/background colors from tokens, maskable icons (512/192 original
   artwork — simple ink-blot logo committed as SVG source + exported PNGs), iOS meta
   tags. Install promotion card in settings + a soft banner on `/` after the first
   character is saved: per-platform instructions (iOS = Share→ホーム画面に追加;
   Android/desktop = `beforeinstallprompt` when available) — dismissible, never nags
   again once dismissed (settings key).
6. Durability panel (settings): `persist()` state + request button (05's helper),
   usage meter from `estimate()` (used/quota bar), eviction warning banner when
   `persisted === false` on WebKit (docs/research/03), export shortcut (deep-link to
   22's UI).
7. Storage-full dialog: single global listener for 05's quota event → localized dialog
   offering export (22) and the library for deleting items; shown at most once per
   session per event burst.
8. Offline behavior: airplane-mode reload serves the full app; a character created
   pre-offline animates (models already cached case + model-absent case both fine per
   ADR-004).

## Acceptance Criteria

- Playwright (chromium): load once → go offline (context.setOffline) → reload → full
  golden path on existing data works; model fetch progress visible on first load
  (network throttled).
- Update flow test: new SW waiting → toast → apply reloads with new version string;
  toast suppressed during an active wizard draft (component test).
- Lighthouse PWA category passes (installable, manifest valid) — CI budget step also
  records initial-JS gzip ≤300 KB (DESIGN §9.4) and fails above it.
- Storage panel reflects mocked persist/estimate states; quota event → dialog exactly
  once (test).

## Validation

`pnpm test src/pwa` + Playwright offline scenario; manual iOS: install, use, verify
standalone launch + persistence state — matrix note in PR.

## Dependencies

03 (soft: 11 for real model cache; testable with stub manifest).

## Non-goals

Header/CSP files themselves (24), deploy workflow (28), background sync (none —
ADR-001).

## Design References

DESIGN.md §9.1–§9.4, §10.3 (B4); docs/research/02, 03; ISSUE_PLAN §8 (single-SW);
ADR-004, ADR-005.
