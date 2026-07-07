# ADR-005: Local-only data policy — no accounts, no telemetry, EXIF stripping, user-owned backups

Date: 2026-07-08
Status: Accepted

## Context

The product owner selected "fully local" data handling (Q&A 2026-07-07). Data subjects
include children. Photos of paper drawings can embed EXIF GPS coordinates and capture
household surroundings; narration audio contains children's voices.

## Decision

1. **No accounts, no server-side storage, no telemetry/analytics/crash reporting.** The
   app makes no network requests other than same-origin static assets. Enforced by CSP
   (`connect-src 'self'`) and verified by an automated E2E network-audit test (issue 27).
2. **EXIF/metadata stripping at the door:** every imported image is decoded and
   re-encoded (canvas) before storage; original files are never persisted. Orientation is
   applied during re-encode; GPS and all other metadata are discarded (issue 06).
3. **Exports contain only what the user created** (re-encoded images, rig JSON, book
   JSON, narration audio) — never device identifiers, file paths, or timestamps beyond
   creation dates.
4. **Deletion is real:** deleting a character/book deletes referenced blobs (refcount GC,
   issue 05); "delete all data" in settings wipes the IndexedDB database and caches.
5. Storage durability risk (iOS eviction) is mitigated per docs/research/03: persist(),
   install promotion, visible storage usage, first-class export. A privacy statement
   (plain-language, ja/en) documents all of the above (issue 28).

## Consequences

- The operator (and any fork operator) holds zero user data; the OSS project can honestly
  claim "your child's drawings never leave your device".
- No usage metrics → product feedback must come from GitHub issues/discussions; accepted.
- Cloud AI features (story generation, TTS) are impossible in v1 by policy; a
  BYO-API-key design is a v2 discussion item and must arrive with its own consent UX.
