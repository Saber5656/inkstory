# Title

Security hardening: CSP, hosting headers, cross-origin isolation option, integrity manifest, code guards

## Summary

Land the deployable security controls of DESIGN §10: the minimized CSP, per-host header
files, the GH-Pages COI option wired into the single SW, the static-asset integrity
scheme, lint/CI guards, and the machine-checkable control inventory.

## Context

DESIGN §10.3 maps threats→controls; several controls (CSP minimization, headers,
integrity, guards) need one owning issue so they can't be skipped. ISSUE_PLAN §6 makes
releases conditional on every §10.3 control having a passing test.

## Scope

CSP + headers (`public/_headers` for CF/Netlify, `<meta http-equiv>` build fallback,
nginx/caddy snippets for the self-host guide), COI build flag finalization (with 23),
wasm/model integrity checks, ESLint/CI guards, `docs/SECURITY-CONTROLS.md` inventory.

## Detailed Requirements

1. **CSP minimization**: start from DESIGN §10.4 target; empirically derive the
   minimal working policy with ORT-web (wasm) + PixiJS + workers + blob media across
   chromium/webkit; document each required directive with the reason
   (e.g. `'wasm-unsafe-eval'` for ORT). Deliver as: `_headers` (CF Pages/Netlify),
   injected `<meta>` for header-less hosts (build flag `VITE_CSP=meta`), and
   copy-paste nginx + Caddy snippets (handed to 28's guide). Document that `<meta>` CSP
   is a reduced fallback: directives ignored by meta delivery, especially
   `frame-ancestors`, are not claimed as enforced there. Clickjacking/frame protection is
   guaranteed only on hosts that can send real CSP headers, or by a separately documented
   mitigation. `style-src` must not include `'unsafe-inline'` — if a dependency forces
   it, file the finding and gate the exception behind an ADR-006 amendment PR.
2. Additional headers in `_headers`: `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer`,
   `Permissions-Policy: camera=(self), microphone=(self), geolocation=()`,
   COOP/COEP (isolation variant only).
3. COI variants finalized with 23: (a) real headers (CF/Netlify/self-host),
   (b) `VITE_COI=sw` single-SW injection for GH Pages, (c) none (single-thread wasm).
   Diagnostics screen shows the active variant + `crossOriginIsolated`.
4. Integrity: extend 11's model-hash pattern to the ORT wasm binary and any other
   fetched-at-runtime binary asset. The trusted integrity manifest is bundled with the
   reviewed app build, and the ORT wasm path is routed through bytes the app has already
   fetched and hashed before ORT can instantiate them (for example by configuring
   `ort.env.wasm.wasmPaths` or the equivalent loader hook to hashed same-origin assets).
   Hash mismatch → asset treated as unavailable (never executed) + diagnostics entry.
   (Precache assets are covered by SW revisioning; this targets runtime-fetched
   binaries.)
5. Guards: ESLint bans (already: `dangerouslySetInnerHTML`, `eval`) extended with
   `no-restricted-globals/properties` for `fetch` outside `src/pwa|src/pose|src/motion|
   src/render/backgrounds` allowlisted modules (all network goes through the wrapped
   fetch); CI step greps built `dist/` for `http://` and non-self origins in JS
   (allowlist: none) — fails on any hit (belt-and-braces for ADR-005).
6. `docs/SECURITY-CONTROLS.md`: table mirroring DESIGN §10.3 rows → implementing
   module → automated test id → status. This file is the release-gate checklist input
   (28) and must reach "all rows green" here for rows owned by this issue.
7. `pnpm audit` gate and action pinning already exist (02) — verify still green and
   reference them from the inventory.

## Acceptance Criteria

- App fully functions (wizard, stage, book, import/export) under the final CSP on
  chromium + webkit with `VITE_CSP=meta` and with real headers (Playwright runs with a
  local static server injecting headers). The header-run asserts `frame-ancestors 'none'`;
  the meta-run documents that this directive is not enforced by meta CSP.
- CSP violation test: an injected inline `<script>` and a cross-origin fetch attempt
  are blocked (report-only probe test asserting violation events).
- Integrity test: flipping one byte of the ORT wasm (test server) → app degrades to
  model-unavailable path, ORT never instantiates the tampered wasm, diagnostics shows the
  reason.
- dist-scan CI step fails on a planted cross-origin URL fixture; passes clean build.
- `SECURITY-CONTROLS.md` complete with test ids for every §10.3 row owned here.

## Validation

Playwright header/CSP matrix job; manual: GH Pages preview deployment with `VITE_COI=sw`
shows `crossOriginIsolated === true` on chromium — screenshot in PR.

## Dependencies

02, 11, 23.

## Non-goals

SECURITY.md policy + release workflow (28), dependency updates themselves (Dependabot),
threat-model re-write (DESIGN owns it).

## Design References

DESIGN.md §9.3, §10.3–§10.6; docs/research/02 (headers/CSP), 03 (hosting matrix);
ADR-005; ISSUE_PLAN §6, §8.
