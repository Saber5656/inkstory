# Title

Documentation and release: user guide, self-hosting guide, privacy statement, SECURITY.md, deploy workflow

## Summary

Ship the public face of the project: end-user guide (ja/en), self-hosting guide with
the header matrix, plain-language privacy statement, SECURITY.md policy, README
rewrite, GitHub Pages deploy workflow, versioning/changelog, and the release checklist
that ties every gate together.

## Context

inkstory is OSS intended for public release; trust depends on documentation matching
the verifiable behavior (ADR-005, DESIGN §10–§11). Release = tag-driven deploy,
separate from merge (repo policy).

## Scope

`README.md`, `docs/guide/` (user guide ja/en), `docs/self-hosting.md`,
`docs/privacy.md` (+ `/about` in-app rendering source), `SECURITY.md`,
`CHANGELOG.md`, `.github/workflows/deploy.yml`, `docs/ops/release-checklist.md`.

## Detailed Requirements

1. README rewrite (en primary + 日本語 section): what/why, screenshots/GIF from sample
   content, feature list, privacy pledge (one paragraph linking privacy.md), quickstart
   (hosted URL + self-host pointer), development setup, license + upstream credits
   (AnimatedDrawings MIT, motion CREDITS.md link).
2. User guide (`docs/guide/{ja,en}/`): photographing tips (lighting, plain background,
   fill the frame), wizard walkthrough incl. fixing mask/joints, stage mode, making a
   book + recording narration, backup/restore (.inkstory), troubleshooting (camera
   permission, storage eviction warning, model download on slow networks). Written for
   non-technical parents; screenshots from the sample flow.
3. `docs/privacy.md` (ja/en, also rendered at `/about`): everything stays on the
   device; enumerate exactly what is stored where (IndexedDB items), what export files
   contain, the no-telemetry pledge, and how to verify (`pnpm test:privacy`, CSP,
   dist-scan) — auditable claims only, matching 24's SECURITY-CONTROLS.md.
4. `SECURITY.md`: supported versions, private reporting via GitHub security
   advisories, response-time expectation, scope notes (client-only app; hosting
   operator responsibilities), link to threat model (DESIGN §10).
5. `docs/self-hosting.md`: build (`pnpm build`), serve `dist/` on any static server,
   HTTPS requirement (camera/mic/SW), header matrix incl. nginx/Caddy/_headers
   snippets from 24, the three COI variants and when they matter, update strategy.
6. `deploy.yml`: on version tag `v*` — build with `VITE_COI=sw` + `VITE_CSP=meta`,
   run full CI gates (reuse workflow via `workflow_call`), deploy to GitHub Pages via
   official actions (SHA-pinned, OIDC, `permissions` minimal); environment `production`
   with required-reviewer note documented for the human admin (settings are manual —
   record in `docs/ops/branch-protection.md` from 02).
7. Versioning: semver; `CHANGELOG.md` Keep-a-Changelog format seeded with v1.0.0
   sections; app displays the version (03) sourced from package.json at build.
8. `docs/ops/release-checklist.md`: machine-gates (CI, e2e, privacy, perf, budgets,
   SECURITY-CONTROLS all green) + manual matrix (iOS Safari installed-PWA, Android
   Chrome, desktop Chrome/Firefox/Safari: golden paths, storage persistence behavior,
   camera/mic) + docs freshness check; releasing = checklist PR + tag.

## Acceptance Criteria

- A tag push on a test tag (e.g. `v0.9.9-rc`) deploys to Pages; deployed app passes a
  smoke run (path A manual) on the live URL; `crossOriginIsolated` true on chromium.
- Every claim in privacy.md maps to a verifiable artifact (table with links) — reviewed
  against 24's inventory.
- Guides complete in both languages; screenshots present; lint (markdown + link check
  in CI) green.
- Release checklist dry-run executed once end-to-end and annotated.

## Validation

Test-tag deployment run URL + live smoke notes in PR; link-checker CI step green;
docs reviewed side-by-side with the running app.

## Dependencies

23, 24 (content inputs from nearly all issues; runs last).

## Non-goals

Marketing site, localization beyond ja/en, store listings (v2 mobile), blog posts.

## Design References

DESIGN.md §10.5–§10.6, §11; ADR-001, ADR-005; ISSUE_PLAN §6; docs/research/03
(hosting matrix).
