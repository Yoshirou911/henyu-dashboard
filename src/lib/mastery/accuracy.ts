import { DAY_MS, dayKey } from "@/lib/date";
import type { ExerciseResult } from "@/lib/types";

export interface AccuracyStat {
  attempted: number;
  correct: number;
  /** 0–1, or null when nothing was attempted */
  rate: number | null;
}

export interface TopicAccuracy {
  /** 累計 */
  total: AccuracyStat;
  /** 直近 — the latest results up to `recentWindow` problems (shown on the dashboard) */
  recent: AccuracyStat;
  /** everything older than the recent window — used for 改善中 trends */
  earlier: AccuracyStat;
  basic: AccuracyStat;
  /** 直近 basic-only window — drives readyForNext */
  recentBasic: AccuracyStat;
  standard: AccuracyStat;
  advanced: AccuracyStat;
  review: AccuracyStat;
  pastExam: AccuracyStat;
  mock: AccuracyStat;
  lastAt?: number;
  /** distinct study days with results in the last 14 days (continuity) */
  activeDays14: number;
}

export const ACCURACY_CONFIG = {
  /** problems in the "直近" window */
  recentWindow: 20,
};

export function stat(
  results: readonly Pick<ExerciseResult, "attemptedCount" | "correctCount">[],
): AccuracyStat {
  let attempted = 0;
  let correct = 0;
  for (const r of results) {
    attempted += r.attemptedCount;
    correct += Math.min(r.correctCount, r.attemptedCount);
  }
  return { attempted, correct, rate: attempted > 0 ? correct / attempted : null };
}

/**
 * Newest-first accumulation until `window` problems are covered. The result
 * that crosses the threshold is included whole (a 10-question set is never
 * split), so a window may slightly exceed `window`.
 */
export function splitRecent<T extends Pick<ExerciseResult, "attemptedCount" | "at">>(
  results: readonly T[],
  window: number,
): { recent: T[]; earlier: T[] } {
  const sorted = results.slice().sort((a, b) => b.at - a.at);
  const recent: T[] = [];
  let count = 0;
  let i = 0;
  for (; i < sorted.length && count < window; i++) {
    const r = sorted[i] as T;
    recent.push(r);
    count += r.attemptedCount;
  }
  return { recent, earlier: sorted.slice(i) };
}

export function computeTopicAccuracy(
  results: readonly ExerciseResult[],
  options: { now?: number; recentWindow?: number } = {},
): TopicAccuracy {
  const now = options.now ?? Date.now();
  const window = options.recentWindow ?? ACCURACY_CONFIG.recentWindow;
  const { recent, earlier } = splitRecent(results, window);
  const basicResults = results.filter((r) => r.difficulty === "basic");
  const cutoff = now - 14 * DAY_MS;
  const days = new Set(results.filter((r) => r.at >= cutoff).map((r) => dayKey(new Date(r.at))));
  const lastAt = results.reduce<number | undefined>(
    (m, r) => (m === undefined || r.at > m ? r.at : m),
    undefined,
  );

  return {
    total: stat(results),
    recent: stat(recent),
    earlier: stat(earlier),
    basic: stat(basicResults),
    recentBasic: stat(splitRecent(basicResults, window).recent),
    standard: stat(results.filter((r) => r.difficulty === "standard")),
    advanced: stat(results.filter((r) => r.difficulty === "advanced")),
    review: stat(results.filter((r) => r.type === "review")),
    pastExam: stat(results.filter((r) => r.type === "past_exam" || r.difficulty === "past_exam")),
    mock: stat(results.filter((r) => r.type === "mock")),
    lastAt,
    activeDays14: days.size,
  };
}

/** "82%" / "—" */
export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`;
}
