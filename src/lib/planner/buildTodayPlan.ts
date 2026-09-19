import type { AllocationStatus } from "@/lib/planner/subjectAllocation";
import type { EvaluationType, ID, Status } from "@/lib/types";

/**
 * Today planner (spec §16–§18). Given the candidates (already scored with
 * `calculatePriority`) and the minutes available, pick a balanced list:
 *
 *   1. due reviews first, capped at ~35% of the time
 *   2. per-subject budgets from the long-term allocation, boosted for
 *      subjects that are behind this week
 *   3. highest-priority learning blocks within those budgets
 *   4. a subject with ≥10% allocation and no study for 7 days is forced in
 *      (when ≥60 min are available) so nothing silently starves
 *   5. whatever is left becomes 予備
 */
export const PLAN_CONFIG = {
  reviewMinutes: 10,
  reviewShare: 0.35,
  blockMinutes: { problem: 30, language: 20, interview: 15 } as Record<EvaluationType, number>,
  minBlock: 15,
  maxPerSubjectSmall: 2,
  maxPerSubjectLarge: 3,
  largeDayMinutes: 150,
  budgetSlack: 10,
  neglectMinAvailable: 60,
  neglectMinShare: 0.1,
  neglectDays: 7,
  neglectMinutes: 20,
};

export interface PlanCandidate {
  kind: "review" | "learn";
  topicId: ID;
  subjectId: ID;
  topicName: string;
  subjectName: string;
  categoryName: string;
  evaluationType: EvaluationType;
  status: Status;
  /** vocabulary-style topic: measured in words rather than problems */
  isVocab: boolean;
  reviewId?: ID;
  overdueDays?: number | null;
  priority: number;
  reasons: string[];
}

export interface PlanItem extends PlanCandidate {
  minutes: number;
  /** "基本問題5問", "復習3問", "20語" … */
  task: string;
}

export interface TodayPlan {
  availableMinutes: number;
  items: PlanItem[];
  plannedMinutes: number;
  bufferMinutes: number;
}

export function reviewTask(c: PlanCandidate): string {
  if (c.isVocab) return "20語";
  if (c.evaluationType === "problem") return (c.overdueDays ?? 0) >= 1 ? "復習5問" : "復習3問";
  if (c.evaluationType === "interview") return "見直し";
  return "復習";
}

export function learnTask(c: PlanCandidate, minutes: number): string {
  if (c.evaluationType === "problem") {
    if (c.status === 0) return "導入・例題";
    if (c.status === 1) return "基本問題5問";
    if (c.status === 2) return "標準問題3問";
    return "発展・過去問";
  }
  if (c.evaluationType === "language") {
    if (c.isVocab) return `${minutes}語`;
    return c.status === 0 ? "導入" : "演習";
  }
  return "回答を準備";
}

export function buildTodayPlan(input: {
  availableMinutes: number;
  candidates: readonly PlanCandidate[];
  allocation: readonly AllocationStatus[];
  config?: Partial<typeof PLAN_CONFIG>;
}): TodayPlan {
  const cfg = { ...PLAN_CONFIG, ...input.config };
  const avail = Math.max(0, Math.round(input.availableMinutes));
  const items: PlanItem[] = [];
  const inPlan = new Set<ID>();
  const byPriority = (a: PlanCandidate, b: PlanCandidate) =>
    b.priority - a.priority || a.topicId.localeCompare(b.topicId);

  // 1. reviews
  const reviewCap = Math.min(
    avail,
    Math.max(cfg.reviewMinutes, Math.floor(avail * cfg.reviewShare)),
  );
  let used = 0;
  for (const c of input.candidates.filter((c) => c.kind === "review").sort(byPriority)) {
    if (used + cfg.reviewMinutes > reviewCap) break;
    if (inPlan.has(c.topicId)) continue;
    items.push({ ...c, minutes: cfg.reviewMinutes, task: reviewTask(c) });
    inPlan.add(c.topicId);
    used += cfg.reviewMinutes;
  }
  let remaining = avail - used;

  // 2. budgets
  const learn = input.candidates
    .filter((c) => c.kind === "learn" && !inPlan.has(c.topicId))
    .sort(byPriority);
  const alloc = new Map(input.allocation.map((a) => [a.subjectId, a]));
  const subjects = [...new Set(learn.map((c) => c.subjectId))];
  const weights = new Map(
    subjects.map((s) => {
      const a = alloc.get(s);
      return [s, (a?.targetShare ?? 0) * (1 + (a?.deficitRatio ?? 0))];
    }),
  );
  const weightTotal = [...weights.values()].reduce((s, w) => s + w, 0);
  const budget = new Map(
    subjects.map((s) => [
      s,
      weightTotal > 0
        ? (remaining * (weights.get(s) ?? 0)) / weightTotal
        : remaining / subjects.length,
    ]),
  );
  const planned = new Map<ID, number>();
  const count = new Map<ID, number>();
  const maxPerSubject =
    avail >= cfg.largeDayMinutes ? cfg.maxPerSubjectLarge : cfg.maxPerSubjectSmall;

  // 3. neglected subjects get a guaranteed slot
  const forced = new Set<PlanCandidate>();
  // Only meaningful once there is history: on a fresh start every subject is
  // "unstudied" and the normal budgets already spread the time.
  const hasHistory = input.allocation.some((a) => a.daysSinceStudied !== null);
  if (avail >= cfg.neglectMinAvailable && hasHistory) {
    const neglected = input.allocation
      .filter(
        (a) =>
          a.targetShare >= cfg.neglectMinShare &&
          (a.daysSinceStudied === null || a.daysSinceStudied >= cfg.neglectDays),
      )
      .sort((a, b) => b.targetShare - a.targetShare);
    for (const a of neglected) {
      const top = learn.find((c) => c.subjectId === a.subjectId);
      if (top) forced.add(top);
    }
  }
  const reservedFor = () =>
    [...forced].filter((c) => !inPlan.has(c.topicId)).length * cfg.neglectMinutes;

  const place = (c: PlanCandidate, minutes: number, extraReason?: string) => {
    const reasons =
      extraReason && !c.reasons.includes(extraReason) ? [extraReason, ...c.reasons] : c.reasons;
    items.push({ ...c, reasons, minutes, task: learnTask(c, minutes) });
    inPlan.add(c.topicId);
    remaining -= minutes;
    planned.set(c.subjectId, (planned.get(c.subjectId) ?? 0) + minutes);
    count.set(c.subjectId, (count.get(c.subjectId) ?? 0) + 1);
  };

  // 4. greedy by priority within budgets
  const deferred: PlanCandidate[] = [];
  for (const c of learn) {
    if (remaining < cfg.minBlock) break;
    if (inPlan.has(c.topicId)) continue;

    if (forced.has(c)) {
      const a = alloc.get(c.subjectId);
      const reason =
        a?.daysSinceStudied === null
          ? "今週まだ未学習"
          : `${a?.daysSinceStudied ?? cfg.neglectDays}日間未学習`;
      place(
        c,
        Math.min(Math.max(cfg.neglectMinutes, cfg.blockMinutes[c.evaluationType]), remaining),
        reason,
      );
      continue;
    }
    if ((count.get(c.subjectId) ?? 0) >= maxPerSubject) continue;

    const free = remaining - reservedFor();
    if (free < cfg.minBlock) {
      deferred.push(c);
      continue;
    }
    const over =
      (planned.get(c.subjectId) ?? 0) >= (budget.get(c.subjectId) ?? 0) + cfg.budgetSlack;
    const othersWaiting = learn.some(
      (o) =>
        !inPlan.has(o.topicId) &&
        o.subjectId !== c.subjectId &&
        (planned.get(o.subjectId) ?? 0) < (budget.get(o.subjectId) ?? 0),
    );
    if (over && othersWaiting) {
      deferred.push(c);
      continue;
    }
    place(c, Math.min(cfg.blockMinutes[c.evaluationType], free));
  }

  // 5. fill leftover time with deferred work
  for (const c of deferred) {
    if (remaining < cfg.minBlock) break;
    if (inPlan.has(c.topicId) || (count.get(c.subjectId) ?? 0) >= maxPerSubject) continue;
    place(c, Math.min(cfg.blockMinutes[c.evaluationType], remaining));
  }

  items.sort((a, b) => b.priority - a.priority);
  const plannedMinutes = items.reduce((s, i) => s + i.minutes, 0);
  return {
    availableMinutes: avail,
    items,
    plannedMinutes,
    bufferMinutes: Math.max(0, avail - plannedMinutes),
  };
}
