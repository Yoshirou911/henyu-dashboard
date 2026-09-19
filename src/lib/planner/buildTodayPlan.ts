import type { AllocationStatus } from "@/lib/planner/subjectAllocation";
import type { EvaluationType, ID, Status } from "@/lib/types";

/**
 * Today planner (spec §16–§18, rebalanced in Phase 3.0a).
 *
 *   0. remaining = today's available minutes − minutes already studied today
 *   1. due reviews first, capped at ~35% of the remaining time
 *   2. per-subject minute targets for the whole day:
 *        base     = dayMinutes × targetShare
 *        catch-up = balanceMinutes / catchUpDays   (+ behind / − ahead)
 *      catch-up is the *only* place the subject balance is applied (not in
 *      priority, no forced slots). Positive catch-ups are capped at
 *      maxCatchUpShare of the day; being ahead can cut a subject to at most
 *      minBaseFactor × base, so a main subject never drops to zero.
 *      need = max(0, target − minutes already studied today in that subject)
 *   3. budgets = needs scaled to the learning time left after reviews
 *   4. fill blocks: repeatedly give the next block to the subject furthest
 *      below its budget, using that subject's highest-priority topic — so the
 *      main subject can hold several blocks (no per-subject item cap). When
 *      a subject has no open topic left, an already planned topic of it is
 *      lengthened (up to maxBlocksPerItem blocks) instead
 *   5. unused minutes (< one block) become 予備
 */
export const PLAN_CONFIG = {
  reviewMinutes: 10,
  reviewShare: 0.35,
  blockMinutes: { problem: 30, language: 20, interview: 15 } as Record<EvaluationType, number>,
  minBlock: 15,
  /** block lengths are rounded down to this */
  roundTo: 5,
  /** when a subject has no more open topics, one topic may grow to this many blocks */
  maxBlocksPerItem: 2,
  /** a subject's minute deficit is made up over this many days */
  catchUpDays: 3,
  /** at most this share of the day goes to catching up on deficits */
  maxCatchUpShare: 0.35,
  /** a subject that is ahead keeps at least this fraction of its base share */
  minBaseFactor: 0.5,
  /** show "今週 英語 -45分" as a reason from this deficit on */
  deficitNoticeMinutes: 30,
  /** show "N日間未学習" for a subject not studied for this long (after it was started) */
  neglectDays: 7,
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
  /** prerequisites / roadmap order satisfied; untouched topics with false are never planned */
  depsMet?: boolean;
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
  /** 今日使える時間 as set by the user (whole day) */
  totalMinutes: number;
  /** minutes already studied today */
  doneMinutes: number;
  /** minutes left to plan: max(0, total − done) */
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

/**
 * Per-subject minute targets for the whole day (step 2). Exported for tests
 * and so the numbers behind a plan can be inspected.
 */
export function dailySubjectTargets(
  dayMinutes: number,
  allocation: readonly AllocationStatus[],
  config: Partial<typeof PLAN_CONFIG> = {},
): Map<ID, number> {
  const cfg = { ...PLAN_CONFIG, ...config };
  const catchUps = new Map(
    allocation.map((a) => [a.subjectId, a.balanceMinutes / Math.max(1, cfg.catchUpDays)]),
  );
  const positive = [...catchUps.values()].filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const cap = dayMinutes * cfg.maxCatchUpShare;
  const scale = positive > cap && positive > 0 ? cap / positive : 1;

  const out = new Map<ID, number>();
  for (const a of allocation) {
    const base = dayMinutes * a.targetShare;
    const c = catchUps.get(a.subjectId) ?? 0;
    const target = c > 0 ? base + c * scale : Math.max(base * cfg.minBaseFactor, base + c);
    out.set(a.subjectId, Math.max(0, target));
  }
  return out;
}

export function buildTodayPlan(input: {
  availableMinutes: number;
  candidates: readonly PlanCandidate[];
  allocation: readonly AllocationStatus[];
  /** minutes already studied today (all subjects) */
  doneMinutes?: number;
  config?: Partial<typeof PLAN_CONFIG>;
}): TodayPlan {
  const cfg = { ...PLAN_CONFIG, ...input.config };
  const total = Math.max(0, Math.round(input.availableMinutes));
  const done = Math.max(0, Math.round(input.doneMinutes ?? 0));
  const avail = Math.max(0, total - done);
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

  // learnable work per subject, best first; untouched topics behind unmet
  // prerequisites are left out entirely
  const queues = new Map<ID, PlanCandidate[]>();
  for (const c of input.candidates.filter((c) => c.kind === "learn").sort(byPriority)) {
    if (inPlan.has(c.topicId)) continue;
    if (c.depsMet === false && c.status === 0) continue;
    const q = queues.get(c.subjectId) ?? [];
    q.push(c);
    queues.set(c.subjectId, q);
  }

  // 2–3. budgets over the subjects that have something to do
  const alloc = new Map(input.allocation.map((a) => [a.subjectId, a]));
  const targets = dailySubjectTargets(total, input.allocation, cfg);
  const planSubjects = [...queues.keys()].filter((s) => (alloc.get(s)?.targetShare ?? 0) > 0);
  const needs = new Map(
    planSubjects.map((s) => [
      s,
      Math.max(0, (targets.get(s) ?? 0) - (alloc.get(s)?.todayMinutes ?? 0)),
    ]),
  );
  const needTotal = [...needs.values()].reduce((s, v) => s + v, 0);
  const shareTotal = planSubjects.reduce((s, id) => s + (alloc.get(id)?.targetShare ?? 0), 0);
  const budget = new Map(
    planSubjects.map((s) => [
      s,
      needTotal > 0
        ? (remaining * (needs.get(s) ?? 0)) / needTotal
        : (remaining * (alloc.get(s)?.targetShare ?? 0)) / (shareTotal || 1),
    ]),
  );
  const planned = new Map<ID, number>();

  const subjectReason = (subjectId: ID, subjectName: string): string | undefined => {
    const a = alloc.get(subjectId);
    if (!a || (planned.get(subjectId) ?? 0) > 0) return undefined;
    if (a.deficitMinutes >= cfg.deficitNoticeMinutes)
      return `今週 ${subjectName} -${Math.round(a.deficitMinutes)}分`;
    if (a.daysSinceStudied !== null && a.daysSinceStudied >= cfg.neglectDays)
      return `${a.daysSinceStudied}日間未学習`;
    return undefined;
  };

  const place = (c: PlanCandidate, minutes: number) => {
    const extra = subjectReason(c.subjectId, c.subjectName);
    const reasons = extra && !c.reasons.includes(extra) ? [extra, ...c.reasons] : c.reasons;
    items.push({ ...c, reasons, minutes, task: learnTask(c, minutes) });
    inPlan.add(c.topicId);
    remaining -= minutes;
    planned.set(c.subjectId, (planned.get(c.subjectId) ?? 0) + minutes);
  };

  // a subject that ran out of open topics (e.g. early roadmap: only 2 unlocked)
  // can still use its budget by giving a planned learning item more time
  const maxItem = (i: PlanItem) => cfg.blockMinutes[i.evaluationType] * cfg.maxBlocksPerItem;
  const extendable = (s: ID) =>
    items
      .filter(
        (i) => i.kind === "learn" && i.subjectId === s && maxItem(i) - i.minutes >= cfg.roundTo,
      )
      .sort((a, b) => a.minutes - b.minutes || b.priority - a.priority)[0];

  // 4. next block → subject furthest below its budget
  const unmet = (s: ID) => (budget.get(s) ?? 0) - (planned.get(s) ?? 0);
  const pickSubject = (): ID | undefined =>
    planSubjects
      .filter((s) => (queues.get(s)?.length ?? 0) > 0 || extendable(s) !== undefined)
      .sort(
        (a, b) =>
          unmet(b) - unmet(a) ||
          (alloc.get(b)?.targetShare ?? 0) - (alloc.get(a)?.targetShare ?? 0) ||
          a.localeCompare(b),
      )[0];
  const roundDown = (m: number) => Math.floor(m / cfg.roundTo) * cfg.roundTo;

  while (remaining >= cfg.minBlock) {
    const s = pickSubject();
    if (s === undefined) break;
    const queue = queues.get(s) ?? [];
    // a remainder smaller than a block lengthens planned work rather than opening a new topic
    const next = unmet(s) < cfg.minBlock && extendable(s) !== undefined ? undefined : queue.shift();
    if (next) {
      const minutes = Math.min(
        remaining,
        Math.max(
          cfg.minBlock,
          Math.min(cfg.blockMinutes[next.evaluationType], roundDown(unmet(s))),
        ),
      );
      place(next, minutes);
      continue;
    }
    const item = extendable(s) as PlanItem;
    const add = Math.min(
      remaining,
      maxItem(item) - item.minutes,
      Math.max(cfg.minBlock, roundDown(unmet(s))),
    );
    item.minutes += add;
    item.task = learnTask(item, item.minutes);
    remaining -= add;
    planned.set(s, (planned.get(s) ?? 0) + add);
  }

  items.sort((a, b) => b.priority - a.priority);
  const plannedMinutes = items.reduce((s, i) => s + i.minutes, 0);
  return {
    totalMinutes: total,
    doneMinutes: done,
    availableMinutes: avail,
    items,
    plannedMinutes,
    bufferMinutes: Math.max(0, avail - plannedMinutes),
  };
}
