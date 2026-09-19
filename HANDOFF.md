# 引き継ぎメモ（2026-09-19 時点 / Phase 2.6）

新しいセッションは最初にこのファイルと README.md を読めば十分。コードベースの再調査は不要。

## 現状

- 場所: `C:\Users\yoshi\OneDrive\デスクトップ\数学道筋\henyu-dashboard`（親フォルダ名が日本語のためサブフォルダ）
- Phase 1（数学のみ）→ Phase 2（8科目・志望校・mastery/weakness/planner 等）→ Phase 2.5（安定化）→ Phase 2.6（本番運用準備・Phase 3 設計）まで完了
- **Phase 3 の設計は `docs/PHASE3_DESIGN.md`**。Phase 3 着手前に必ず読む（実装順・DB 方針・計画ロジックの既知問題 §9）
- 最新コミット `b5bd5ac`（ローカルのみ。origin より 1 コミット先行）
- **未実施: `git push origin main`**（public リポジトリ。Vercel 連携済みなら本番デプロイが走る）
- typecheck 0 / lint 0 / テスト 105 件成功 / production build 成功 / npm audit 0

## 残タスク（優先順）

1. push するか判断（ユーザー確認待ち）→ 7〜14 日実運用 → バックアップ JSON を持って Phase 3.0a へ（確認項目は設計書 §14）
2. 電通大以外 9 校の必要科目・重みは仮値 → 募集要項で確認し `/universities` から修正（コード変更不要）
3. デプロイ後、記録ダイアログ保存後に閉じるアニメーションが完了するか目視確認（検証時はペイン非表示で未確認）

## 作業ルール（トークン節約）

- 新機能追加は停止中（実運用データ待ち）。バグ・データ消失リスク・実運用を妨げる UX のみ修正
- 計画の配分補正は既知の問題あり（設計書 §9）。実運用データを根拠に 3.0a で直す。根拠なく係数を変えない
- `activityLogs` の `status_change` は Phase 3 の状態履歴（事実データ）。削除・剪定しない
- prettier の一括整形はコミット直前に 1 回だけ（途中でやると差分通知が大量に出る）
- ブラウザ確認は必要な画面だけ。基本は `npm run typecheck` / `npm run lint` / `npm test` / `npm run build`
- push・デプロイは必ずユーザー確認後

## 要点メモ

- ビルドは `next build --webpack`（Serwist 用）。`next.config.ts` の `turbopack: {}` は dev 用で必要
- データアクセスは `src/lib/db/repository.ts` 経由のみ。派生値は `src/lib/model/buildStudyModel.ts` で計算（DB に保存しない）
- migration は `DexieRepository.initialize()` 内で冪等。回帰テスト: `src/lib/db/migration-phase1.test.ts`
- Next 16 の lint は `react-hooks/set-state-in-effect` がエラー扱い。ダイアログのフォーム初期化は「開いている間だけマウントされる子コンポーネント」で行う
- ブラウザプレビュー用の起動設定は親フォルダの `数学道筋/.claude/launch.json`（`dev`, port 3000）
