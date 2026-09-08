# inkstory

inkstory turns a child's paper drawing into a moving picture-book character. The MVP is a client-only web app: image processing, pose assistance, animation, books, and narration run in the browser, and the data is kept in the device's IndexedDB. There is no account, sync service, analytics, or cloud AI.

> **Release status (2026-09-08):** the repository contains the MVP implementation. A hosted URL, production deployment, CI run, and manual device smoke test are still pending. Do not treat this checkout as a verified public release.

## What you can do

- Import a photo or camera image, correct its crop, and rotate it.
- Remove the paper background with automatic segmentation, then repair the mask with a brush, erase, undo, or re-run.
- Choose humanoid rigging with 16 editable joints, or use cutout mode for any drawing.
- Place a character on a stage with bundled motions and backgrounds.
- Create a multi-page book with text, motion, and an optional up-to-60-second narration.
- Export and import an `.inkstory` backup bundle.
- Install the app as a PWA and use the cached shell offline after the first load (browser support and storage durability vary).

The pose model is optional. When it is absent or unavailable, the template-pose and joint editor remain the supported path.

## Try it locally

Requirements: Node.js 20 or newer and pnpm 10.34.5.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The production checks are:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:build
pnpm test:e2e
pnpm test:privacy
```

The last three commands require a built app and a browser environment. Their execution is not recorded as a completed CI or device release gate in this checkout.

## Documentation

- [Parent guide (English)](docs/guide/en/README.md) · [保護者向けガイド (日本語)](docs/guide/ja/README.md)
- [Privacy statement](docs/privacy.md)
- [Self-hosting](docs/self-hosting.md)
- [Security policy](SECURITY.md)
- [Release checklist](docs/ops/release-checklist.md)
- [Mobile v2 study](docs/DESIGN-mobile.md) · [ADR-007](docs/decisions/ADR-007-mobile-approach.md)

## Privacy pledge

Your drawings, photos, rig data, books, and narration stay on the device in this MVP. The app does not provide an account or upload endpoint, and the repository provides a built-bundle scan for cross-origin network calls. This is a software behavior claim with browser and hosting limits; read the [privacy statement](docs/privacy.md) and make an export backup before clearing browser data or changing devices.

## Screenshots

Screenshots of the sample flow are intentionally left for the release owner to add after the manual smoke run. No screenshot in this repository is presented as a verified device result.

<!-- Screenshot placeholders: library, capture/crop, mask editor, stage, book player. -->

## Credits and license

inkstory is MIT licensed; see [LICENSE](LICENSE). The humanoid animation approach is based on the MIT-licensed [Animated Drawings](https://github.com/facebookresearch/AnimatedDrawings) project. Motion attribution is maintained in [public/motions/CREDITS.md](public/motions/CREDITS.md).

## 日本語

inkstory は、子どもの紙の絵を動く絵本のキャラクターにします。MVP はブラウザだけで動く web アプリです。写真の処理、関節の補助、アニメーション、絵本、録音は端末内で行い、データはブラウザの IndexedDB に保存します。アカウント、同期、分析、クラウド AI はありません。

カメラまたは画像ファイルを取り込み、切り抜きと背景マスクを直し、16 関節の humanoid または cutout として保存できます。ステージでは動きを再生し、絵本では文章と任意のナレーションをページごとに設定できます。設定画面から `.inkstory` バックアップを作成・復元してください。

ホスト URL、公開 deploy、CI、実機の手動確認はまだ完了していません。詳しい手順は[日本語ガイド](docs/guide/ja/README.md)、保存内容は[プライバシー声明](docs/privacy.md)を参照してください。
