# 編入対策 学習進捗ダッシュボード

電気通信大学 情報理工学域Ⅰ類 3年次編入対策のための、**個人用・学習進捗管理アプリ**です。
「今どこまで終わったか / あと何が残っているか / 今日何をやるか / 試験まであと何日か」を
一目で把握することに特化しています。学習教材そのものではありません。

- 完全ローカル動作（IndexedDB）。ブラウザを閉じてもデータは保持されます。
- ダークモード基調のモダンな UI。PC / スマートフォン両対応の完全レスポンシブ。
- PWA 対応。ホーム画面に追加してネイティブアプリのように使えます。
- サーバー不要。将来 Supabase などへ移行しやすいよう、データアクセス層と UI を分離しています。

---

## 起動方法

前提: Node.js 20.9 以上（推奨 20 LTS / 22 LTS）。

```bash
cd henyu-dashboard
npm install
npm run dev
```

`http://localhost:3000` を開きます。初回起動時に数学ロードマップ（7 分野・94 単元）が
自動生成され、初期セットアップ画面へ遷移します。

### 本番ビルド / 起動

```bash
npm run build   # next build --webpack（Serwist が Service Worker を生成）
npm run start   # http://localhost:3000 で配信
```

> ビルドは Webpack を明示指定しています。`@serwist/next` が Service Worker を生成するのに
> Webpack が必要なためです。開発サーバー（`npm run dev`）は Turbopack で動作し、
> Service Worker は無効です。

### その他のスクリプト

| コマンド            | 内容                                      |
| ------------------- | ----------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` による型チェック           |
| `npm run lint`      | ESLint（Flat Config）                     |
| `npm run format`    | Prettier で整形                           |
| `npm run test`      | Vitest（ユニット / IndexedDB 結合テスト） |

---

## 技術構成

| 分類           | 採用技術                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| フレームワーク | Next.js 16（App Router）                                                 |
| 言語           | TypeScript（`strict` + `noUncheckedIndexedAccess`）                      |
| UI             | React 19 / Tailwind CSS v4                                               |
| コンポーネント | shadcn/ui 流のプリミティブを **Base UI**（`@base-ui/react`）ベースで自作 |
| アイコン       | lucide-react                                                             |
| グラフ         | Recharts                                                                 |
| ローカル DB    | Dexie.js（IndexedDB）                                                    |
| PWA            | Serwist（`@serwist/next`）                                               |
| テスト         | Vitest + Testing Library + fake-indexeddb                                |
| Lint / Format  | ESLint（`eslint-config-next` Flat Config）/ Prettier                     |

主要パッケージは実装時点の互換性のある最新安定版を使用しています
（`browserslist` はセキュリティ修正版に `overrides` で固定）。

### 画面構成

| ルート       | 内容                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `/`          | ダッシュボード（試験カウントダウン / 総合進捗 / 今日の目標 / 次にやること / 最近の進捗） |
| `/today`     | 今日やることに集中するページ（目標・対象単元・復習候補・タイマー）                       |
| `/roadmap`   | ロードマップ可視化 + 分野・単元の一覧 / 追加 / 名前変更 / 並び替え / 削除                |
| `/analytics` | 週間・月間学習時間、分野別内訳、進捗推移、過去問得点推移（Recharts）                     |
| `/review`    | 固定間隔（1・3・7・14・30 日）の復習キューと苦手単元                                     |
| `/settings`  | 試験日・学習目標・テーマ・バックアップ・初期化                                           |
| `/setup`     | 初回セットアップ（学習済み単元の申告）                                                   |

### ディレクトリ

```
src/
  app/                    App Router のルート・レイアウト・PWA manifest・Service Worker
    (dashboard)/          サイドバー付きの主要画面グループ
  components/
    ui/                   Base UI ベースの汎用プリミティブ（button, dialog, select, ...）
    layout/               サイドバー・トップバー・モバイルナビ
    dashboard/ today/ roadmap/ analytics/ review/ weakness/  各機能の画面部品
    providers/            テーマ / リポジトリ初期化 / タイマーの Context
  hooks/                  useLive（Dexie live query ラッパ）・useTimer など
  lib/
    types.ts              ドメイン型（Subject → Category → Topic の一般化階層）
    progress.ts           進捗率の加重計算（純関数）
    review-schedule.ts    復習間隔ロジック（純関数）
    analytics.ts          集計・進捗推移の再構築・苦手判定（純関数）
    db/
      schema.ts           Dexie スキーマ定義
      seed.ts             初期数学ロードマップ
      repository.ts       DataRepository インターフェース（UI が依存する唯一の窓口）
      dexie-repository.ts  IndexedDB 実装
```

---

## データ保存方式

すべてのデータはブラウザの **IndexedDB** に保存され、`Dexie.js` 経由でアクセスします。
`localStorage` は「実行中タイマーの一時保持」「テーマ選択」のみに使用し、
学習データの正本にはしていません。

テーブル（Dexie stores）:

`subjects` / `categories` / `topics` / `studySessions` / `reviews` /
`dailyGoals` / `examScores` / `settings` / `activityLogs`

- `topic` は `id / categoryId / name / description / status / weight / order /
createdAt / updatedAt / lastStudiedAt` などを保持します。
- 進捗率は単元の 5 段階ステータス（未学習 0 / 学習中 25 / 基本OK 50 / 定着 75 /
  過去問レベル 100）と単元ごとの重要度 `weight` から自動計算されます（初期値は全て `weight = 1`）。
- `settings` に `schemaVersion` を保持し、バックアップの互換性チェックに使用します。

### 読み込み中のちらつき防止

アプリ全体は `RepositoryProvider` が IndexedDB のオープンとロードマップの初回シード完了まで
描画をブロックします。準備完了後に一度だけツリーがマウントされるため、
初期化前の未確定データが一瞬表示されることはありません。

---

## バックアップ方法（重要）

`設定 → バックアップ` から操作します。

- **エクスポート**: 全テーブルを 1 つの JSON ファイル
  （`henyu-backup-YYYY-MM-DD-HH-MM-SS.json`）としてダウンロードします。
  コマンドパレット（`Cmd/Ctrl + K` →「バックアップをエクスポート」）からも実行できます。
- **インポート**: JSON を選択すると、**取り込み前に確認画面**が表示されます。
  各テーブルの件数・エクスポート日時・`schemaVersion` の不一致警告を確認してから
  「置き換えて取り込む」を押すと、現在のデータをすべて置き換えます。
- **初期化**: 全データを削除し、数学ロードマップだけの初期状態に戻します
  （確認のため「削除」と入力する必要があります）。

定期的にエクスポートして、別の場所へ保管することを推奨します。

---

## 将来的な Supabase 移行方針

UI は Dexie を直接触らず、常に `src/lib/db/repository.ts` の
`DataRepository` インターフェース経由でデータへアクセスします。

移行時にやること:

1. `SupabaseRepository implements DataRepository` を 1 ファイル追加する。
   （読み取りメソッドは `Promise` を返すだけなので、そのまま Supabase クエリに置き換え可能）
2. `src/lib/db/index.ts` の `getRepository()` が返すインスタンスを差し替える。
3. リアクティブ層（`src/hooks/use-live.ts`。現状は Dexie の `useLiveQuery`）を
   Supabase Realtime 購読に置き換える。呼び出し側（各画面）は変更不要。
4. 型は `src/lib/types.ts` をそのまま共有できる。テーブル名も一致させてあるため、
   スキーマ移行は `BackupFile` の構造をそのまま流用できる。

進捗率・復習間隔・集計・苦手判定はすべて `src/lib/` 内の純関数として実装されており、
保存先に依存しません。

---

## 実装済みの完成条件

- アプリ起動 / 初期数学ロードマップ生成 / 単元一覧表示 / ステータス変更
- 進捗率の自動計算（加重対応） / ダッシュボード表示 / 今日の目標設定
- 学習時間記録（タイマー + 手動入力） / 復習候補表示 / Analytics グラフ表示
- IndexedDB への永続保存 / JSON バックアップ・復元
- PWA としてインストール可能 / PC・スマホ両対応

## 意図的に実装していないもの

SNS / フレンド / ランキング / AI チャット / AI 問題生成 / 課金 / 広告 /
複雑なアカウント管理 / 過剰なゲーミフィケーション・アニメーション。
