# Changelog

All notable changes to inkstory are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Parent guides in English and Japanese, self-hosting and privacy documentation.
- A proposed v2 mobile study and ADR-007.

### Pending verification

- Hosted deployment, CI evidence, production headers, screenshots, and manual device smoke runs.

## [0.1.0] - 2026-09-08

This is the package's current pre-release baseline. It includes the client-only MVP implementation:

- Character wizard: capture, normalized image re-encode, crop/rotate, segmentation, mask correction, humanoid/cutout choice, template joints, and preview.
- Local stage and book flows with bundled motion/background content.
- Optional local narration recording with a 60-second and 20 MiB guard.
- IndexedDB persistence and `.inkstory` import/export validation.
- PWA shell, update prompt, storage-persistence request, and model-unavailable fallback.

The version shown in Settings is sourced from `package.json` at build time. This entry does not claim that a public deployment or a manual device acceptance run has completed.

[Unreleased]: https://github.com/Saber5656/inkstory/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Saber5656/inkstory/releases/tag/v0.1.0
