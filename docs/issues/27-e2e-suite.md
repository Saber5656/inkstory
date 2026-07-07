# Title

E2E suite: golden paths, malicious-import corpus, zero-network audit, perf smoke

## Summary

Build the Playwright suite that gates releases: the two golden paths on chromium and
webkit, the hostile-bundle rejection run, the privacy (zero cross-origin network)
audit, and CI perf smoke — wiring everything into CI.

## Context

ISSUE_PLAN §6 defines product-wide validation; this issue implements its automated
core. The privacy audit is the testable form of ADR-005's no-network guarantee.

## Scope

`tests/e2e/` (Playwright config, fixtures wiring, scenarios), CI job additions (02's
workflow), `pnpm test:e2e` and `pnpm test:privacy` scripts.

## Detailed Requirements

1. Infra: Playwright projects `chromium` + `webkit`; static preview server serving the
   production build with the real header set (24's `_headers` emulated by the test
   server); storage state isolated per test; fixture drawings from `tests/fixtures/`
   and the sample content (25).
2. Golden path A (character): fresh profile → dismiss onboarding → wizard with fixture
   photo (file-input injection) → auto mask → brush fix → humanoid → template-pose
   joints adjusted (drag 2 pins) → save → stage: switch motion + background +
   fullscreen. Runs entirely on the **manual path** (no model) and, when the model
   artifact exists (10), a second variant with the model enabled.
3. Golden path B (book): create book → 3 pages (character, backgrounds, text — assert
   suggestion applied for 「じゃんぷ」page) → mock-mic narration on one page
   (chromium fake media stream; webkit variant skips recording, asserts graceful
   no-support/denied path) → play fullscreen with auto-advance → completes at
   "おしまい".
4. Import/export: export from path B's profile → import into a fresh context →
   book plays; then run the full malicious corpus (22) through the import UI —
   each rejected with its reason visible, DB unchanged (count probe via an exposed
   test hook page).
5. **Privacy audit** (`test:privacy`): route interception on `**/*` across golden
   paths A+B+import — any request whose origin ≠ the test server origin fails the
   run (allowlist: none). Also asserts no request occurs after initial load+model
   fetch when replaying path A offline (`context.setOffline`).
6. Perf smoke (chromium CI): stage with 3000-vertex fixture ≥55 fps rolling average
   (probe from 15), wizard step transitions ≤3 s on the runner, initial-JS gzip
   budget re-asserted from the build artifact (23's step reused).
7. CI wiring: `e2e` job in 02's workflow (needs `build`), artifacts on failure
   (trace, video, screenshots); webkit known-gap list (MediaRecorder etc.) maintained
   in-code with `test.fixme` + a generated summary so gaps are visible, feeding the
   manual matrix (28) — per ISSUE_PLAN §8.
8. Flake policy: retries=1 in CI; any test needing >1 retry twice in a week gets an
   issue — note the policy in `tests/e2e/README.md`.

## Acceptance Criteria

- Full suite green on chromium; webkit green outside the declared fixme list.
- Privacy audit fails when a cross-origin `<img>` is planted in a test build
  (self-test of the harness) and passes clean.
- Malicious corpus: 10/10 rejected via UI with zero DB writes.
- CI runtime for the whole e2e job ≤12 min (shard if needed).

## Validation

CI run URL on a PR touching nothing (baseline) + one planted-failure run demonstrating
each guard (privacy, corpus, perf) actually fails when it should.

## Dependencies

16, 21, 22, 25 (infra can start earlier against wave-1 screens).

## Non-goals

Real-device farm automation (manual matrix in 28), visual-regression pixel testing
(golden screenshots only where already specified), load testing (no server exists).

## Design References

DESIGN.md §12, §9.4, §10.3 (Cross-site leakage row); ISSUE_PLAN §6, §8; ADR-005.
