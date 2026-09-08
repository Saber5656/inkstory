# Release checklist

This checklist is the release gate for the static web MVP. A release is a reviewed checklist plus a version tag; merge alone is not a release. Implementation checks below record local verification; current hosted checks are linked in [PR #31](https://github.com/Saber5656/inkstory/pull/31). No live deployment or physical-device matrix is claimed.

## 1. Freeze and review

- [x] Confirm the version in `package.json`, Settings, changelog, and release notes is the same SemVer value.
- [x] Confirm only intended files are staged; inspect the diff for secrets, personal paths, private sample media, and unexpected network endpoints.
- [x] Review [privacy.md](../privacy.md), [SECURITY.md](../../SECURITY.md), and [self-hosting.md](../self-hosting.md) against the actual source and host plan.
- [x] Add verified desktop Chromium sample screenshots with the capture environment stated; physical-device screenshots remain pending.
- [ ] Check dependency licenses and [motion credits](../../public/motions/CREDITS.md).

## 2. Machine gates

Run from a clean checkout with Node 20+ and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:build
pnpm test:e2e
pnpm test:privacy
```

Record command output, commit SHA, OS, Node/pnpm versions, and browser versions in the release PR or CI run. `check:build` checks initial JavaScript gzip budget, CSP presence, inline-style policy, and obvious cross-origin calls. It does not prove that a server sends the expected headers.

Required machine evidence:

- [x] Unit tests pass, including domain, capture, vision, pose fallback, rig, storage, exchange, and audio limits.
- [x] Typecheck and lint pass with zero warnings.
- [x] Production build succeeds from the frozen lockfile.
- [x] Built privacy scan and CSP checks pass.
- [x] Chromium and WebKit Playwright golden paths pass.
- [x] Privacy-tagged network audit passes with no cross-origin app calls.
- [x] PWA manifest/service-worker assets are present and model cache limits are understood.
- [x] Any model manifest/provenance/hash check is recorded; model absence must still pass the manual-joint path.

## 3. Manual acceptance matrix

Use a fresh profile and a second profile containing exported data. Record pass/fail, date, device/OS/browser, origin, and evidence link.

| Surface | Golden path | Storage | Media |
| --- | --- | --- | --- |
| Desktop Chrome | sample → character → mask/joints → Stage → book/player | reload, update prompt, export/import | file input, microphone |
| Desktop Firefox | same core path and fallback UI | reload and export/import | file input; note unsupported APIs |
| Desktop Safari | same core path | reload, persistence request, export/import | file input, camera/microphone |
| iOS Safari installed PWA | install → capture → mask/joints → Stage → book/player | background/close/reopen, eviction warning, export/import | camera and microphone |
| Android Chrome installed PWA | same path | background/close/reopen, storage usage, export/import | camera and microphone |

Also verify: portrait layout, keyboard/screen-reader basics, denied permissions, low-storage messaging, corrupt/oversized import rejection, model unavailable fallback, deletion, and no private media in console/network logs.

## 4. Hosting and release

- [ ] Serve `dist/` over HTTPS with SPA fallback.
- [ ] Inspect actual production headers: CSP, `nosniff`, referrer policy, permissions policy, and chosen COI variant.
- [ ] Verify `window.crossOriginIsolated` only if the host intentionally enables COOP/COEP; test all subresources under COEP.
- [ ] Verify service-worker update and rollback behavior without purging IndexedDB.
- [ ] Confirm source maps and logs do not expose private user content.
- [ ] Create the release PR with all evidence and obtain required human review.
- [ ] After approval, create the version tag and record the resulting artifact/live URL. Do not tag before the checklist is complete.

## Current status

As of 2026-09-08, production builds and local browser validation pass. Node 20 integrity tests were reproduced and repaired in the real Node 20 runtime. The hosted build/audit jobs pass; the final hosted result is linked in PR #31. Linux WebKit lacks MediaRecorder, so its explicit recording gap is accompanied by a tested no-recording UI; macOS WebKit passes synthetic recording. Hardware rendering is measured on Apple M4 Metal, while software-only CI explicitly skips the hardware budget.

No production URL, test-tag deployment, live-header inspection, release tag, merge, or iOS/Android manual smoke run is recorded. These release conditions remain incomplete.
