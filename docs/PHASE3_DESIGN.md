# Phase 3 設計書（2026-09-19 / Phase 2.6 時点）

> 本書は **設計案** です。Phase 3 の機能は未実装。
> 「現在のコードから判断できる事実」と「設計上の提案」を分けて書いています（**[事実]** / **[提案]**）。
> 係数はすべて初期値の案であり、7〜14 日の実運用データを見てから確定します。

---

## 1. Phase 3 の目的

Phase 2 の計画は「決められた配分で勉強させる」ものです。Phase 3 では

> **試験日に間に合うように、実際の学習速度に応じて計画そのものを調整する**

ことを目指します。具体的には次の 3 つを数値として持てるようにします。

1. **学習速度** — この人はこの科目の単元を「基本OK」にするのに何分かかるか
2. **残り作業量と到達予測** — 残り単元 × 学習速度 ÷ 週あたり学習時間 = いつ終わるか
3. **Deadline Risk** — 「この単元を今やらないと試験日に間に合わない」度合い

あわせて、進捗を 1 つの数字で表すのをやめ、**Coverage / Mastery / Exam Readiness** に分離します。

### 変えない原則

- 今日の計画は **ルールベース・決定論的・オフライン・コスト 0・再現可能**。LLM に決めさせない
- DB には **事実データのみ** を保存。習熟度・弱点・優先度・準備度・予測到達日などは毎回計算
- 係数は `*_CONFIG` オブジェクトに集約し、関数の引数で差し替え可能にする（既存の `PRIORITY_CONFIG` / `PLAN_CONFIG` と同じ流儀）
- 計算ロジックは `src/lib/**` の純粋関数、UI は `src/components/**`。UI から DB を直接触らない
- 通常の記録は「問題数・正解数・学習時間」だけで済む状態を維持する

---

## 2. 現状分析サマリ

**[事実]** 派生値はすべて `src/lib/model/buildStudyModel.ts` が `StudySnapshot`（全テーブルの読み取り結果）と `now` から計算している。
つまり **「任意の時刻 t の snapshot を作れれば、その時点のモデルを再計算できる」** 構造になっており、
Phase 3 の分析（週次比較・予測）はこの性質を最大限利用する。

**[事実]** 時刻 t の snapshot を再構成するときに問題になるのは「上書き更新される列」だけ：

| 上書きされる値                        | 履歴の有無                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `Topic.status`                        | ✅ `activityLogs` の `status_change`（`meta: {from, to}`, `at`）に全遷移が残る |
| `Topic.lastStudiedAt`                 | ✅ sessions / exerciseResults の時刻から再計算可能                             |
| `Review.dueAt`（スヌーズで変更）      | ❌ 元の期限は残らない（影響小）                                                |
| `Settings.subjectAllocation` / 試験日 | ❌ 変更履歴なし（現在値で代用する）                                            |
| `Topic.weight` / `dependsOn`          | ❌ 変更履歴なし（現在値で代用する）                                            |
| 今日の計画（PlanItem 一覧）           | ❌ 保存していない。入力が変わるので後から完全再現はできない                    |

`status_change` ログは Phase 1 のバックアップ（`src/test/fixtures/phase1-sample.json`）でも同じ形で記録されている。
Phase 2.6 で「全ステータス変更経路が from/to 付きログを書く」ことを回帰テストで固定した（§12）。

---

## 3. 必要な分析が現データで可能か

| 分析                   | 判定                 | 使う生データ                                                                                                                                          | 注意点                                                                                                                                                                      |
| ---------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 学習速度               | ✅ 可能              | `studySessions`(topicId, durationSec, startedAt) + `status_change` ログ + `exerciseResults`(attempted, at)                                            | ①オンボーディング時の自己申告ステータスは「学習」ではない ②`topicId=null` の科目だけの記録は単元に帰属できない ③アプリ外で勉強してステータスだけ上げた単元は時間 0 に見える |
| 単元ごとの所要時間     | ✅ 可能              | `studySessions.topicId`                                                                                                                               | 単元削除時は `topicId=null` になるが `subjectId` は残る（テスト済み）                                                                                                       |
| Coverage               | ✅ 可能              | `Topic.status ≥ 1` または単元に session / exerciseResult がある                                                                                       | —                                                                                                                                                                           |
| Mastery                | ✅ 既存              | `calculateMastery`（ステータス + 正答率 + 復習 + 間隔 + 模試/過去問失点）                                                                             | —                                                                                                                                                                           |
| Exam Readiness         | △ 可能（データは疎） | `pastExamProblems`(topicId, result, score), `exerciseResults` の difficulty=`advanced`/`past_exam`・type=`mock`/`past_exam`, `mockExams.weakTopicIds` | 模試は単元単位では「失点した単元」しか分からない（負の証拠のみ）。過去問の大問に単元が紐づいていないと単元へ反映できない                                                    |
| Deadline Risk          | ✅ 可能              | 試験日（第一志望 `University.examDate` → `Settings.examDate`）, 残り単元, 学習速度, 実績の週学習時間, `dailyGoals.availableMinutes`                   | 学習速度の実績が少ない期間は事前値に頼る（§5）                                                                                                                              |
| 週次レビュー           | ✅ ほぼ可能          | sessions / exerciseResults / reviews / `status_change` ログ                                                                                           | 「計画との差」は、過去の計画を保存していないため **配分目標・週目標との差** として定義する（§10）                                                                           |
| 科目配分の不足         | ✅ 既存              | `computeAllocationStatus`                                                                                                                             | §9 の問題あり                                                                                                                                                               |
| 学習停滞               | ✅ 可能              | `lastStatusUpAt`, `status_change` ログ, sessions                                                                                                      | —                                                                                                                                                                           |
| ミス傾向               | ❌ 不可              | 自由記述 `memo` のみ                                                                                                                                  | 原因の構造化データがない → §4 で最小追加                                                                                                                                    |
| 過去問による本番準備度 | ✅ 可能              | `pastExams`(score, maxScore, durationMin, year), `pastExamProblems`                                                                                   | 大問への単元タグ付けは任意入力なので、付いていない分は科目単位でのみ評価                                                                                                    |

---

## 4. データモデル（最小追加案）

### 4.1 追加しないもの

- `masteryScore` / `weaknessScore` / `priorityScore` / `readinessScore` / `coverage` / `velocity` / `deadlineRisk` / `estimatedCompletionDate` — すべて再計算可能。**保存しない**
- ステータス履歴テーブル — `status_change` ログで足りる。重複保存しない
- 今日の計画のスナップショット — §10 の定義で不要にする（実運用で必要と分かった場合のみ再検討）

### 4.2 追加する生データ（Phase 3.3 / 3.4 で実施。今回は未実装）

**(a) ミス原因 — Phase 3.3**

```ts
type MistakeCause =
  | "knowledge" // 知識不足
  | "formula" // 公式忘れ
  | "calculation" // 計算ミス
  | "reading" // 問題文理解不足
  | "approach" // 方針が立たない
  | "time" // 時間不足
  | "careless"; // ケアレスミス

interface ExerciseResult {
  /* 既存 */ mistakeCauses?: MistakeCause[];
}
interface PastExamProblem {
  /* 既存 */ mistakeCauses?: MistakeCause[];
}
```

- 任意・非インデックス列のため **Dexie のバージョン変更は不要**。既存行はそのまま有効
- 入力 UI は「正解数 < 問題数」のときだけ、折りたたみのチップ（複数選択・未選択可）で出す。通常の記録手順は増やさない
- 1 記録に複数問あるため「問題ごと」ではなく「この記録で多かった原因」を付ける粒度にする（入力負荷優先）

**(b) 志望校情報の年度・出典管理 — Phase 3.4**

**[事実]** 現在の `UniversityRequirement` は `{universityId, subjectId, required, importance, weight, note}` で年度・出典を持たない。電通大以外は仮値。

**[提案]** 募集要項は「大学 × 年度」単位で発表されるので、年度メタデータと科目要件を分ける。

```ts
type RequirementStatus = "provisional" | "official_previous_year" | "official_current_year";

// 新テーブル（Dexie version(3)）: 大学 × 入学年度 の募集要項メタデータ
interface AdmissionGuide {
  id: ID;
  universityId: ID;
  admissionYear: number; // 例: 2028
  status: RequirementStatus;
  sourceUrl?: string;
  publishedAt?: string; // YYYY-MM-DD
  verifiedAt?: string; // 自分で確認した日
  examDate?: string; // その年度の試験日（University.examDate より優先）
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// 既存テーブルに任意列を追加（インデックス追加あり → version(3)）
interface UniversityRequirement {
  /* 既存列はそのまま */
  admissionYear?: number; // 未設定 = 年度不明（既存行）
  requirementType?: "required" | "selective" | "interview" | "document";
  status?: RequirementStatus; // 行単位で上書きしたい場合のみ
  sourceUrl?: string;
  publishedAt?: string;
  verifiedAt?: string;
  // notes は既存の note を使う
}
```

- 表示例: 「電気通信大学 — 2028年度: 未発表 / 現在は 2027年度募集要項（official_previous_year, 2026-06-01 確認）を参考」
- 「どの年度の要件を使うか」は計算で決める: 目標年度の `official_current_year` → なければ最新の `official_previous_year` → なければ `provisional`
- Web 取得・差分検知は実装しない（sourceUrl と verifiedAt を持つことで、将来の差分検知の足場だけ用意する）

### 4.3 生データの質の問題（DB 追加なしで対処）

| 問題                         | 事実                                                                            | 対処案                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 手動記録の日時               | 記録ダイアログは `endedAt = 保存時刻`。翌朝に前日分を記録すると今日の学習になる | 実運用中は「勉強直後に記録（タイマー推奨）」で運用。3.2 で必要なら「昨日」トグルを検討        |
| 深夜の学習                   | 日付境界は 0:00 固定（`startOfDay`）                                            | 3.2 で「1 日の区切り時刻」を設定値（既定 0 時 = 互換）として検討                              |
| 科目だけの記録               | 記録ダイアログ・タイマーで単元未選択が可能                                      | 学習速度は単元付き記録だけで推定。単元付き比率をデータ品質指標として表示                      |
| オンボーディングのステータス | `setTopicStatus` 経由で `status_change` ログが残るが、学習ではない              | `settings.onboardedAt` 近傍かつ session/result の無い遷移は「初期申告」として速度推定から除外 |

---

## 5. 計算モデル: 学習速度

新規 `src/lib/pace/velocity.ts`（純粋関数）。

### 5.1 単元ごとの実績（観測値）

`status_change` ログを時系列に再生し（同一ミリ秒の遷移は `to → from` の連鎖で順序を決める。ログ ID はランダムなので順序に使えない）、単元ごとに:

- `firstTouchAt` = 最初の session / exerciseResult / 1 以上への遷移
- `reachedAt[s]` = ステータス s 以上に **初めて** 到達した時刻（s = 1..4）
- `minutesTo[s]` = `reachedAt[s]` までにその単元に記録された session 分数の合計
- `problemsTo[s]` = 同じく exerciseResults の attemptedCount 合計
- `daysTo[s]` = `reachedAt[s] − firstTouchAt`（日）

**有効サンプルの条件**（除外は計算時のみ、データは消さない）:

- 到達前に session が 1 件以上ある（時間 0 の「申告だけ」の遷移を除外）
- 初期申告（§4.3）でない
- 一度下がって再到達した場合は初回到達のみ使う

### 5.2 推定値（科目 × ステージ）

実績が少ない期間を事前値で補う縮小推定:

```
est(subject, stage) = (n · median(観測) + k · prior(evaluationType, stage)) / (n + k)
```

```ts
export const VELOCITY_CONFIG = {
  /** 事前値の重み（仮想サンプル数） */
  priorWeight: 3,
  /** evaluationType × 到達ステージ別の事前値（分）。初期値は仮 */
  priorMinutes: {
    problem: { 1: 30, 2: 90, 3: 60, 4: 120 },
    language: { 1: 20, 2: 60, 3: 40, 4: 60 },
    interview: { 1: 15, 2: 30, 3: 30, 4: 30 },
  },
  /** これ未満のサンプル数では UI に「目安（実績不足）」と表示 */
  minSamplesForActual: 3,
};
```

- 中央値を使う（1 単元だけ異常に時間がかかった影響を抑える）
- ステージ間の分数は「s−1 → s に上げるのに要した分」として持つ
- `Topic.weight` を所要時間の倍率として使う（重み 2 の単元は 2 倍かかる想定）
- 「定着まで何日」は復習スケジュール（1・3・7 日）に律速されるため、**日数は表示用**に留め、残り時間の計算には分数を使う

---

## 6. 計算モデル: 残り作業量・予定進捗・Deadline Risk

新規 `src/lib/pace/deadline.ts`。

### 6.1 目標ステータス

単元ごとに「試験までにどこまで上げるか」を決める。

```ts
export const TARGET_CONFIG = {
  /** 第一志望の importance → 目標ステータス */
  targetStatusByImportance: { 5: 3, 4: 3, 3: 3, 2: 2, 1: 2, 0: null }, // null = 対象外
  /** 本番前に過去問演習だけに使う期間（日） */
  finalBufferDays: 30,
};
```

### 6.2 残り時間と週キャパシティ

```
remainingMinutes(topic) = Σ_{s=status+1..target} est(subject, s) × topic.weight
remainingMinutes(subject) = Σ remainingMinutes(topic)
capacityPerWeek(subject) = 直近 28 日の実績分 / 4   （実績が 7 日未満なら weeklyStudyGoalMin × 配分率）
weeksNeeded(subject) = remainingMinutes / capacityPerWeek
availableWeeks = (daysToExam − finalBufferDays) / 7
```

### 6.3 Deadline Risk

**科目レベル（pressure）**

```
pressure = weeksNeeded / availableWeeks
risk = 0            (pressure ≤ lowPressure)
     = 線形補間      (lowPressure < pressure < highPressure)
     = 1            (pressure ≥ highPressure)
```

**単元レベル（最遅開始日）** — 「今やらないと間に合わない」を直接表す

科目内のロードマップ順（`Category.order` → `Topic.order`、`dependsOn` を尊重）に並べ、

```
latestStart(topic) = examDate − finalBufferDays − (その単元以降の残り時間合計 / 1日あたりキャパシティ)
slackDays(topic) = latestStart(topic) − today
topicRisk = 0 (slack ≥ slackSafeDays) … 1 (slack ≤ 0) の線形
```

```ts
export const DEADLINE_CONFIG = {
  lowPressure: 0.8,
  highPressure: 1.2,
  slackSafeDays: 21,
};
```

境界値テスト対象: pressure = 0.8 / 1.2 ちょうど、slack = 0 / 21 ちょうど、`daysToExam ≤ finalBufferDays`（→ risk 1）、キャパシティ 0（→ risk 1・0 除算しない）、残り 0（→ risk 0）。

### 6.4 予定進捗（何日先行 / 遅延）

```
requiredPerDay = remainingMinutes(開始時点) / 利用可能日数
aheadDays = (実績の累積消化分 − 必要累積消化分) / requiredPerDay
```

「消化分」は §5 の推定値で換算したステータス上昇分（= 進んだ作業量）であり、勉強時間そのものではない。
勉強時間が多くても単元が進んでいなければ遅延として出る。

---

## 7. Coverage / Mastery / Exam Readiness

新規 `src/lib/readiness/triad.ts`。単元 → カテゴリ → 科目 の順に `Topic.weight` で加重平均。

| 指標               | 定義                                                                  | 範囲   |
| ------------------ | --------------------------------------------------------------------- | ------ |
| **Coverage**       | 一度でも学習した単元の割合（`status ≥ 1` または session/result あり） | 0–100% |
| **Mastery**        | 既存 `calculateMastery` の加重平均（= 現在の `subjectScore`）         | 0–100  |
| **Exam Readiness** | 本番レベルの証拠に基づく対応力                                        | 0–100  |

### Exam Readiness の考え方

- 証拠を種類ごとに重み付けして集計。**通常演習 < 復習 < 模試 < 編入過去問**
- 本番レベルの証拠が無い単元は、Mastery が高くても上限を低く抑える（「全部一度勉強した ≠ 本番で解ける」）
- 古い証拠は半減期で減衰させる

```ts
export const EXAM_READINESS_CONFIG = {
  /** 証拠の強さ（初期値は仮。実データで調整） */
  evidenceWeight: {
    practice_basic: 0, // 基本問題は本番準備度に入れない
    practice_standard: 0.5,
    practice_advanced: 1,
    review: 1.5,
    mock: 2.5,
    past_exam: 4, // exerciseResults(type/difficulty=past_exam) と pastExamProblems
  },
  /** 本番レベルの証拠が無いときの上限（Mastery × この値） */
  noEvidenceCap: 0.4,
  /** 証拠の半減期（日） */
  halfLifeDays: 45,
  /** これだけの重み付き証拠量で「確信度 100%」 */
  fullConfidenceEvidence: 10,
};
```

```
evidenceRate = Σ(w_i × decay_i × 正答率_i) / Σ(w_i × decay_i)
confidence   = min(1, Σ(w_i × decay_i × 問題数_i) / fullConfidenceEvidence)
readiness    = confidence × evidenceRate × 100 + (1 − confidence) × min(mastery, mastery × noEvidenceCap)
```

- 模試の `weakTopicIds` は負の証拠（その単元の evidenceRate を下げる項）として扱う
- 科目単位の過去問得点（単元タグなし）は科目の Exam Readiness に直接混ぜる（単元には配らない）

UI 例（科目別 Dashboard の 1 行）:

```
微積   Coverage 78%   Mastery 55   Exam Readiness 21
```

---

## 8. 今日の計画への反映

### 8.1 優先度式

既存の `calculatePriority` は加算式で、概念式の大半はすでに項として存在する。

| 概念項                 | 既存の項                                         | Phase 3                                                 |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| weakness               | `weaknessFactor`, `lowAccuracy`                  | 維持                                                    |
| deadlineRisk           | なし                                             | **追加**: `topicRisk × deadlineRiskFactor`              |
| prerequisiteImportance | `blocksPerDependent`, `depsUnmetPenalty`         | 維持                                                    |
| examImportance         | `firstChoicePerImportance`, `examSoonMultiplier` | 維持（deadlineRisk と重複しすぎないよう 3.0c で再調整） |
| subjectDeficit         | `allocationFactor`                               | **§9 の問題を解消した形に置き換え**                     |
| inactivity             | `stale*`                                         | 維持                                                    |
| reviewNeed             | `overdue*`, `dueToday`                           | 維持                                                    |

係数は `PRIORITY_CONFIG` に追加し、`calculatePriority(input, cfg)` の第 2 引数で差し替え可能な構造を保つ。

### 8.2 段階導入（シャドーモード）

Deadline Risk は **いきなり計画に混ぜない**。

1. 3.0b: 計算して科目画面に表示するだけ（計画は不変）
2. 1〜2 週間、表示された risk が実感と合うか確認
3. 3.0c: `deadlineRiskFactor` を 0 から有効化し、シナリオテストで挙動を固定

### 8.3 計画の安定性（提案）

**[事実]** 今日の計画は記録のたびに現在データから再計算されるため、1 件記録すると並びが変わる。
また今日すでに勉強した分は「使える時間」から差し引かれず、完了した項目も一覧に残る。

**[提案]** 「今日の計画 = 今日 0:00 時点までのデータで計算した計画」とする。
`buildStudyModel(snapshot から今日の session/result を除いたもの, now)` で計算すれば、
**保存せずに・決定論的に・1 日の中で安定した** 計画が得られる。
今日の session/result と突き合わせて「済」表示・残り時間を出す。
（ステータスは上書き列なので `status_change` ログで今日 0:00 時点へ巻き戻す。§10 の `statusAt` を共用）

---

## 9. 今日の計画ロジックで見つかった問題（配分補正）

コードを変更せず、実際の `computeAllocationStatus` → `calculatePriority` → `buildTodayPlan` を
合成データで動かして確認した（既定配分: 数学60 / 英語10 / 物理10 / TOEIC・C++・アルゴ 各5 / CS 3 / 面接 2、
各科目に学習中 1 + 次の単元 2 の候補、試験まで 287 日）。

| シナリオ                                   | 使える時間        | 計画内の数学の割合 |
| ------------------------------------------ | ----------------- | ------------------ |
| A. 履歴なし（初日）                        | 60 / 120 / 180 分 | 60% / 55% / 50%    |
| **B. 本番初日に数学を 25 分だけ勉強**      | 60 / 120 / 180 分 | **0% / 0% / 0%**   |
| C. 1 週間ほぼ配分どおり + 今日数学 25 分   | 60 / 120 / 180 分 | 60% / 55% / 35%    |
| **D. 直近 1 週間の数学が 85%（配分超過）** | 60 / 120 / 180 分 | **0% / 0% / 11%**  |
| **E. 6 日間数学に集中（集中期間）**        | 60 / 120 / 180 分 | **0% / 0% / 0%**   |

**結論: 懸念された挙動は起きる。** 特に「本番運用開始直後」と「主力科目への集中期間」で顕著。原因はコードから次の 5 点:

1. **不足率が「割合」だけで決まり、総量を見ていない**（`subjectAllocation.ts`）
   `deficitRatio = (目標割合 − 実績割合) / 目標割合`。7 日間の総学習が数学 25 分だけでも、他科目は実績割合 0 → 不足率 **1.0（最大）**。総学習量が少ないときほど補正が最大になる
2. **不足率が 3 重に効いている**
   ① 優先度に `+ deficit × 15`（`calculatePriority`）②予算の重みに `× (1 + deficit)`（`buildTodayPlan` 手順 2）③ 7 日未学習の強制枠（手順 3）。
   シナリオ B では英語・物理の候補が 54.3 点、数学の「学習中」単元は 43.3 点で、+15 の差がそのまま逆転要因
3. **予算は「上限」であって「確保」ではない**
   手順 4 は優先度順の貪欲法で、予算超過の判定は「他に予算未達の科目が待っている」ときだけ働く。
   数学の予算が残っていても、数学より高得点の候補が時間を使い切ると数学は入らない
4. **未学習科目の強制枠が本番初日から発動する**
   `daysSinceStudied === null`（一度も勉強していない）も「放置」扱い。何か 1 科目勉強した瞬間に `hasHistory` が真になり、配分 10% 以上の未学習科目（英語・物理）が 20 分ずつ強制的に入る
5. **1 科目あたりの件数上限が主力科目の上限になる**
   `maxPerSubject` = 2（150 分未満）/ 3（150 分以上）× 30 分ブロック → 数学は最大 60 / 90 分。
   180 分の日は復習を除いても数学が 50% を超えられない（目標 60%）

加えて、7 日の移動窓なので **1 回の偏りの影響が 7 日間続く**（「その日だけ」の補正ではない）。

**Phase 2.6 時点の対応:** 係数・ロジックは変更せず、上記を記録した。

### 9.1 Phase 3.0a で実施した修正（実装済み）

ユーザー判断により、実運用データを待たずに **構造の修正** を先行した（係数の最適化はしていない）。
実装: `src/lib/planner/subjectAllocation.ts`, `src/lib/planner/buildTodayPlan.ts`。

| 旧ロジックの原因                | 3.0a での対応                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 不足を割合で評価             | **分数** で評価。`expected = 週目標 × 配分率 × 経過日数/7`、`balance = expected − 過去日の実績`（今日は除外）。`deficitMinutes = max(0, balance)`     |
| 2. 補正が 3 重                  | 補正は **科目予算の 1 か所だけ**。優先度の `allocationFactor` と未学習科目の強制枠を削除                                                              |
| 3. 予算が上限としてしか効かない | 予算を「次のブロックを誰に渡すか」の基準にした（予算に対して最も不足している科目へ次のブロック）                                                      |
| 4. 初期未学習 = 放置            | `経過日数` は最初の記録日から数える。初日は誰も不足にならない。「N日間未学習」は記録のある科目のみ（理由表示だけ、強制しない）                        |
| 5. 件数上限                     | 件数上限を廃止。候補が尽きた科目は既存タスクを最大 2 ブロックまで延長                                                                                 |
| 6. 7 日窓の偏りが残る           | 先行している科目も `minBaseFactor`（基本配分の 50%）までしか削らない。取り戻しは `catchUpDays`（3 日）に分散し、1 日の `maxCatchUpShare`（35%）が上限 |
| 7. 今日の実施分を未考慮         | `残り = 今日使える時間 − 今日の学習時間`。科目別にも今日の実施分を目標から差し引く                                                                    |

1 日の科目目標:

```
base_s    = 今日使える時間 × 配分率_s
catchUp_s = balance_s / catchUpDays          （正の合計は 今日使える時間 × maxCatchUpShare で頭打ち）
target_s  = catchUp_s > 0 ? base_s + catchUp_s : max(base_s × minBaseFactor, base_s + catchUp_s)
need_s    = max(0, target_s − 今日すでに勉強した分_s)
budget_s  = need_s を「復習を除いた残り時間」に比例配分
```

実データ（初期シード）での結果（数学の分 / 計画合計）:

| 状況                                     | 30               | 60    | 90    | 120    | 180     |
| ---------------------------------------- | ---------------- | ----- | ----- | ------ | ------- |
| 新規データ                               | 30/30            | 45/60 | 50/80 | 75/120 | 105/180 |
| 今日数学 25 分記録済（残り時間で再計画） | 0/0（残り 5 分） | 15/30 | 25/55 | 45/90  | 80/155  |

受け入れテスト: `src/lib/planner/planner.test.ts` の `scenarios`（A〜K）。

### 9.2 実運用で見直す CONFIG

`PLAN_CONFIG`（`buildTodayPlan.ts`）: `catchUpDays` / `maxCatchUpShare` / `minBaseFactor` / `maxBlocksPerItem` / `deficitNoticeMinutes` / `minBlock` / `blockMinutes`。
不足の基準は設定画面の **週の学習目標（`weeklyStudyGoalMin`）**。実際の学習量と大きくずれていると補正が過大・過小になるので、運用開始時に実態に合わせる。

---

## 10. 週次レビュー・予想到達日

新規 `src/lib/review/weekly.ts`（「復習（spaced review）」と紛らわしいので実装時は `src/lib/weekly/` も可）。

### 10.1 共通基盤: 時刻 t の状態を再構成

```ts
statusAt(topicId, t, logs, currentStatus): Status   // status_change を t まで再生
snapshotAt(snapshot, t): StudySnapshot                // t 以降の session/result/review 完了を除外し status を巻き戻す
```

`buildStudyModel(snapshotAt(s, t), t)` で「t 時点の Mastery / Coverage / Readiness」が得られる。
weight・dependsOn・配分・試験日は現在値で代用する（履歴がないため。§2）。

### 10.2 表示項目と計算元

| 項目                      | 計算                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 今週の総学習時間 / 科目別 | sessions（週の区切りは月曜 0:00、3.2 で区切り時刻設定を検討）                                               |
| 進んだ単元                | 週内の `status_change`（上昇のみ、初期申告除外）                                                            |
| 習熟度変化                | `model(週末).mastery − model(週初).mastery`（科目別）                                                       |
| 前週比                    | 同じ計算を前週に適用                                                                                        |
| 計画との差                | **配分目標 × 週目標分 − 実績分**（過去の日次計画は保存していないため）                                      |
| 何日先行 / 遅延           | §6.4 の `aheadDays`                                                                                         |
| 予想到達日                | 科目ごと `today + weeksNeeded × 7`（到達不能なら「試験日までに未達」）                                      |
| 来週の推奨配分            | 基本は設定配分。Deadline Risk の高い科目へ上限付きで寄せた案を **提案表示のみ**（設定は自動で書き換えない） |

UI: PC ではダッシュボードとは別の `/weekly` 画面（表 + 小さなグラフ）。スマホでは要約 3 行だけ。

---

## 11. migration 方針

**[事実]** 現在: Dexie `version(1)`（Phase 1 の 9 テーブル）+ `version(2)`（8 テーブル追加）。
データ移行は `DexieRepository.initialize()` 内で `settings.schemaVersion` を見て冪等に実行。

**[提案]** Phase 3 のルール:

1. **任意列の追加はバージョンを上げない**（3.3 のミス原因）。型は `?:`、既存行はそのまま有効、読み取り側で未定義を許容
2. **新テーブル・新インデックスは `version(3)` に新ストアだけ宣言**（3.4 の AdmissionGuide）。既存ストア定義は変えない
3. データの補完が必要な場合だけ論理 `SCHEMA_VERSION = 3` とし、`runMigrationSteps` に冪等なステップを追加（既存行は「空欄を埋める」以外に書き換えない）
4. `BackupFile.data` の新テーブルは任意プロパティ。v1 / v2 のバックアップはそのまま import でき、import 後に migration が走る
5. 派生値の追加は migration を伴わない（DB を触らない）ので、3.0〜3.2 は **DB 変更なし** で実装できる
6. PWA の注意: Dexie は既存 DB より低いバージョンで開くと `VersionError` になる。`skipWaiting: true` / `clientsClaim: true` なので通常は新しいコードに切り替わるが、`version(3)` を出すリリースでは「古いタブが開いたまま」のケースを手動確認する

回帰テスト（既存 `migration-phase1.test.ts` を拡張）:
v1 fixture → v3、v2 バックアップ → v3、v3 の再 initialize で重複なし、export → import 往復、v1 全行の不変性。

---

## 12. テスト方針

- すべての計算は純粋関数（`snapshot`, `now`, `config` を引数）→ vitest で直接テスト
- **境界値**: §6.3 の各しきい値ちょうど、サンプル数 `minSamplesForActual − 1 / ちょうど`、試験当日・試験日超過、キャパシティ 0、残り 0、`noEvidenceCap` の上限到達
- **決定性**: 同じ snapshot と now で同じ結果（乱数・`Date.now()` を内部で呼ばない）
- **シナリオテスト**: §9 の A〜E を `planner.test.ts` に追加（3.0a の受け入れ基準）
- **データ保証テスト**（Phase 2.6 で追加済み）: 全ステータス変更経路が `status_change` ログを `{from, to}` 付きで書くこと、単元削除後も session の科目帰属が残ること
- **実データ再生テスト**: 実運用後のバックアップを匿名化して fixture 化し、velocity / deadline の出力が妥当な範囲にあることを確認（`phase1-sample.json` と同じ運用）
- 既存テスト（Phase 2.6 時点 110 件）は常に全件成功を維持

---

## 13. 実装順

| Phase          | 内容                                                                                      | DB 変更                                     | UI 変更                          |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| **2.6**（済）  | 本番運用準備、計測可能性確認、本設計書、データ保証テスト                                  | なし                                        | なし                             |
| **3.0a**（済） | 計画の配分補正の構造修正（§9.1）+ シナリオテスト + 今日の実施分の差し引き                 | なし                                        | 理由表示の文言のみ               |
| **3.0b**       | 学習速度 + 残り作業量 + Deadline Risk を計算し、科目画面に **表示のみ**（シャドーモード） | なし                                        | 科目画面に数行                   |
| **3.0c**       | Deadline Risk を優先度に組み込み（係数 0 → 有効化）、計画の日内安定化（§8.3）             | なし                                        | 「済」表示                       |
| **3.1**        | Coverage / Mastery / Exam Readiness 分離表示                                              | なし                                        | 科目画面・志望校画面             |
| **3.2**        | 週次レビュー + 予想到達日 + 先行/遅延日数（`statusAt` / `snapshotAt` 基盤）               | なし                                        | `/weekly` 追加                   |
| **3.3**        | ミス原因の任意入力と傾向集計                                                              | 任意列のみ（version 据え置き）              | 記録ダイアログに折りたたみチップ |
| **3.4**        | 志望校情報の年度・出典管理                                                                | `version(3)`: AdmissionGuide + インデックス | 志望校画面                       |
| **4**          | AI コーチ（理由の自然言語化・問題生成・解説・ミス分析・面接練習）                         | 必要時に検討                                | —                                |

推奨からの変更点:

- **3.0 を a/b/c に分割**。配分補正の修正（a）は Deadline Risk より先に行う。Deadline Risk を入れる前に「いまの補正が主力科目を邪魔する」問題を直さないと、効果の切り分けができない
- Deadline Risk は **表示のみ → 計画へ反映** の 2 段階（シャドーモード）
- 3.0〜3.2 は DB 変更なし。DB 変更は 3.3（任意列）と 3.4（version 3）に限定し、migration リスクを後ろに寄せる

---

## 14. 実運用（7〜14 日）で確認すること

Phase 3.0 に進む前に、エクスポートしたバックアップ JSON で次を確認する。

**データ量・質**

- [ ] 単元付き session の比率（学習時間のうち `topicId` あり）— 目安 70% 以上なら学習速度の推定に使える
- [ ] exerciseResults の件数と、session と同時記録（`sessionId` あり）の比率
- [ ] 基本OK 以上に到達した単元数（学習速度のサンプル数）
- [ ] 手動記録が「後からまとめて」になっていないか（`createdAt` と `endedAt` の差、深夜 0 時またぎ）
- [ ] 復習の実施率とスヌーズ回数

**計画の挙動（§9）**

- [ ] 運用初日〜3 日目に数学が計画から消えたか
- [ ] 数学に集中した翌日、計画が他科目だけになったか
- [ ] 計画から開始した学習（`plannedMinutes` あり）の比率 = 計画がどれだけ使われたか
- [ ] 計画を無視した日は、なぜ無視したか（メモで十分）

**入力負荷**

- [ ] 1 回の記録にかかる操作数・時間がスマホで苦にならないか
- [ ] ミス原因を「残したかった」場面が実際にあったか（3.3 の要否判断）

**志望校**

- [ ] 電通大以外の必要科目・重みを募集要項で確認し、`/universities` から修正（コード変更不要）
