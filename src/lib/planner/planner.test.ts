import { describe, expect, it } from "vitest";
import { DAY_MS } from "@/lib/date";
import { buildTodayPlan, type PlanCandidate } from "@/lib/planner/buildTodayPlan";
import { calculatePriority, type PriorityInput } from "@/lib/planner/calculatePriority";
import {
  computeAllocationStatus,
  normaliseAllocation,
  type AllocationStatus,
} from "@/lib/planner/subjectAllocation";
import type { StudySession } from "@/lib/types";

/* ------------------------------- priority ------------------------------- */

function pInput(partial: Partial<PriorityInput> = {}): PriorityInput {
  return {
    kind: "learn",
    status: 1,
    mastery: 20,
    weakness: 0,
    recentRate: null,
    recentAttempted: 0,
    overdueDays: null,
    firstChoiceImportance: 5,
    isMonthlyTarget: false,
    isInProgress: true,
    isFrontier: false,
    blocksCount: 0,
    depsMet: true,
    daysSinceStudied: 0,
    allocationDeficit: 0,
    daysToExam: 300,
    minutesLast2Days: 0,
    ...partial,
  };
}
const score = (p: Partial<PriorityInput>) => calculatePriority(pInput(p)).score;

describe("calculatePriority", () => {
  it("ranks overdue reviews above due-today reviews, growing with days", () => {
    const today = score({ kind: "review", overdueDays: 0 });
    const one = score({ kind: "review", overdueDays: 1 });
    const three = score({ kind: "review", overdueDays: 3 });
    expect(one).toBeGreaterThan(today);
    expect(three).toBeGreaterThan(one);
    expect(calculatePriority(pInput({ kind: "review", overdueDays: 2 })).reasons[0]).toBe(
      "復習期限2日超過",
    );
  });

  it("raises for low mastery, weakness, monthly target, blockers and low accuracy", () => {
    const base = score({});
    expect(score({ mastery: 0 })).toBeGreaterThan(base);
    expect(score({ weakness: 60 })).toBeGreaterThan(base);
    expect(score({ isMonthlyTarget: true })).toBeGreaterThan(base);
    expect(score({ blocksCount: 2 })).toBeGreaterThan(base);
    expect(score({ recentRate: 0.4, recentAttempted: 10 })).toBeGreaterThan(base);
    expect(score({ daysSinceStudied: 6 })).toBeGreaterThan(base);
    expect(score({ allocationDeficit: 1 })).toBeGreaterThan(base);
  });

  it("lowers for settled / past-exam-level topics, unmet prerequisites and recent heavy study", () => {
    const base = score({});
    expect(score({ status: 3, isInProgress: false })).toBeLessThan(base);
    expect(score({ status: 4, isInProgress: false })).toBeLessThan(
      score({ status: 3, isInProgress: false }),
    );
    expect(score({ depsMet: false })).toBeLessThan(base);
    expect(score({ minutesLast2Days: 90 })).toBeLessThan(base);
    expect(score({ recentRate: 0.95, recentAttempted: 20 })).toBeLessThan(base);
  });

  it("weights the 第一志望 and boosts it when the exam is near", () => {
    expect(score({ firstChoiceImportance: 5 })).toBeGreaterThan(
      score({ firstChoiceImportance: 0 }),
    );
    expect(score({ daysToExam: 30 })).toBeGreaterThan(score({ daysToExam: 300 }));
  });

  it("explains itself", () => {
    const r = calculatePriority(pInput({ isMonthlyTarget: true, daysSinceStudied: 5 }));
    expect(r.reasons).toContain("今月の目標");
    expect(r.reasons).toContain("現在学習中");
    expect(r.reasons).toContain("5日間未学習");
    expect(calculatePriority(pInput({ depsMet: false })).reasons).toContain("前提単元が未完了");
  });
});

/* ------------------------------ allocation ------------------------------ */

const NOW = new Date("2026-09-19T20:00:00").getTime();
function sess(subjectId: string, minutes: number, daysAgo = 0): StudySession {
  const started = NOW - daysAgo * DAY_MS - minutes * 60_000;
  return {
    id: `${subjectId}-${minutes}-${daysAgo}`,
    topicId: null,
    subjectId,
    startedAt: started,
    endedAt: started + minutes * 60_000,
    durationSec: minutes * 60,
    source: "manual",
    createdAt: started,
  };
}

describe("subjectAllocation", () => {
  it("normalises percentages", () => {
    const n = normaliseAllocation({ math: 60, english: 20, physics: 20 }, ["math", "english"]);
    expect(n.get("math")).toBeCloseTo(0.75);
    expect(n.get("english")).toBeCloseTo(0.25);
  });

  it("computes actual share, deficit and days since studied over 7 days", () => {
    const status = computeAllocationStatus({
      allocation: { math: 60, english: 40 },
      subjectIds: ["math", "english"],
      sessions: [sess("math", 300, 1), sess("english", 0, 0), sess("english", 30, 9)],
      now: NOW,
    });
    const math = status.find((s) => s.subjectId === "math") as AllocationStatus;
    const english = status.find((s) => s.subjectId === "english") as AllocationStatus;
    expect(math.actualShare).toBe(1);
    expect(math.deficitRatio).toBe(0);
    expect(english.actualMinutes).toBe(0);
    expect(english.deficitRatio).toBe(1);
    expect(english.daysSinceStudied).toBe(0); // the zero-minute session still counts as touched
  });

  it("reports never-studied subjects as null", () => {
    const [s] = computeAllocationStatus({
      allocation: { cs: 10 },
      subjectIds: ["cs"],
      sessions: [],
      now: NOW,
    });
    expect(s?.daysSinceStudied).toBeNull();
    // an empty window has no meaningful deficit
    expect(s?.deficitRatio).toBe(0);
  });
});

/* ------------------------------ today plan ------------------------------ */

function cand(partial: Partial<PlanCandidate> & Pick<PlanCandidate, "topicId">): PlanCandidate {
  return {
    kind: "learn",
    subjectId: "math",
    topicName: partial.topicId,
    subjectName: "数学",
    categoryName: "極限",
    evaluationType: "problem",
    status: 1,
    isVocab: false,
    priority: 50,
    reasons: [],
    ...partial,
  };
}
const alloc = (subjectId: string, targetShare: number, extra: Partial<AllocationStatus> = {}) =>
  ({
    subjectId,
    targetShare,
    actualShare: targetShare,
    actualMinutes: 60,
    deficitRatio: 0,
    daysSinceStudied: 0,
    ...extra,
  }) satisfies AllocationStatus;

const pool: PlanCandidate[] = [
  cand({ topicId: "limit", priority: 90 }),
  cand({ topicId: "frac-review", kind: "review", priority: 95, overdueDays: 2, reviewId: "r1" }),
  cand({ topicId: "deriv", priority: 70 }),
  cand({ topicId: "matrix", priority: 60 }),
  cand({ topicId: "mech", subjectId: "physics", subjectName: "物理", priority: 55 }),
  cand({
    topicId: "vocab",
    subjectId: "english",
    subjectName: "英語",
    evaluationType: "language",
    isVocab: true,
    priority: 30,
  }),
];
const allocation = [alloc("math", 0.6), alloc("physics", 0.25), alloc("english", 0.15)];

describe("buildTodayPlan", () => {
  it("fits within the available time and reports the buffer", () => {
    for (const minutes of [30, 60, 90, 120, 180]) {
      const plan = buildTodayPlan({ availableMinutes: minutes, candidates: pool, allocation });
      expect(plan.plannedMinutes).toBeLessThanOrEqual(minutes);
      expect(plan.plannedMinutes + plan.bufferMinutes).toBe(minutes);
    }
  });

  it("30 minutes → only the most important work", () => {
    const plan = buildTodayPlan({ availableMinutes: 30, candidates: pool, allocation });
    expect(plan.items.map((i) => i.topicId)).toEqual(["frac-review", "limit"]);
    expect(plan.items[0]?.task).toBe("復習5問");
  });

  it("180 minutes → reviews, main subject, sub subjects and English", () => {
    const plan = buildTodayPlan({ availableMinutes: 180, candidates: pool, allocation });
    const subjects = new Set(plan.items.map((i) => i.subjectId));
    expect(subjects).toEqual(new Set(["math", "physics", "english"]));
    expect(plan.items.some((i) => i.kind === "review")).toBe(true);
    expect(plan.items.find((i) => i.topicId === "vocab")?.task).toMatch(/語$/);
  });

  it("forces a subject that has been skipped for 7 days, even at 60 minutes", () => {
    const neglected = [
      alloc("math", 0.6),
      alloc("physics", 0.25),
      alloc("english", 0.15, { daysSinceStudied: 7, deficitRatio: 1, actualMinutes: 0 }),
    ];
    const plan = buildTodayPlan({ availableMinutes: 60, candidates: pool, allocation: neglected });
    const english = plan.items.find((i) => i.subjectId === "english");
    expect(english).toBeDefined();
    expect(english?.reasons[0]).toBe("7日間未学習");
  });

  it("does not force anything on a fresh start with no study history", () => {
    const fresh = [
      alloc("math", 0.6, { daysSinceStudied: null }),
      alloc("english", 0.4, { daysSinceStudied: null }),
    ];
    const plan = buildTodayPlan({ availableMinutes: 120, candidates: pool, allocation: fresh });
    expect(plan.items.every((i) => !i.reasons.includes("今週まだ未学習"))).toBe(true);
  });

  it("does not force neglected subjects when time is very short", () => {
    const neglected = [alloc("math", 0.6), alloc("english", 0.4, { daysSinceStudied: 9 })];
    const plan = buildTodayPlan({ availableMinutes: 30, candidates: pool, allocation: neglected });
    expect(plan.items.some((i) => i.subjectId === "english")).toBe(false);
  });

  it("recalculates when available time changes", () => {
    const small = buildTodayPlan({ availableMinutes: 60, candidates: pool, allocation });
    const large = buildTodayPlan({ availableMinutes: 180, candidates: pool, allocation });
    expect(large.items.length).toBeGreaterThan(small.items.length);
  });

  it("caps reviews to about a third of the day", () => {
    const manyReviews = Array.from({ length: 10 }, (_, i) =>
      cand({
        topicId: `rev${i}`,
        kind: "review",
        priority: 100 - i,
        reviewId: `r${i}`,
        overdueDays: 0,
      }),
    );
    const plan = buildTodayPlan({
      availableMinutes: 120,
      candidates: [...manyReviews, ...pool],
      allocation,
    });
    const reviewMinutes = plan.items
      .filter((i) => i.kind === "review")
      .reduce((s, i) => s + i.minutes, 0);
    expect(reviewMinutes).toBeLessThanOrEqual(42);
    expect(plan.items.some((i) => i.kind === "learn")).toBe(true);
  });

  it("returns an empty plan when there is nothing to do", () => {
    const plan = buildTodayPlan({ availableMinutes: 90, candidates: [], allocation });
    expect(plan.items).toHaveLength(0);
    expect(plan.bufferMinutes).toBe(90);
  });
});
