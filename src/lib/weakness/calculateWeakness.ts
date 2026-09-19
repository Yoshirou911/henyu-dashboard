import type { AccuracyStat } from "@/lib/mastery/accuracy";
import type { Status } from "@/lib/types";

/**
 * weaknessScore (0–100) — cross-subject weak-topic detection, spec §15.
 * Pure + config-driven; `reasons` explain every point that was added.
 */
export const WEAKNESS_CONFIG = {
  /** recent accuracy below this is a weakness signal */
  accuracyThreshold: 0.7,
  /** points per percentage point below the threshold */
  accuracyPerPoint: 1,
  accuracyMinAttempts: 5,
  failedReviewPoints: 12,
  failedReviewCap: 36,
  shakyReviewPoints: 4,
  shakyReviewCap: 12,
  /** "学習時間の割に習熟度が低い" */
  effortMinMinutes: 120,
  effortMaxMastery: 40,
  effortPoints: 15,
  stagnation: [
    { days: 45, points: 15 },
    { days: 21, points: 8 },
  ],
  pastExamWrongPoints: 12,
  pastExamPartialPoints: 5,
  pastExamCap: 24,
  mockWeakPoints: 10,
  mockCap: 20,
  overdueBase: 5,
  overduePerDay: 2,
  overdueCap: 20,
  /** 第一志望 importance (1–5) × this, only when some other signal exists */
  firstChoicePerImportance: 2,
  /** list threshold for "現在の弱点" */
  listThreshold: 15,
  /** 改善中: recent − earlier accuracy ≥ this */
  improvingDelta: 0.15,
};

export interface WeaknessInput {
  status: Status;
  mastery: number;
  recent: AccuracyStat;
  failedReviews: number;
  shakyReviews: number;
  studyMinutesTotal: number;
  daysSinceStatusUp: number | null;
  pastExam: { partial: number; wrong: number };
  mockWeakCount: number;
  /** null when no review is overdue */
  overdueDays: number | null;
  /** importance (1–5) in the 第一志望's requirements; 0 when not required */
  firstChoiceImportance: number;
}

export interface WeaknessResult {
  score: number;
  reasons: string[];
}

export function calculateWeakness(input: WeaknessInput, cfg = WEAKNESS_CONFIG): WeaknessResult {
  const parts: { points: number; reason: string }[] = [];
  const add = (points: number, reason: string) => {
    if (points > 0) parts.push({ points, reason });
  };

  const r = input.recent;
  if (r.rate !== null && r.attempted >= cfg.accuracyMinAttempts && r.rate < cfg.accuracyThreshold) {
    add(
      (cfg.accuracyThreshold - r.rate) * 100 * cfg.accuracyPerPoint,
      `直近正答率 ${Math.round(r.rate * 100)}%`,
    );
  }
  add(
    Math.min(cfg.failedReviewCap, input.failedReviews * cfg.failedReviewPoints),
    `復習「できなかった」×${input.failedReviews}`,
  );
  add(
    Math.min(cfg.shakyReviewCap, input.shakyReviews * cfg.shakyReviewPoints),
    `復習「怪しい」×${input.shakyReviews}`,
  );
  if (input.studyMinutesTotal >= cfg.effortMinMinutes && input.mastery < cfg.effortMaxMastery) {
    add(
      cfg.effortPoints,
      `${Math.round(input.studyMinutesTotal / 60)}時間学習して習熟度${input.mastery}`,
    );
  }
  if (input.status >= 1 && input.status < 4 && input.daysSinceStatusUp !== null) {
    const hit = cfg.stagnation.find((s) => (input.daysSinceStatusUp as number) >= s.days);
    if (hit) add(hit.points, `${input.daysSinceStatusUp}日間ステータス停滞`);
  }
  add(
    Math.min(
      cfg.pastExamCap,
      input.pastExam.wrong * cfg.pastExamWrongPoints +
        input.pastExam.partial * cfg.pastExamPartialPoints,
    ),
    `過去問で失点（×${input.pastExam.wrong}・△${input.pastExam.partial}）`,
  );
  add(Math.min(cfg.mockCap, input.mockWeakCount * cfg.mockWeakPoints), "模試で失点");
  if (input.overdueDays !== null && input.overdueDays > 0) {
    add(
      Math.min(cfg.overdueCap, cfg.overdueBase + input.overdueDays * cfg.overduePerDay),
      `復習期限${input.overdueDays}日超過`,
    );
  }

  const signal = parts.reduce((s, p) => s + p.points, 0);
  if (signal > 0 && input.firstChoiceImportance > 0) {
    add(input.firstChoiceImportance * cfg.firstChoicePerImportance, "第一志望で重要");
  }

  const score = Math.min(100, Math.round(parts.reduce((s, p) => s + p.points, 0)));
  const reasons = parts.sort((a, b) => b.points - a.points).map((p) => p.reason);
  return { score, reasons };
}

/** 改善中: recent accuracy clearly above the earlier accuracy. */
export function isImproving(
  recent: AccuracyStat,
  earlier: AccuracyStat,
  cfg = WEAKNESS_CONFIG,
): boolean {
  if (recent.rate === null || earlier.rate === null) return false;
  if (recent.attempted < 5 || earlier.attempted < 5) return false;
  return recent.rate - earlier.rate >= cfg.improvingDelta;
}
