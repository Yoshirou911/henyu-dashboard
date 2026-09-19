import type { EvaluationType, Status } from "@/lib/types";

/**
 * Study-pace forecasting (Phase 3.0b). Display only — nothing here feeds the
 * today planner. Every value is a starting guess to be tuned on real data.
 */
export const FORECAST_CONFIG = {
  /** minutes to take one topic from 未学習 to done, before any data (by evaluation type) */
  priorMinutesPerTopic: { problem: 120, language: 90, interview: 60 } as Record<
    EvaluationType,
    number
  >,
  /**
   * Share of a topic's work still left at each status. The planned hook for
   * Phase 3.1 (coverage / mastery) — replace this lookup there.
   */
  remainingWorkFactor: { 0: 1, 1: 0.7, 2: 0.35, 3: 0.1, 4: 0 } as Record<Status, number>,
  /**
   * Prior strength in virtual samples: observed weight = n / (n + priorStrength).
   * 1 sample → 20 %, 4 → 50 %, 12 → 75 %.
   */
  priorStrength: 4,
  /** samples a level needs before it is used instead of the next broader one */
  minSamplesByLevel: { category: 3, subject: 3, global: 1 },
  /** one sample's speed ratio (observed ÷ prior) is clamped to this range (outliers) */
  ratioClamp: { min: 0.25, max: 3 },
  /** samples with less study time than this are ignored (stray records) */
  minSampleMinutes: 10,
  /** days before the exam kept for past papers / review — new material ends here */
  examPrepReserveDays: 30,
  /** recent pace = minutes over the last N completed days */
  paceWindowDays: 14,
  /** with fewer tracked days the pace falls back to the plan (weekly goal × allocation) */
  minTrackedDaysForPace: 3,
  /**
   * below this many minutes / week there is no completion date ("no pace");
   * absurdly far dates are cut by maxEtaDays instead, so small subjects with a
   * small but real pace still get one
   */
  minimumPaceForEta: 5,
  /** a completion date further out than this is "not reachable at this pace" */
  maxEtaDays: 730,
  /** pressure = required ÷ pace: ≤ ahead 余裕あり, ≤ onTrack 予定通り, ≤ caution 要注意, else 遅延 */
  riskThresholds: { ahead: 0.85, onTrack: 1.05, caution: 1.3 },
  /** speed samples in the subject and days since the first record */
  confidenceThresholds: {
    medium: { samples: 3, days: 7 },
    high: { samples: 8, days: 14 },
  },
};

export type ForecastConfig = typeof FORECAST_CONFIG;
