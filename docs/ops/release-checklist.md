# Release checklist

This checklist is the release gate for the static web MVP. A release is a reviewed checklist plus a version tag; merge alone is not a release. The current document is a dry-run template: no live deployment, CI run, or manual device matrix is verified in this checkout.

## 1. Freeze and review

- [ ] Confirm the version in `package.json`, Settings, changelog, and release notes is the same SemVer value.
- [ ] Confirm only intended files are staged; inspect the diff for secrets, personal paths, private sample media, and unexpected network endpoints.
- [ ] Review [privacy.md](../privacy.md), [SECURITY.md](../../SECURITY.md), and [self-hosting.md](../self-hosting.md) against the actual source and host plan.
- [ ] Add verified screenshots only after the sample flow manual run. Mark missing screenshots as pending.
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

- [ ] Unit tests pass, including domain, capture, vision, pose fallback, rig, storage, exchange, and audio limits.
- [ ] Typecheck and lint pass with zero warnings.
- [ ] Production build succeeds from the frozen lockfile.
- [ ] Built privacy scan and CSP checks pass.
- [ ] Chromium and WebKit Playwright golden paths pass.
- [ ] Privacy-tagged network audit passes with no cross-origin app calls.
- [ ] PWA manifest/service-worker assets are present and model cache limits are understood.
- [ ] Any model manifest/provenance/hash check is recorded; model absence must still pass the manual-joint path.

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

As of 2026-09-08, this repository has no recorded production URL, test-tag deployment, CI result, live-header inspection, or iOS/Android manual smoke run. Those are release prerequisites and remain incomplete. This checklist intentionally does not claim that `pnpm` commands or a live path passed merely because the scripts exist.
