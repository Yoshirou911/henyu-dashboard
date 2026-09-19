import type { Status } from "@/lib/types";

/**
 * priorityScore for a study candidate (spec §19). Additive, rule-based,
 * config-driven. Ranks topics *within* the day; how the day's time is split
 * between subjects (incl. catching up on deficits) is decided only by the
 * planner's budgets (Phase 3.0a), so subject balance is not scored here. Each rule that fires contributes points *and* a short
 * human-readable reason (spec §20), so the planner can explain itself.
 */
export const PRIORITY_CONFIG = {
  overdueBase: 30,
  overduePerDay: 5,
  overdueCap: 55,
  dueToday: 22,
  /** (100 − mastery) × this */
  lowMasteryFactor: 0.15,
  /** weaknessScore × this */
  weaknessFactor: 0.3,
  /** 第一志望 importance (1–5) × this */
  firstChoicePerImportance: 4,
  /** subject not required by the 第一志望 */
  notRequiredPenalty: 10,
  monthlyTarget: 15,
  inProgress: 12,
  frontier: 8,
  /** each later position in the category's "up next" window loses this much */
  frontierDecay: 7,
  /** per not-yet-定着 topic that depends on this one */
  blocksPerDependent: 4,
  blocksCap: 12,
  depsUnmetPenalty: 25,
  lowAccuracyThreshold: 0.6,
  lowAccuracy: 8,
  staleMinDays: 4,
  stalePerDay: 1,
  staleCap: 10,
  /** exam within this many days: 第一志望-relevant points ×1.5 */
  examSoonDays: 90,
  examSoonMultiplier: 1.5,
  settledPenalty: 20,
  pastExamLevelPenalty: 40,
  highAccuracyThreshold: 0.9,
  highAccuracyPenalty: 8,
  /** minutes on this topic in the last 2 days that count as "enough" */
  recentEnoughMinutes: 60,
  recentEnoughPenalty: 10,
};

export interface PriorityInput {
  kind: "review" | "learn";
  status: Status;
  mastery: number;
  weakness: number;
  recentRate: number | null;
  recentAttempted: number;
  /** review: days past due (0 = due today); null otherwise */
  overdueDays: number | null;
  /** importance (1–5) in the 第一志望's requirements; 0 when not required */
  firstChoiceImportance: number;
  isMonthlyTarget: boolean;
  isInProgress: boolean;
  isFrontier: boolean;
  /** 0 = first unfinished topic of its category, 1 = the one after, … */
  frontierIndex?: number;
  /** not-yet-定着 topics that list this one in dependsOn */
  blocksCount: number;
  depsMet: boolean;
  daysSinceStudied: number | null;
  daysToExam: number | null;
  minutesLast2Days: number;
}

export interface PriorityResult {
  score: number;
  reasons: string[];
}

export function calculatePriority(input: PriorityInput, cfg = PRIORITY_CONFIG): PriorityResult {
  const parts: { points: number; reason: string | null }[] = [];
  const add = (points: number, reason: string | null) => parts.push({ points, reason });

  if (input.kind === "review" && input.overdueDays !== null) {
    if (input.overdueDays > 0) {
      add(
        Math.min(cfg.overdueCap, cfg.overdueBase + input.overdueDays * cfg.overduePerDay),
        `復習期限${input.overdueDays}日超過`,
      );
    } else {
      add(cfg.dueToday, "今日が復習期限");
    }
  }

  if (input.status < 3) add((100 - input.mastery) * cfg.lowMasteryFactor, null);
  if (input.weakness > 0)
    add(input.weakness * cfg.weaknessFactor, input.weakness >= 30 ? "弱点" : null);

  const soon = input.daysToExam !== null && input.daysToExam <= cfg.examSoonDays;
  if (input.firstChoiceImportance > 0) {
    const pts =
      input.firstChoiceImportance *
      cfg.firstChoicePerImportance *
      (soon ? cfg.examSoonMultiplier : 1);
    add(
      pts,
      input.firstChoiceImportance >= 4
        ? soon
          ? "本番が近い・第一志望で重要"
          : "第一志望で重要"
        : null,
    );
  } else {
    add(-cfg.notRequiredPenalty, null);
  }

  if (input.isMonthlyTarget) add(cfg.monthlyTarget, "今月の目標");
  if (input.kind === "learn" && input.isInProgress) add(cfg.inProgress, "現在学習中");
  if (input.kind === "learn" && input.isFrontier && !input.isInProgress) {
    add(cfg.frontier - (input.frontierIndex ?? 0) * cfg.frontierDecay, "次の単元");
  }
  if (input.blocksCount > 0) {
    add(
      Math.min(cfg.blocksCap, input.blocksCount * cfg.blocksPerDependent),
      `${input.blocksCount}単元の前提`,
    );
  }
  if (input.kind === "learn" && !input.depsMet) add(-cfg.depsUnmetPenalty, "前提単元が未完了");

  if (
    input.recentRate !== null &&
    input.recentAttempted >= 5 &&
    input.recentRate < cfg.lowAccuracyThreshold
  ) {
    add(cfg.lowAccuracy, `直近正答率${Math.round(input.recentRate * 100)}%`);
  }
  if (
    input.status >= 1 &&
    input.daysSinceStudied !== null &&
    input.daysSinceStudied >= cfg.staleMinDays
  ) {
    add(
      Math.min(cfg.staleCap, input.daysSinceStudied * cfg.stalePerDay),
      `${input.daysSinceStudied}日間未学習`,
    );
  }

  // lowering conditions (reviews are never suppressed — they're time-bound)
  if (input.kind === "learn") {
    if (input.status === 4) add(-cfg.pastExamLevelPenalty, null);
    else if (input.status === 3) add(-cfg.settledPenalty, null);
  }
  if (
    input.recentRate !== null &&
    input.recentAttempted >= 5 &&
    input.recentRate >= cfg.highAccuracyThreshold
  ) {
    add(-cfg.highAccuracyPenalty, null);
  }
  if (input.kind === "learn" && input.minutesLast2Days >= cfg.recentEnoughMinutes) {
    add(-cfg.recentEnoughPenalty, null);
  }

  const score = Math.round(parts.reduce((s, p) => s + p.points, 0) * 10) / 10;
  const reasons = parts
    .filter((p) => p.reason && p.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((p) => p.reason as string);
  // a blocker that couldn't be outweighed is still worth telling the user about
  const blocker = parts.find((p) => p.reason === "前提単元が未完了");
  if (blocker) reasons.push("前提単元が未完了");
  return { score, reasons };
}
