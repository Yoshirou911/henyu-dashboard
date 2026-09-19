import { DAY_MS } from "@/lib/date";
import { stat, type AccuracyStat } from "@/lib/mastery/accuracy";
import type { EvaluationType, ExerciseResult, Review, Status } from "@/lib/types";

/**
 * "次へ進む条件" (spec §11). For problem-type subjects:
 *   基本問題 直近正答率 ≥ 80%  AND  ≥ 10問  AND  3日後前後の復習 ≥ 70%
 * Language / interview topics simply need 基本OK. A manual override always wins.
 */
export const READY_CONFIG = {
  minBasicRate: 0.8,
  minBasicAttempts: 10,
  minReviewRate: 0.7,
  /** review evidence counts from this many days after 基本OK (≈ the 3-day review) */
  reviewMinDaysAfterBasicOk: 2,
  /** review outcome → score when no review problems were counted */
  outcomeScore: { got: 1, shaky: 0.5, failed: 0 },
};

export interface ReadyCondition {
  key: "basic_rate" | "basic_count" | "review" | "status";
  label: string;
  met: boolean;
  /** "82%", "9 / 10問", "67% / 70%" … */
  detail: string;
}

export interface ReadyResult {
  ready: boolean;
  /** what the rules say, ignoring the override */
  automatic: boolean;
  overridden: boolean;
  conditions: ReadyCondition[];
  /** conditions met / total — for the "あと少し" hint */
  progress: number;
}

/**
 * Review accuracy used by readyForNext: review-type problems solved ≥2 days
 * after 基本OK; falls back to the できた/怪しい/できなかった outcomes of
 * reviews from stage 1 (the 3-day review) onward.
 */
export function computeReviewRate(
  results: readonly ExerciseResult[],
  reviews: readonly Review[],
  basicOkAt: number | undefined,
): AccuracyStat & { source: "problems" | "outcomes" | "none" } {
  const from =
    basicOkAt !== undefined ? basicOkAt + READY_CONFIG.reviewMinDaysAfterBasicOk * DAY_MS : 0;
  const reviewProblems = results.filter((r) => r.type === "review" && r.at >= from);
  const s = stat(reviewProblems);
  if (s.attempted > 0) return { ...s, source: "problems" };

  const done = reviews.filter((r) => r.completedAt && r.outcome && r.stage >= 1);
  if (done.length > 0) {
    const sum = done.reduce((acc, r) => acc + READY_CONFIG.outcomeScore[r.outcome ?? "failed"], 0);
    return { attempted: done.length, correct: sum, rate: sum / done.length, source: "outcomes" };
  }
  return { attempted: 0, correct: 0, rate: null, source: "none" };
}

const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

export function calculateReadyForNext(
  input: {
    evaluationType: EvaluationType;
    status: Status;
    recentBasic: AccuracyStat;
    reviewRate: number | null;
    override?: boolean;
  },
  cfg = READY_CONFIG,
): ReadyResult {
  let conditions: ReadyCondition[];

  if (input.evaluationType === "problem") {
    const rate = input.recentBasic.rate;
    const n = input.recentBasic.attempted;
    conditions = [
      {
        key: "basic_rate",
        label: `基本問題 ${Math.round(cfg.minBasicRate * 100)}%以上`,
        met: rate !== null && rate >= cfg.minBasicRate,
        detail: pct(rate),
      },
      {
        key: "basic_count",
        label: `${cfg.minBasicAttempts}問以上`,
        met: n >= cfg.minBasicAttempts,
        detail: `${n} / ${cfg.minBasicAttempts}問`,
      },
      {
        key: "review",
        label: `復習 ${Math.round(cfg.minReviewRate * 100)}%以上`,
        met: input.reviewRate !== null && input.reviewRate >= cfg.minReviewRate,
        detail:
          input.reviewRate === null
            ? "未実施"
            : `${pct(input.reviewRate)} / ${Math.round(cfg.minReviewRate * 100)}%`,
      },
    ];
  } else {
    conditions = [
      {
        key: "status",
        label: "基本OK以上",
        met: input.status >= 2,
        detail: input.status >= 2 ? "達成" : "未達",
      },
    ];
  }

  const metCount = conditions.filter((c) => c.met).length;
  const automatic = metCount === conditions.length;
  const overridden = input.override !== undefined;
  return {
    ready: overridden ? Boolean(input.override) : automatic,
    automatic,
    overridden,
    conditions,
    progress: conditions.length > 0 ? metCount / conditions.length : 0,
  };
}
