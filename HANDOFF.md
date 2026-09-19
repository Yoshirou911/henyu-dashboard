# 引き継ぎメモ（2026-09-20 時点 / Phase 3.1）

新しいセッションは最初にこのファイルと README.md を読めば十分。コードベースの再調査は不要。

## 現状

- 場所: `C:\Users\yoshi\OneDrive\デスクトップ\数学道筋\henyu-dashboard`（親フォルダ名が日本語のためサブフォルダ）
- Phase 1（数学のみ）→ Phase 2（8科目・志望校・mastery/weakness/planner 等）→ Phase 2.5（安定化）→ Phase 2.6（本番運用準備・Phase 3 設計）→ Phase 3.0a（今日の計画の配分補正を分数ベースに修正）→ Phase 3.0b（学習速度・必要ペース・予想到達・Deadline Risk の表示。計画には未反映）→ Phase 3.1（学習範囲 / 習熟度 / 本番準備度の 3 軸表示。計画には未反映。設計書 §7.1）まで完了
- **Phase 3 の設計は `docs/PHASE3_DESIGN.md`**。Phase 3 着手前に必ず読む（実装順・DB 方針・計画ロジック §9）
- コミット（すべてローカルのみ）: `b5bd5ac` 2.5 → `38ca11d` 2.6 → `6728ebf` 3.0a → `c9df5f3` 3.0b → 3.1（`git log` 参照）。origin より 5 コミット先行
- **未実施: `git push origin main`**（public リポジトリ。Vercel 連携済みなら本番デプロイが走る）
- typecheck 0 / lint 0 / テスト 193 件成功 / production build 成功 / npm audit 0

## 残タスク（優先順）

1. push するか判断（ユーザー確認待ち）→ 7〜14 日実運用 → バックアップ JSON を持って Phase 3.0c へ（確認項目は設計書 §14、CONFIG 見直しは §9.2・`FORECAST_CONFIG`・§7.1 の `EXAM_READINESS_CONFIG`）
2. 電通大以外 9 校の必要科目・重みは仮値 → 募集要項で確認し `/universities` から修正（コード変更不要）
3. デプロイ後、記録ダイアログ保存後に閉じるアニメーションが完了するか目視確認（検証時はペイン非表示で未確認）

## 作業ルール（トークン節約）

- 新機能追加は停止中（実運用データ待ち）。バグ・データ消失リスク・実運用を妨げる UX のみ修正
- 計画の配分補正は 3.0a で構造修正済み（設計書 §9.1）。`PLAN_CONFIG` の値は実運用データを根拠に変える。根拠なく係数を変えない
- `activityLogs` の `status_change` は Phase 3 の状態履歴（事実データ）。削除・剪定しない
- 予測（`src/lib/forecast/`）と学力の3軸（`src/lib/learning-dimensions/`）は表示専用。planner の入力にしない（3.0c で判断）。`src/lib/model/plan-regression.test.ts` が今日の計画の golden テスト
- 本番準備度は「合格率・合格確率」と表現しない（準備指標）。習熟度ベースの残作業係数 `forecast/masteryWork.ts` は用意だけで forecast 未接続
- prettier の一括整形はコミット直前に 1 回だけ（途中でやると差分通知が大量に出る）
- ブラウザ確認は必要な画面だけ。基本は `npm run typecheck` / `npm run lint` / `npm test` / `npm run build`
- push・デプロイは必ずユーザー確認後

## 要点メモ

- ビルドは `next build --webpack`（Serwist 用）。`next.config.ts` の `turbopack: {}` は dev 用で必要
- データアクセスは `src/lib/db/repository.ts` 経由のみ。派生値は `src/lib/model/buildStudyModel.ts` で計算（DB に保存しない）
- migration は `DexieRepository.initialize()` 内で冪等。回帰テスト: `src/lib/db/migration-phase1.test.ts`
- Next 16 の lint は `react-hooks/set-state-in-effect` がエラー扱い。ダイアログのフォーム初期化は「開いている間だけマウントされる子コンポーネント」で行う
- ブラウザプレビュー用の起動設定は親フォルダの `数学道筋/.claude/launch.json`（`dev`, port 3000）
