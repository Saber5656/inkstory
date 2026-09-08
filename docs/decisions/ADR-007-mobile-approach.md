# ADR-007: v2 mobile approach

- **Date:** 2026-09-08
- **Status:** Proposed — product-owner decision required
- **Decision owner:** product owner
- **Scope:** v2 mobile distribution; MVP remains web/PWA

## Context

inkstory's accepted MVP architecture is a client-only React/Vite SPA using IndexedDB, Web Workers, ORT-web, PixiJS, and `.inkstory` export/import. Native apps are a v2 target, not an MVP dependency. A native path could improve filesystem durability and media APIs, but it adds OS permissions, signing, store policy, SDK disclosure, and a second release surface. The comparison and current primary sources are in [DESIGN-mobile.md](../DESIGN-mobile.md).

## Options

1. **Capacitor wrapper:** keep the web UI and pure TypeScript engine, add native camera/audio/filesystem plugins, and retain web fallbacks.
2. **Expo/React Native:** share extracted domain/vision/rig/motion/exchange packages while rebuilding screens and likely render/inference adapters.
3. **PWA-only:** improve install UX, offline cache, persistence messaging, and export backup without store binaries.

## Proposed direction

Use **Capacitor as the first prototype**, conditional on explicit product-owner approval for store distribution. Keep PWA-only as the releaseable default until that approval and device evidence exist. Do not begin native production work from this ADR alone.

The prototype must prove: local-only network behavior, native permission explanations, `.inkstory` parity, camera and microphone behavior, storage recovery under pressure, offline asset/model integrity, and a meaningful experience beyond a bare webview. It must also prepare accurate Apple privacy details and Google Play Families/Data safety declarations. See [Apple App Review privacy rules](https://developer.apple.com/app-store/review/guidelines/#5-privacy), [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), and [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335).

## Consequences

Positive:

- Most existing web UI and tested pure logic can be retained.
- Native storage and media adapters can address browser eviction and permission UX.
- The web MVP remains the fallback and migration source through `.inkstory`.

Costs and risks:

- iOS and Android projects, certificates, store review, native plugins, and release signing become operational dependencies.
- A wrapper may be rejected if it is only a webview; native integration must be meaningful and tested.
- Native permissions and SDKs expand the privacy audit and store-label declarations.
- Keeping IndexedDB and native storage in sync requires a versioned migration policy.
- Capacitor, Expo, and PWA performance/size claims remain unmeasured until the prototype runs on representative devices.

## Activation condition

The product owner must approve the approach and store target in a recorded decision. After approval, the team may create the wave 6+ issues in [DESIGN-mobile.md](../DESIGN-mobile.md#draft-v2-issue-breakdown), complete the device prototype and policy inventory, and then replace this ADR's status with Accepted or Superseded. Until then, this ADR is a proposal only.
