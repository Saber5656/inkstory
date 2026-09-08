# Privacy statement

_Last reviewed: 2026-09-08. [日本語版](privacy.ja.md). This statement describes the current MVP source and is not a promise about an unreviewed fork or hosting configuration._

inkstory is designed for drawings made with children. In the MVP, there is no account, upload API, server database, telemetry, advertising, analytics, or crash-reporting SDK. Image processing, segmentation, pose assistance, rigging, animation, books, and narration run in the browser. The app's same-origin static assets and optional service-worker cache are the only intended network activity. A browser still controls permissions, caches, storage eviction, extensions, and the host's response headers.

## What is stored

The current database is an IndexedDB database named `inkstory` (Dexie schema version 1). Records are local to the browser profile and origin.

| Store | Contents | User data |
| --- | --- | --- |
| `blobs` | Blob bytes referenced by IDs | Re-encoded source images, cutout textures, thumbnails, and narration audio |
| `drawings` | Drawing metadata and blob references | Creation/update times, image reference and image dimensions |
| `characters` | Name, rig type, rig JSON, effect preferences, blob references | Character names and 16-joint/mesh data |
| `books` | Book title and timestamps | Story title |
| `pages` | Book relation, one character/background, text, motion, narration reference, advance mode | Story text and narration metadata |
| `settings` | Locale, sample IDs, and local preferences | Language and local app preferences |

Imported images are decoded and re-encoded before storage. That applies the image orientation and drops EXIF metadata such as GPS; the original file object is not persisted. Microphone permission is requested only when recording. The recorder uses one audio channel, stops tracks after stop/cancel, and limits a recording to 60 seconds and 20 MiB.

## Export and deletion

The `.inkstory` export is a ZIP containing `manifest.json`, character metadata and rig JSON, `texture.png`, `thumb.png`, book/page JSON, and narration binaries. The current exporter reads the source drawing blob to validate it but does not put the original drawing file in the archive. Export bundles therefore do not replace a separately retained original photo.

Deleting records through the app removes their referenced local blobs according to the storage layer's garbage-collection rules. Clearing site data, browser data, or the app's origin removes local data. Export before those actions. A self-host operator may have ordinary HTTP access logs; the app does not send the local records to that operator.

## No-telemetry pledge and audit trail

The repository does not intentionally add analytics, advertising, accounts, or remote AI. This is auditable rather than a claim that every browser extension or modified fork is harmless. Reviewers can inspect:

- [ADR-001](decisions/ADR-001-client-only-local-first-architecture.md) and [ADR-005](decisions/ADR-005-local-only-data-policy.md) for the product decision.
- [Vite CSP and PWA configuration](../vite.config.ts) and [static headers](../public/_headers).
- `pnpm test:privacy` for the privacy-tagged Playwright checks, and `pnpm check:build` for the built HTML/CSP/cross-origin-call scan.
- `pnpm test` and `pnpm test:e2e` for unit and end-to-end behavior.

The release owner must record the commit, browser, host headers, and results. As of this review, a CI run, live deployment, and manual device audit have not been verified here; commands listed above are audit procedures, not evidence of a passed release.

## Your choices and limits

You can deny camera and microphone permissions, use a file instead of the camera, skip narration, edit or delete local records, and export a backup. Browser storage is not a guaranteed permanent filesystem: request persistence in Settings and keep `.inkstory` backups. Do not put a child's name or private media into a public bug report.

For a mobile wrapper, store privacy labels and OS permission text must be re-evaluated before distribution; see [DESIGN-mobile.md](DESIGN-mobile.md). This document covers the web MVP and does not constitute legal advice about COPPA, GDPR, or a store's required declarations.
