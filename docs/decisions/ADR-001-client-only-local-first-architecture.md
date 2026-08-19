# ADR-001: Client-only, fully-local web architecture (no backend)

Date: 2026-07-08
Status: Accepted

## Context

inkstory processes children's drawings, photos of paper (which may capture surroundings),
and parents'/children's voice recordings. The product owner decided (requirements Q&A,
2026-07-07): MVP is a web app; data handling policy is **fully local** — no accounts, no
telemetry, no cloud AI. Research (docs/research/02, 03) confirms every pipeline stage can
run in the browser.

## Decision

inkstory v1 is a **static-hostable single-page PWA with no backend service at all**.

- All computation (image processing, pose inference, rigging, animation, audio recording)
  happens in the browser (main thread + Web Workers).
- All data persists in the browser's IndexedDB; backup/transfer is a user-initiated
  `.inkstory` file export/import.
- The only network traffic is same-origin fetching of the app's own static assets
  (HTML/JS/CSS/models/motions). After first load + model cache, the app works offline.
- No analytics, no crash reporting, no external fonts/CDNs, no third-party origins.

## Consequences

Positive:
- Child-data privacy is structural, not policy-based: there is no server to breach and
  nothing to disclose. COPPA/GDPR-style service obligations are avoided because no
  personal data is collected by the operator.
- Hosting = any static file server (GitHub Pages works); self-hosting is trivial;
  operating cost ≈ 0.

Negative / accepted costs:
- No cross-device sync or share links in v1 (export file instead).
- Browser storage can be evicted (esp. iOS) → mitigations per docs/research/03.
- ML must fit browser constraints → fallback ladder per docs/research/02.

## Alternatives rejected

- Local server + web UI (`inkstory serve`): stronger compute, but narrows the audience to
  technical users and complicates camera use from phones.
- Hosted service: heavy child-data compliance and abuse surface; out of scope for OSS v1.
