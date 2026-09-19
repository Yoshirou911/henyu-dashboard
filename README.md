# 編入対策 学習進捗ダッシュボード

電気通信大学 情報理工学域Ⅰ類（第一志望）ほか情報系3年次編入のための、**個人用の受験司令塔**です。
記録 → 分析 → 復習 → 優先順位決定 → 今日の勉強 のループを回し、
「次に何を勉強すればいいか」を迷わなくすることが目的です。学習教材そのものではありません。

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

| ルート                        | 内容                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | 受験司令塔：第一志望カウントダウン → 電通大準備度 → 今日やること → 要注意 → 弱点TOP3 → 今月の目標 → 次のマイルストーン → 現在の単元（次に進む条件）→ 編入学習全体 |
| `/today`                      | 今日の推奨学習（使える時間 30/60/90/120/180/カスタム で再計画）・タイマー・今日の復習                                                                             |
| `/review`                     | 優先順位付き復習キュー（期限超過→習熟度→失敗回数→第一志望の重要度→前提単元）・3ボタン入力・予定・履歴                                                             |
| `/subjects`, `/subjects/[id]` | 科目一覧と科目別ダッシュボード（学力の3軸・分野別・今週・弱点・復習・次の単元・単元ごとの記録）                                                                   |
| `/weakness`                   | 全科目横断の弱点ランキングと「改善中」                                                                                                                            |
| `/roadmap`                    | 科目切替つきロードマップ。単元詳細で習熟度内訳・正答率・次に進む条件（手動override）・前提単元を編集                                                              |
| `/goals`                      | 月間目標（前倒し/予定通り/少し遅れ/大幅遅れ）とマイルストーン                                                                                                     |
| `/universities`               | 志望校10校・準備度・必要科目/重要度/配点の重みを編集                                                                                                              |
| `/exams`                      | 編入過去問（大問ごとの単元と○△×）と模試（偏差値・順位・失点単元）                                                                                                 |
| `/analytics`                  | 週間/月間学習時間、科目別・分野別内訳、進捗推移                                                                                                                   |
| `/settings`                   | 第一志望の試験日、科目配分、科目の追加/並び替え/非表示/アーカイブ、受験科目テンプレート追加、バックアップ                                                         |
| `/setup`                      | 初回セットアップ                                                                                                                                                  |

### ディレクトリ

```
src/
  app/                    App Router のルート・レイアウト・PWA manifest・Service Worker
  components/             画面部品（dashboard / today / review / subjects / weakness / roadmap /
                          goals / universities / exams / planner / record / settings / ui …）
  hooks/
    use-study-model.ts    全派生値（下記エンジン）を1か所で計算して全画面に配る
    use-timer.tsx         学習タイマー（予定時間つき・終了時に記録ダイアログ）
  lib/
    types.ts              ドメイン型（Subject → Category → Topic の一般化階層）
    mastery/              accuracy.ts / calculateMastery.ts / readyForNext.ts
    weakness/             calculateWeakness.ts
    planner/              calculatePriority.ts / subjectAllocation.ts / buildTodayPlan.ts
    readiness/            universityReadiness.ts
    review/               prioritizeReviews.ts （＋ lib/review-schedule.ts）
    goals/                monthlyProgress.ts
    model/                snapshot.ts / buildStudyModel.ts（エンジンの統合）
    db/
      schema.ts           Dexie スキーマ（version 1 / 2）
      seed.ts             8科目テンプレート・前提単元・志望校・科目配分の初期値
      repository.ts       DataRepository インターフェース（UI が依存する唯一の窓口）
      dexie-repository.ts IndexedDB 実装＋冪等な migration
```

---

## Phase 2：判断ロジック（すべてルールベース・係数は各ファイルの `*_CONFIG` で変更可）

| ロジック      | ファイル                           | 概要                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正答率        | `mastery/accuracy.ts`              | 累計・**直近（最新20問の窓）**・基本/標準/発展・復習・過去問・模試                                                                                                                                                                                    |
| masteryScore  | `mastery/calculateMastery.ts`      | ステータス基準（0/20/50/75/100）＋直近正答率の期待値との差・基本問題不安定・復習結果・忘却（14/30日）・継続・発展/過去問での得点・過去問/模試の失点。科目タイプ別：問題演習型は正答率重視、語学型は正答率＋学習量、面接型は模擬面接の完成度をブレンド |
| 次へ進む条件  | `mastery/readyForNext.ts`          | 基本問題 直近80%以上 **かつ** 10問以上 **かつ** 基本OKから2日以降の復習70%以上（復習問題がなければ「できた/怪しい/できなかった」で代替）。手動override可                                                                                              |
| weaknessScore | `weakness/calculateWeakness.ts`    | 低正答率・復習失敗/怪しい・時間の割に低習熟・停滞・過去問/模試の失点・復習期限超過（＋他の兆候がある時のみ第一志望の重要度）。改善中＝直近が以前より15pt以上上昇                                                                                      |
| priorityScore | `planner/calculatePriority.ts`     | 上げる：期限超過・低習熟・弱点・第一志望で重要（本番90日以内は×1.5）・今月目標・学習中・次の単元・他単元の前提・低正答率・未学習日数・配分不足。下げる：定着/過去問レベル・前提未完了・高正答率・直近で十分学習・第一志望で不要。**理由テキスト付き** |
| 前提単元      | `model/buildStudyModel.ts`         | 単元の `dependsOn` と、ロードマップ上の前提分野（未着手の単元のみ）を考慮。着手済みの単元はブロックしない                                                                                                                                             |
| 科目配分      | `planner/subjectAllocation.ts`     | 設定の配分（初期：数学60/英語10/TOEIC5/C++5/アルゴ5/物理10/CS3/面接2）と直近7日の実績の差                                                                                                                                                             |
| 今日の計画    | `planner/buildTodayPlan.ts`        | 復習を最大35%まで → 配分×不足率で科目予算 → 優先度順に配置 → **配分10%以上で7日間未学習の科目を強制的に1枠確保**（60分以上・学習履歴がある場合）→ 残りは予備                                                                                          |
| 志望校準備度  | `readiness/universityReadiness.ts` | その大学の必要科目の習熟度を、大学ごとの重みで加重平均。**必要でない科目（例：電通大に対するC++）は準備度を動かさない**                                                                                                                               |
| 学力の3軸     | `learning-dimensions/*`            | 学習範囲（ステータス係数の加重平均）・習熟度（既存 masteryScore の集計）・本番準備度（習熟度×0.5 を基準に、過去問・模試など本番形式の証拠で置き換え。合格可能性ではない）。表示専用で計画には未反映。詳細は `docs/PHASE3_DESIGN.md` §7.1              |
| 月間目標      | `goals/monthlyProgress.ts`         | 単元＋目標ステータス指定なら自動で達成率、自由記述はチェック。経過日数との差で判定                                                                                                                                                                    |

---

## データ保存方式

すべてのデータはブラウザの **IndexedDB** に保存され、`Dexie.js` 経由でアクセスします。
`localStorage` は「実行中タイマーの一時保持」「テーマ選択」のみに使用します。

保存するのは**事実だけ**です。正答率・masteryScore・weaknessScore・準備度・今日の計画などの
再計算可能な値はDBに保存せず、`buildStudyModel` が毎回計算します。

| テーブル                                       | 内容                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `subjects` / `categories` / `topics`           | 科目→分野→単元（`evaluationType`、`dependsOn`、`readyOverride`、`hidden`/`archived` を v2 で追加） |
| `studySessions`                                | 学習時間（v2 で `plannedMinutes`）                                                                 |
| `exerciseResults`                              | 問題演習結果（topicId・日付・問題数・正解数・difficulty・type・memo）                              |
| `reviews`                                      | 復習スケジュール（1・3・7・14・30日）                                                              |
| `dailyGoals`                                   | 今日の目標・今日使える時間                                                                         |
| `universities` / `universityRequirements`      | 志望校と、科目ごとの必須・重要度・重み                                                             |
| `monthlyGoals` / `milestones`                  | 月間目標・長期マイルストーン                                                                       |
| `mockExams` / `pastExams` / `pastExamProblems` | 模試・編入過去問・大問ごとの結果                                                                   |
| `settings`                                     | `schemaVersion`、第一志望、科目配分、試験日など                                                    |
| `activityLogs`                                 | 最近の進捗タイムライン・進捗推移の再構築                                                           |
| `examScores`                                   | Phase 1 の過去問得点（互換のため保持。`pastExams` へ移行済み）                                     |

### Migration（schemaVersion 1 → 2）

`DexieRepository.initialize()` が `settings.schemaVersion` を見て冪等に実行します。
既存の科目・単元・ステータス・学習記録・目標には一切触れず、**足りないものだけ追加**します。

1. 受験科目テンプレートのうち未登録の科目だけ追加（数学が登録済みなら数学は重複させない）
2. 既存単元の前提関係（`dependsOn`）を、未設定の場合のみ補完
3. 志望校10校と必要科目を追加（電通大の試験日は既存の設定を引き継ぐ）
4. 科目配分の初期値を設定
5. Phase 1 の `examScores` を `pastExams` にコピー

v1 のバックアップJSONをインポートした場合も、取り込み後に同じ migration が走ります。
新しいバージョンのアプリで作成されたバックアップは、データ欠落を防ぐため取り込みを拒否します。

検証：`src/lib/db/migration-phase1.test.ts` が、Phase 1 のコード自身で生成した実データ相当のバックアップ
（`src/test/fixtures/phase1-sample.json`・合成データ）を使い、既存行が1件も欠落・変更されないことを確認します。

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

## 実装済みの機能

- **Phase 1**：単元ツリー・5段階ステータス・進捗率・今日の目標・学習タイマー・復習・Analytics・PWA・JSONバックアップ
- **Phase 2**：8科目（数学・物理・英語・TOEIC・C/C++・アルゴリズム・CS基礎・面接）、志望校10校と必要科目/重み、
  志望校準備度、編入学習全体、問題演習結果と正答率、masteryScore、weaknessScore、次へ進む条件、
  復習キュー、今日の推奨学習（使える時間で再計画・科目配分考慮）、月間目標、マイルストーン、模試、編入過去問、
  科目別ダッシュボード、弱点ページ、Phase 1 データの migration

## 意図的に実装していないもの

SNS / フレンド / ランキング / AI チャット / AI 問題生成 / 課金 / 広告 / Supabase移行 /
複雑なアカウント管理 / 過剰なゲーミフィケーション・アニメーション。

将来 AI を足す場合（誤答分析・問題生成・計画の文章化・過去問分析・面接練習）は、
`buildStudyModel` の出力（弱点・理由付きの計画・正答率）を入力にできる構造になっています。
