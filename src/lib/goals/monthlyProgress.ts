import type { ID, MonthlyGoal, Status } from "@/lib/types";
import { STATUS_SCORE } from "@/lib/types";

export type Pace = "ahead" | "on_track" | "slightly_behind" | "far_behind";

export const PACE_META: Record<
  Pace,
  { label: string; tone: "success" | "default" | "warning" | "destructive" }
> = {
  ahead: { label: "前倒し", tone: "success" },
  on_track: { label: "予定通り", tone: "default" },
  slightly_behind: { label: "少し遅れ", tone: "warning" },
  far_behind: { label: "大幅遅れ", tone: "destructive" },
};

export const PACE_CONFIG = {
  aheadMargin: 0.1,
  onTrackMargin: -0.1,
  slightlyBehindMargin: -0.25,
};

/** 0–1 progress of a single goal. Measurable goals use the target topic's status. */
export function goalProgress(
  goal: MonthlyGoal,
  statusOf: (topicId: ID) => Status | undefined,
): number {
  if (goal.targetTopicId && goal.targetStatus !== undefined) {
    const current = statusOf(goal.targetTopicId);
    if (current === undefined) return goal.done ? 1 : 0;
    const target = STATUS_SCORE[goal.targetStatus];
    if (target === 0) return 1;
    return Math.min(1, STATUS_SCORE[current] / target);
  }
  return goal.done ? 1 : 0;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y ?? 1970, m ?? 1, 0).getDate();
}

/** Fraction of `month` ("YYYY-MM") elapsed at `now`: 0 before, 1 after. */
export function monthElapsed(month: string, now: Date = new Date()): number {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y ?? 1970, (m ?? 1) - 1, 1).getTime();
  const end = new Date(y ?? 1970, m ?? 1, 1).getTime();
  const t = now.getTime();
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

export function daysLeftInMonth(month: string, now: Date = new Date()): number {
  const elapsed = monthElapsed(month, now);
  if (elapsed >= 1) return 0;
  const total = daysInMonth(month);
  if (elapsed <= 0) return total;
  return total - now.getDate() + 1;
}

export function judgePace(progress: number, elapsed: number, cfg = PACE_CONFIG): Pace {
  const diff = progress - elapsed;
  if (diff >= cfg.aheadMargin) return "ahead";
  if (diff >= cfg.onTrackMargin) return "on_track";
  if (diff >= cfg.slightlyBehindMargin) return "slightly_behind";
  return "far_behind";
}

export interface MonthlySubjectSummary {
  subjectId: ID;
  goals: { goal: MonthlyGoal; progress: number }[];
  progress: number;
  pace: Pace;
}

export interface MonthlySummary {
  month: string;
  daysLeft: number;
  elapsed: number;
  subjects: MonthlySubjectSummary[];
  progress: number;
  pace: Pace | null;
}

export function monthlySummary(
  month: string,
  goals: readonly MonthlyGoal[],
  statusOf: (topicId: ID) => Status | undefined,
  now: Date = new Date(),
): MonthlySummary {
  const elapsed = monthElapsed(month, now);
  const bySubject = new Map<ID, { goal: MonthlyGoal; progress: number }[]>();
  for (const goal of goals.filter((g) => g.month === month)) {
    const arr = bySubject.get(goal.subjectId) ?? [];
    arr.push({ goal, progress: goalProgress(goal, statusOf) });
    bySubject.set(goal.subjectId, arr);
  }
  const subjects: MonthlySubjectSummary[] = [...bySubject.entries()].map(([subjectId, items]) => {
    const progress = items.reduce((s, i) => s + i.progress, 0) / items.length;
    return { subjectId, goals: items, progress, pace: judgePace(progress, elapsed) };
  });
  const all = subjects.flatMap((s) => s.goals);
  const progress = all.length > 0 ? all.reduce((s, i) => s + i.progress, 0) / all.length : 0;
  return {
    month,
    daysLeft: daysLeftInMonth(month, now),
    elapsed,
    subjects,
    progress,
    pace: all.length > 0 ? judgePace(progress, elapsed) : null,
  };
}
