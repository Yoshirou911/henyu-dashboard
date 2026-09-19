import { describe, expect, it } from "vitest";
import { DAY_MS, startOfDay } from "@/lib/date";
import {
  PLAN_CONFIG,
  buildTodayPlan,
  dailySubjectTargets,
  type PlanCandidate,
  type TodayPlan,
} from "@/lib/planner/buildTodayPlan";
import { calculatePriority, type PriorityInput } from "@/lib/planner/calculatePriority";
import {
  computeAllocationStatus,
  normaliseAllocation,
  type AllocationStatus,
} from "@/lib/planner/subjectAllocation";
import type { EvaluationType, StudySession } from "@/lib/types";

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
let seq = 0;
function sess(subjectId: string, minutes: number, daysAgo = 0): StudySession {
  const started = NOW - daysAgo * DAY_MS - minutes * 60_000;
  return {
    id: `s${seq++}`,
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

  const status = (sessions: StudySession[], weeklyGoalMinutes = 700) => {
    const all = computeAllocationStatus({
      allocation: { math: 60, english: 40 },
      subjectIds: ["math", "english"],
      sessions,
      weeklyGoalMinutes,
      now: NOW,
    });
    return {
      math: all.find((s) => s.subjectId === "math") as AllocationStatus,
      english: all.find((s) => s.subjectId === "english") as AllocationStatus,
    };
  };

  it("measures the balance in minutes against the weekly goal, excluding today", () => {
    // 7 tracked days: math expects 420, english 280
    const { math, english } = status([
      sess("math", 300, 1),
      sess("english", 30, 9), // tracking started 9 days ago; outside the window
      sess("math", 45, 0), // today
    ]);
    expect(math.expectedMinutes).toBeCloseTo(420);
    expect(math.pastMinutes).toBe(300);
    expect(math.balanceMinutes).toBeCloseTo(120);
    expect(math.todayMinutes).toBe(45);
    expect(english.pastMinutes).toBe(0);
    expect(english.deficitMinutes).toBeCloseTo(280);
    expect(english.daysSinceStudied).toBe(9);
  });

  it("reports being ahead as a negative balance and zero deficit", () => {
    const { math } = status([sess("math", 600, 1), sess("math", 10, 7)]);
    expect(math.balanceMinutes).toBeLessThan(0);
    expect(math.deficitMinutes).toBe(0);
  });

  it("expects nothing on the first day: not having started yet is not a deficit", () => {
    const { math, english } = status([sess("math", 25, 0)]);
    expect(math.expectedMinutes).toBe(0);
    expect(english.deficitMinutes).toBe(0);
    expect(english.daysSinceStudied).toBeNull();
  });

  it("pro-rates the expectation by the days since tracking started (1 / 6 / 7 / capped)", () => {
    expect(status([sess("math", 10, 1)]).english.expectedMinutes).toBeCloseTo(40);
    expect(status([sess("math", 10, 6)]).english.expectedMinutes).toBeCloseTo(240);
    expect(status([sess("math", 10, 7)]).english.expectedMinutes).toBeCloseTo(280);
    expect(status([sess("math", 10, 30)]).english.expectedMinutes).toBeCloseTo(280);
  });

  it("turns the minute balance off when the weekly goal is 0", () => {
    const { math, english } = status([sess("math", 300, 3)], 0);
    expect(math.balanceMinutes).toBe(0);
    expect(english.deficitMinutes).toBe(0);
  });

  it("keeps the 7-day share (incl. today) for display", () => {
    const { math, english } = status([sess("math", 30, 0), sess("english", 30, 2)]);
    expect(math.actualShare).toBeCloseTo(0.5);
    expect(english.actualMinutes).toBe(30);
  });
});

/* ------------------------------ daily targets ------------------------------ */

const alloc = (subjectId: string, targetShare: number, extra: Partial<AllocationStatus> = {}) =>
  ({
    subjectId,
    targetShare,
    actualShare: targetShare,
    actualMinutes: 0,
    expectedMinutes: 0,
    pastMinutes: 0,
    balanceMinutes: 0,
    deficitMinutes: 0,
    todayMinutes: 0,
    daysSinceStudied: 0,
    ...extra,
  }) satisfies AllocationStatus;

describe("dailySubjectTargets", () => {
  it("is the base share when balanced", () => {
    const t = dailySubjectTargets(120, [alloc("math", 0.6), alloc("english", 0.4)]);
    expect(t.get("math")).toBeCloseTo(72);
    expect(t.get("english")).toBeCloseTo(48);
  });

  it("adds a deficit spread over catchUpDays", () => {
    const t = dailySubjectTargets(120, [
      alloc("math", 0.6),
      alloc("english", 0.4, { balanceMinutes: 30, deficitMinutes: 30 }),
    ]);
    expect(t.get("english")).toBeCloseTo(48 + 30 / PLAN_CONFIG.catchUpDays);
  });

  it("caps the total catch-up at maxCatchUpShare of the day (boundary)", () => {
    const cap = 120 * PLAN_CONFIG.maxCatchUpShare;
    const at = dailySubjectTargets(120, [
      alloc("math", 0.6),
      alloc("english", 0.4, { balanceMinutes: cap * PLAN_CONFIG.catchUpDays }),
    ]);
    expect(at.get("english")).toBeCloseTo(48 + cap);
    const over = dailySubjectTargets(120, [
      alloc("math", 0.5),
      alloc("english", 0.25, { balanceMinutes: 600 }),
      alloc("physics", 0.25, { balanceMinutes: 300 }),
    ]);
    const eng = (over.get("english") ?? 0) - 30;
    const phy = (over.get("physics") ?? 0) - 30;
    expect(eng + phy).toBeCloseTo(cap);
    expect(eng).toBeCloseTo(2 * phy);
    expect(over.get("math")).toBeCloseTo(60);
  });

  it("cuts a subject that is ahead, but never below minBaseFactor × base", () => {
    const mild = dailySubjectTargets(120, [alloc("math", 0.6, { balanceMinutes: -30 })]);
    expect(mild.get("math")).toBeCloseTo(72 - 30 / PLAN_CONFIG.catchUpDays);
    const far = dailySubjectTargets(120, [alloc("math", 0.6, { balanceMinutes: -1000 })]);
    expect(far.get("math")).toBeCloseTo(72 * PLAN_CONFIG.minBaseFactor);
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
const minutesBy = (plan: TodayPlan, subjectId: string) =>
  plan.items.filter((i) => i.subjectId === subjectId).reduce((s, i) => s + i.minutes, 0);

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

  it("names a real weekly deficit and a long-neglected subject in the reasons", () => {
    const plan = buildTodayPlan({
      availableMinutes: 120,
      candidates: pool,
      allocation: [
        alloc("math", 0.6),
        alloc("physics", 0.25, { balanceMinutes: 45, deficitMinutes: 45 }),
        alloc("english", 0.15, { daysSinceStudied: 8 }),
      ],
    });
    expect(plan.items.find((i) => i.subjectId === "physics")?.reasons[0]).toBe("今週 物理 -45分");
    expect(plan.items.find((i) => i.subjectId === "english")?.reasons[0]).toBe("8日間未学習");
  });

  it("does not mention a deficit below deficitNoticeMinutes (boundary)", () => {
    const below = PLAN_CONFIG.deficitNoticeMinutes - 1;
    const plan = buildTodayPlan({
      availableMinutes: 120,
      candidates: pool,
      allocation: [
        alloc("math", 0.6),
        alloc("physics", 0.25, { balanceMinutes: below, deficitMinutes: below }),
        alloc("english", 0.15),
      ],
    });
    expect(plan.items.find((i) => i.subjectId === "physics")?.reasons).toEqual([]);
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

  it("leaves subjects with a 0% allocation out", () => {
    const plan = buildTodayPlan({
      availableMinutes: 180,
      candidates: pool,
      allocation: [alloc("math", 0.7), alloc("physics", 0.3), alloc("english", 0)],
    });
    expect(plan.items.some((i) => i.subjectId === "english")).toBe(false);
  });
});

/* -------------------- scenarios (Phase 3.0a acceptance) -------------------- */

/** the seeded default allocation */
const ALLOC = {
  math: 60,
  english: 10,
  physics: 10,
  toeic: 5,
  cpp: 5,
  algo: 5,
  cs: 3,
  interview: 2,
};
const SUBJECTS = Object.keys(ALLOC);
const EVAL: Record<string, EvaluationType> = {
  english: "language",
  toeic: "language",
  interview: "interview",
};
/** 第一志望 importance, as in the seeded 電通大 requirements */
const IMPORTANCE: Record<string, number> = { math: 5, physics: 4, english: 4, interview: 1 };

/**
 * Runs the real pipeline (allocation → priority → plan) on a synthetic
 * roadmap: each subject has one topic in progress and a few "next" topics.
 */
function simulate(opts: {
  sessions: StudySession[];
  minutes: number;
  weeklyGoal?: number;
  extra?: PlanCandidate[];
}): TodayPlan {
  const allocation = computeAllocationStatus({
    allocation: ALLOC,
    subjectIds: SUBJECTS,
    sessions: opts.sessions,
    weeklyGoalMinutes: opts.weeklyGoal ?? 480,
    now: NOW,
  });
  const candidates: PlanCandidate[] = [];
  for (const a of allocation) {
    const s = a.subjectId;
    const count = s === "math" ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const p = calculatePriority({
        kind: "learn",
        status: i === 0 ? 1 : 0,
        mastery: i === 0 ? 25 : 0,
        weakness: 0,
        recentRate: null,
        recentAttempted: 0,
        overdueDays: null,
        firstChoiceImportance: IMPORTANCE[s] ?? 2,
        isMonthlyTarget: false,
        isInProgress: i === 0,
        isFrontier: i > 0,
        frontierIndex: Math.min(1, i - 1),
        blocksCount: 0,
        depsMet: true,
        daysSinceStudied: a.daysSinceStudied,
        daysToExam: 287,
        minutesLast2Days: 0,
      });
      candidates.push(
        cand({
          topicId: `${s}-${i}`,
          subjectId: s,
          subjectName: s,
          evaluationType: EVAL[s] ?? "problem",
          status: i === 0 ? 1 : 0,
          priority: p.score,
          reasons: p.reasons,
        }),
      );
    }
  }
  const doneMinutes = opts.sessions
    .filter((x) => x.startedAt >= startOfDay(NOW))
    .reduce((s, x) => s + x.durationSec / 60, 0);
  return buildTodayPlan({
    availableMinutes: opts.minutes,
    candidates: [...candidates, ...(opts.extra ?? [])],
    allocation,
    doneMinutes,
  });
}
const learnShare = (plan: TodayPlan, subjectId: string) => {
  const learn = plan.items.filter((i) => i.kind === "learn");
  const total = learn.reduce((s, i) => s + i.minutes, 0);
  return total > 0
    ? learn.filter((i) => i.subjectId === subjectId).reduce((s, i) => s + i.minutes, 0) / total
    : 0;
};
const days = (subjectId: string, minutes: number, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => sess(subjectId, minutes, from + k));

describe("scenarios", () => {
  it("A. fresh start, 120 min → math leads; other subjects don't fill the day", () => {
    const plan = simulate({ sessions: [], minutes: 120 });
    expect(plan.items[0]?.subjectId).toBe("math");
    expect(minutesBy(plan, "math")).toBeGreaterThanOrEqual(60);
    expect(learnShare(plan, "math")).toBeGreaterThanOrEqual(0.5);
  });

  it("B. day 1: 25 min of math, then re-plan 120 → math is still the main task", () => {
    const plan = simulate({ sessions: [sess("math", 25)], minutes: 120 });
    expect(plan.availableMinutes).toBe(95);
    expect(plan.items[0]?.subjectId).toBe("math");
    const bySubject = SUBJECTS.map((s) => minutesBy(plan, s));
    expect(minutesBy(plan, "math")).toBe(Math.max(...bySubject));
    expect(minutesBy(plan, "math")).toBeGreaterThanOrEqual(30);
  });

  it("C. day 1: 25 min of math, 60 min available → math is not pushed out", () => {
    const plan = simulate({ sessions: [sess("math", 25)], minutes: 60 });
    expect(plan.availableMinutes).toBe(35);
    expect(minutesBy(plan, "math")).toBeGreaterThan(0);
  });

  it("C'. day 2 after 25 min of math → still math-led at 60 and 120 min", () => {
    for (const minutes of [60, 120]) {
      const plan = simulate({ sessions: [sess("math", 25, 1)], minutes });
      expect(plan.items[0]?.subjectId).toBe("math");
      expect(learnShare(plan, "math")).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("D. math far ahead after a 6-day sprint → math shrinks but never to zero", () => {
    const sprint = [...days("math", 120, 1, 6), sess("english", 30, 8), sess("physics", 30, 8)];
    for (const minutes of [60, 120, 180]) {
      const plan = simulate({ sessions: sprint, minutes });
      expect(minutesBy(plan, "math")).toBeGreaterThan(0);
      expect(plan.items.some((i) => i.subjectId !== "math")).toBe(true);
    }
    const fresh = simulate({ sessions: [], minutes: 120 });
    const plan = simulate({ sessions: sprint, minutes: 120 });
    expect(learnShare(plan, "math")).toBeLessThan(learnShare(fresh, "math"));
  });

  it("D'. math-heavy week (85%) → math keeps a real share", () => {
    const heavy = [sess("math", 400, 3), sess("english", 30, 2), sess("physics", 30, 2)];
    for (const minutes of [60, 120, 180]) {
      const plan = simulate({ sessions: heavy, minutes });
      expect(learnShare(plan, "math")).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("E. a week on target → the plan follows the configured shares without catch-up", () => {
    const onTarget = [
      ...days("math", 41, 1, 7), // ≈ 288 = 480 × 60%
      ...days("english", 7, 1, 7),
      ...days("physics", 7, 1, 7),
      sess("toeic", 24, 3),
      sess("cpp", 24, 4),
      sess("algo", 24, 5),
      sess("cs", 14, 5),
      sess("interview", 10, 6),
    ];
    const plan = simulate({ sessions: onTarget, minutes: 120 });
    expect(learnShare(plan, "math")).toBeGreaterThanOrEqual(0.5);
    expect(learnShare(plan, "math")).toBeLessThanOrEqual(0.75);
    expect(plan.items.every((i) => !i.reasons.some((r) => r.startsWith("今週")))).toBe(true);
  });

  it("F. 180 min → math is not capped at 50% by an item limit", () => {
    for (const weeklyGoal of [480, 1200]) {
      const plan = simulate({ sessions: [], minutes: 180, weeklyGoal });
      expect(minutesBy(plan, "math")).toBeGreaterThan(90);
      expect(plan.items.filter((i) => i.subjectId === "math").length).toBeGreaterThanOrEqual(4);
    }
  });

  it("G. 30 min already done today out of 120 → plans the remaining 90", () => {
    const plan = simulate({ sessions: [sess("math", 30)], minutes: 120 });
    expect(plan.totalMinutes).toBe(120);
    expect(plan.doneMinutes).toBe(30);
    expect(plan.availableMinutes).toBe(90);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(90);
    expect(plan.plannedMinutes).toBeGreaterThan(90 - PLAN_CONFIG.minBlock);
    // once the day's time is used up there is nothing left to plan
    const done = simulate({ sessions: [sess("math", 120)], minutes: 120 });
    expect(done.availableMinutes).toBe(0);
    expect(done.items).toHaveLength(0);
  });

  it("H. an important overdue review still comes first", () => {
    const review = cand({
      topicId: "math-review",
      kind: "review",
      reviewId: "r1",
      overdueDays: 3,
      status: 2,
      priority: calculatePriority({
        kind: "review",
        status: 2,
        mastery: 50,
        weakness: 30,
        recentRate: null,
        recentAttempted: 0,
        overdueDays: 3,
        firstChoiceImportance: 5,
        isMonthlyTarget: false,
        isInProgress: true,
        isFrontier: false,
        blocksCount: 0,
        depsMet: true,
        daysSinceStudied: 3,
        daysToExam: 287,
        minutesLast2Days: 0,
      }).score,
    });
    for (const minutes of [30, 60, 120]) {
      const plan = simulate({ sessions: [sess("english", 30, 1)], minutes, extra: [review] });
      expect(plan.items[0]?.topicId).toBe("math-review");
      expect(plan.items[0]?.task).toBe("復習5問");
    }
  });

  it("I. untouched topics behind unmet prerequisites are never planned", () => {
    const locked = cand({ topicId: "locked", priority: 999, status: 0, depsMet: false });
    const started = cand({ topicId: "started", priority: 998, status: 1, depsMet: false });
    const plan = simulate({ sessions: [], minutes: 180, extra: [locked, started] });
    expect(plan.items.some((i) => i.topicId === "locked")).toBe(false);
    // work already underway is not blocked (its priority carries the penalty instead)
    expect(plan.items.some((i) => i.topicId === "started")).toBe(true);
  });

  it("K. a main subject with only 2 open topics lengthens them instead of losing its share", () => {
    const few: PlanCandidate[] = [
      cand({ topicId: "展開", priority: 43, status: 0 }),
      cand({ topicId: "因数分解", priority: 40, status: 0 }),
      cand({ topicId: "英", subjectId: "english", evaluationType: "language", priority: 39 }),
      cand({ topicId: "物", subjectId: "physics", priority: 43 }),
    ];
    const shares = [alloc("math", 0.6), alloc("english", 0.2), alloc("physics", 0.2)];
    const plan = buildTodayPlan({ availableMinutes: 120, candidates: few, allocation: shares });
    expect(minutesBy(plan, "math")).toBeGreaterThanOrEqual(60);
    const maxItem = PLAN_CONFIG.blockMinutes.problem * PLAN_CONFIG.maxBlocksPerItem;
    expect(plan.items.every((i) => i.minutes <= maxItem)).toBe(true);
    expect(plan.plannedMinutes + plan.bufferMinutes).toBe(120);
  });

  it("J. every preset fills the time without overshooting, with and without history", () => {
    const histories = [[], [sess("math", 25)], [sess("math", 200, 2), sess("english", 40, 1)]];
    for (const sessions of histories) {
      for (const minutes of [30, 60, 90, 120, 180]) {
        const plan = simulate({ sessions, minutes });
        expect(plan.plannedMinutes).toBeLessThanOrEqual(plan.availableMinutes);
        expect(plan.bufferMinutes).toBeLessThan(PLAN_CONFIG.minBlock);
        expect(plan.plannedMinutes + plan.bufferMinutes).toBe(plan.availableMinutes);
      }
    }
  });
});
