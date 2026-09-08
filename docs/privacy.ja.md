# プライバシー声明

_最終確認日: 2026-09-08。現在の MVP のソースを説明する文書であり、未確認の fork やホスト設定を保証しません。_

inkstory は子どもと描いた絵を扱うため、MVP ではアカウント、アップロード API、サーバーデータベース、テレメトリー、広告、分析、クラッシュ収集 SDK を使いません。画像処理、マスク、姿勢補助、rig、アニメーション、絵本、録音はブラウザ内で行います。意図した通信は同一オリジンの静的ファイルと、任意の service worker キャッシュだけです。ブラウザの権限、キャッシュ、ストレージ消去、拡張機能、ホストのレスポンスヘッダーは別途作用します。

## 保存されるもの

現在のデータベースは `inkstory` という IndexedDB（Dexie schema version 1）です。データはブラウザのプロファイルと origin ごとに端末内へ保存されます。

| store | 内容 | ユーザーデータ |
| --- | --- | --- |
| `blobs` | ID で参照する Blob | 正規化済み画像、切り抜き texture、thumbnail、ナレーション音声 |
| `drawings` | 絵のメタデータと Blob 参照 | 作成・更新時刻、画像・mask 参照、寸法 |
| `characters` | 名前、rig type、rig JSON、エフェクト設定、Blob 参照 | キャラクター名、16 関節と mesh データ |
| `books` | 本のタイトルと時刻 | 本のタイトル |
| `pages` | 本との関係、キャラクター、背景、文章、動き、音声参照、送り方 | 文章と録音メタデータ |
| `settings` | 言語、sample ID、端末内設定 | 言語とローカル設定 |

取り込んだ画像は保存前に decode と re-encode を行い、向きを適用して EXIF（GPS を含む）を削除します。元ファイルは保存しません。録音時だけマイク権限を求め、1 チャンネル、最大 60 秒・20 MiB とし、停止またはキャンセルでトラックを解放します。

## エクスポートと削除

`.inkstory` は ZIP で、manifest、キャラクター metadata/rig JSON、`texture.png`、`thumb.png`、本とページの JSON、ナレーション音声を含みます。現行 exporter は元の drawing Blob の存在確認をしますが、元写真ファイル自体は archive に入れません。元写真を残したい場合は別に保管してください。

アプリの削除操作は参照されなくなったローカル Blob を storage layer の GC ルールに従って削除します。サイトデータやブラウザデータを消すと origin のデータも消えます。実行前にエクスポートしてください。self-host operator の通常の HTTP access log はアプリの IndexedDB とは別です。

## 監査方法

[ADR-001](decisions/ADR-001-client-only-local-first-architecture.md)、[ADR-005](decisions/ADR-005-local-only-data-policy.md)、[vite.config.ts](../vite.config.ts)、[public/_headers](../public/_headers)を読み、`pnpm test:privacy` と `pnpm check:build`、`pnpm test`、`pnpm test:e2e` を実行してください。現時点では CI、live deploy、実機監査の結果は未確認です。手順があることと release gate が通ったことを混同しないでください。

カメラ・マイクを拒否する、ファイルを使う、録音を省略する、ローカルデータを削除する、`.inkstory` をバックアップする選択ができます。公開 issue に子どもの名前や私的な画像・音声を貼らないでください。mobile wrapper では OS 権限文と store privacy label を再評価します（[mobile study](DESIGN-mobile.md)）。この文書は法的助言ではありません。
