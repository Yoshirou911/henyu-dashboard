import { describe, expect, it } from "vitest";
import { DAY_MS } from "@/lib/date";
import { computeTopicAccuracy, splitRecent, type TopicAccuracy } from "@/lib/mastery/accuracy";
import { calculateMastery, type MasteryInput } from "@/lib/mastery/calculateMastery";
import { calculateReadyForNext, computeReviewRate } from "@/lib/mastery/readyForNext";
import type { ExerciseResult, Review } from "@/lib/types";

const NOW = new Date("2026-09-19T12:00:00").getTime();
let seq = 0;
function res(
  attempted: number,
  correct: number,
  extra: Partial<ExerciseResult> = {},
): ExerciseResult {
  seq++;
  return {
    id: `r${seq}`,
    topicId: "t",
    date: "2026-09-19",
    at: NOW - seq * 1000,
    attemptedCount: attempted,
    correctCount: correct,
    difficulty: "basic",
    type: "practice",
    createdAt: NOW,
    ...extra,
  };
}

const empty = computeTopicAccuracy([], { now: NOW });
function input(partial: Partial<MasteryInput> = {}): MasteryInput {
  return {
    status: 0,
    evaluationType: "problem",
    accuracy: empty,
    reviewOutcomes: { got: 0, shaky: 0, failed: 0 },
    daysSinceStudied: null,
    pastExam: { correct: 0, partial: 0, wrong: 0 },
    mockWeakCount: 0,
    studyMinutes7d: 0,
    ...partial,
  };
}
const acc = (results: ExerciseResult[]): TopicAccuracy =>
  computeTopicAccuracy(results, { now: NOW });

describe("accuracy", () => {
  it("takes whole result sets newest-first until the window is covered", () => {
    const old = res(10, 2, { at: NOW - 10 * DAY_MS });
    const mid = res(10, 9, { at: NOW - 2 * DAY_MS });
    const latest = res(10, 8, { at: NOW - DAY_MS });
    const { recent, earlier } = splitRecent([old, mid, latest], 20);
    expect(recent.map((r) => r.id)).toEqual([latest.id, mid.id]);
    expect(earlier.map((r) => r.id)).toEqual([old.id]);
  });

  it("computes 累計 / 直近 / difficulty / type rates", () => {
    const a = acc([
      res(10, 8, { at: NOW - DAY_MS }),
      res(4, 1, { difficulty: "advanced", at: NOW - 2 * DAY_MS }),
      res(5, 5, { type: "review", at: NOW - 3 * DAY_MS }),
    ]);
    expect(a.total.attempted).toBe(19);
    expect(a.basic.rate).toBeCloseTo(13 / 15);
    expect(a.advanced.rate).toBeCloseTo(0.25);
    expect(a.review.rate).toBe(1);
    expect(a.recent.attempted).toBe(19);
  });

  it("returns null rates when nothing was attempted", () => {
    expect(empty.recent.rate).toBeNull();
    expect(empty.total.attempted).toBe(0);
  });
});

describe("calculateMastery", () => {
  it("uses the status base when there is no evidence", () => {
    expect(calculateMastery(input({ status: 0 })).score).toBe(0);
    expect(calculateMastery(input({ status: 1 })).score).toBe(20);
    expect(calculateMastery(input({ status: 2 })).score).toBe(50);
    expect(calculateMastery(input({ status: 3 })).score).toBe(75);
    expect(calculateMastery(input({ status: 4 })).score).toBe(100);
  });

  it("raises the score for recent accuracy above what the status implies", () => {
    const high = calculateMastery(input({ status: 2, accuracy: acc([res(10, 10)]) }));
    const low = calculateMastery(input({ status: 2, accuracy: acc([res(10, 3)]) }));
    expect(high.score).toBeGreaterThan(50);
    expect(low.score).toBeLessThan(50);
    expect(high.adjustments.some((a) => a.label === "直近正答率")).toBe(true);
  });

  it("ignores accuracy below the minimum sample size", () => {
    expect(calculateMastery(input({ status: 2, accuracy: acc([res(4, 0)]) })).score).toBe(50);
  });

  it("penalises failed reviews and long gaps, and clamps to 0..100", () => {
    const failed = calculateMastery(
      input({ status: 3, reviewOutcomes: { got: 0, shaky: 0, failed: 2 }, daysSinceStudied: 40 }),
    );
    expect(failed.score).toBe(75 - 10 - 10);
    const floor = calculateMastery(
      input({
        status: 0,
        accuracy: acc([res(10, 0)]),
        reviewOutcomes: { got: 0, shaky: 0, failed: 9 },
      }),
    );
    expect(floor.score).toBe(0);
    const ceil = calculateMastery(
      input({
        status: 4,
        accuracy: acc([res(20, 20)]),
        reviewOutcomes: { got: 5, shaky: 0, failed: 0 },
      }),
    );
    expect(ceil.score).toBe(100);
  });

  it("counts past-exam problems tied to the topic", () => {
    const wrong = calculateMastery(
      input({ status: 2, pastExam: { correct: 0, partial: 0, wrong: 2 } }),
    );
    expect(wrong.score).toBe(40);
  });

  it("blends mock-interview completeness for interview topics", () => {
    const r = calculateMastery(
      input({
        status: 1,
        evaluationType: "interview",
        accuracy: acc([res(10, 8, { type: "mock" })]),
      }),
    );
    // 50% status (20) + 50% completeness (80)
    expect(r.score).toBe(50);
  });

  it("does not use problem accuracy for interview topics", () => {
    expect(
      calculateMastery(
        input({ status: 2, evaluationType: "interview", accuracy: acc([res(10, 0)]) }),
      ).score,
    ).toBe(50);
  });

  it("accepts coefficient overrides", () => {
    expect(
      calculateMastery(input({ status: 1 }), { base: { 0: 0, 1: 30, 2: 50, 3: 75, 4: 100 } }).score,
    ).toBe(30);
  });
});

describe("readyForNext", () => {
  const basic = (attempted: number, correct: number) => acc([res(attempted, correct)]).recentBasic;
  const ready = (
    attempted: number,
    correct: number,
    reviewRate: number | null,
    override?: boolean,
  ) =>
    calculateReadyForNext({
      evaluationType: "problem",
      status: 2,
      recentBasic: basic(attempted, correct),
      reviewRate,
      override,
    });

  it("is met at exactly 80% / 10 problems / 70% review", () => {
    const r = ready(10, 8, 0.7);
    expect(r.ready).toBe(true);
    expect(r.conditions.every((c) => c.met)).toBe(true);
  });

  it("fails at 79% basic accuracy", () => {
    const r = calculateReadyForNext({
      evaluationType: "problem",
      status: 2,
      recentBasic: { attempted: 100, correct: 79, rate: 0.79 },
      reviewRate: 1,
    });
    expect(r.ready).toBe(false);
    expect(r.conditions.find((c) => c.key === "basic_rate")?.met).toBe(false);
  });

  it("fails with 9 problems even at 100%", () => {
    const r = ready(9, 9, 1);
    expect(r.ready).toBe(false);
    expect(r.conditions.find((c) => c.key === "basic_count")?.detail).toBe("9 / 10問");
  });

  it("fails when the review is below 70% or missing", () => {
    expect(ready(10, 10, 0.69).ready).toBe(false);
    const missing = ready(10, 10, null);
    expect(missing.ready).toBe(false);
    expect(missing.conditions.find((c) => c.key === "review")?.detail).toBe("未実施");
  });

  it("honours a manual override in both directions", () => {
    expect(ready(1, 0, null, true).ready).toBe(true);
    const forcedOff = ready(10, 10, 1, false);
    expect(forcedOff.ready).toBe(false);
    expect(forcedOff.automatic).toBe(true);
  });

  it("language topics only need 基本OK", () => {
    const r = calculateReadyForNext({
      evaluationType: "language",
      status: 2,
      recentBasic: { attempted: 0, correct: 0, rate: null },
      reviewRate: null,
    });
    expect(r.ready).toBe(true);
  });

  it("review rate: counts review problems from 2 days after 基本OK, else outcomes", () => {
    const basicOkAt = NOW - 5 * DAY_MS;
    const tooEarly = res(5, 0, { type: "review", at: basicOkAt + DAY_MS });
    const onTime = res(10, 7, { type: "review", at: basicOkAt + 3 * DAY_MS });
    expect(computeReviewRate([tooEarly, onTime], [], basicOkAt).rate).toBeCloseTo(0.7);

    const reviews: Review[] = [
      {
        id: "a",
        topicId: "t",
        dueAt: 0,
        stage: 0,
        completedAt: 1,
        outcome: "failed",
        createdAt: 0,
      },
      { id: "b", topicId: "t", dueAt: 0, stage: 1, completedAt: 1, outcome: "got", createdAt: 0 },
      { id: "c", topicId: "t", dueAt: 0, stage: 2, completedAt: 1, outcome: "shaky", createdAt: 0 },
    ];
    const fromOutcomes = computeReviewRate([], reviews, basicOkAt);
    expect(fromOutcomes.source).toBe("outcomes");
    expect(fromOutcomes.rate).toBeCloseTo(0.75); // stage-0 review ignored
  });
});
