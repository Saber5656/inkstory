# Security policy

## Supported versions

| Version                           | Security fixes                 |
| --------------------------------- | ------------------------------ |
| `0.1.x` (current package version) | Yes                            |
| Older versions                    | Best effort only; update first |

The project is pre-release. A version is considered supported only when the release checklist has a recorded build, browser smoke test, and published artifact.

## Report a vulnerability

Please use [GitHub Private Vulnerability Reporting](https://github.com/Saber5656/inkstory/security/advisories/new). Do not put private photos, children's names, recordings, access tokens, or an exploit that exposes them in a public issue. If private reporting is unavailable, open a minimal issue asking for a private channel and omit sensitive details.

The maintainer will try to acknowledge a report within 7 calendar days, provide an initial severity and reproduction assessment within 14 days, and coordinate a fix or mitigation. These are response targets, not a guarantee. Please allow time for a coordinated release before public disclosure.

## Scope

In scope: the React/Vite application, Web Workers, IndexedDB repositories, image/mask/pose/rig processing, `.inkstory` import/export validation, bundled static assets, PWA service worker, and release configuration.

The app is client-only. A self-hosting operator is responsible for TLS, response headers, DNS, access logs, CDN configuration, and the integrity of files served from their origin. The operator should not add analytics, upload handlers, third-party scripts, or permissive CSP rules.

The threat model and security controls are described in [DESIGN.md §10](docs/DESIGN.md) and [ADR-005](docs/decisions/ADR-005-local-only-data-policy.md). The privacy behavior and verification limits are in [docs/privacy.md](docs/privacy.md).
