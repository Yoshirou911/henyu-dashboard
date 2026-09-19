import { describe, expect, it } from "vitest";
import {
  WEAKNESS_CONFIG,
  calculateWeakness,
  isImproving,
  type WeaknessInput,
} from "@/lib/weakness/calculateWeakness";

function input(partial: Partial<WeaknessInput> = {}): WeaknessInput {
  return {
    status: 2,
    mastery: 50,
    recent: { attempted: 0, correct: 0, rate: null },
    failedReviews: 0,
    shakyReviews: 0,
    studyMinutesTotal: 0,
    daysSinceStatusUp: 0,
    pastExam: { partial: 0, wrong: 0 },
    mockWeakCount: 0,
    overdueDays: null,
    firstChoiceImportance: 0,
    ...partial,
  };
}

describe("calculateWeakness", () => {
  it("is 0 for a clean topic", () => {
    expect(calculateWeakness(input()).score).toBe(0);
  });

  it("scores low recent accuracy only below the threshold", () => {
    const at70 = calculateWeakness(input({ recent: { attempted: 10, correct: 7, rate: 0.7 } }));
    expect(at70.score).toBe(0);
    const at55 = calculateWeakness(input({ recent: { attempted: 20, correct: 11, rate: 0.55 } }));
    expect(at55.score).toBe(15);
    expect(at55.reasons[0]).toBe("直近正答率 55%");
  });

  it("needs a minimum sample before trusting accuracy", () => {
    expect(calculateWeakness(input({ recent: { attempted: 4, correct: 0, rate: 0 } })).score).toBe(
      0,
    );
  });

  it("adds review failures, stagnation, past exams, mocks and overdue reviews", () => {
    const r = calculateWeakness(
      input({
        failedReviews: 2,
        daysSinceStatusUp: 50,
        pastExam: { partial: 1, wrong: 1 },
        mockWeakCount: 1,
        overdueDays: 3,
      }),
    );
    expect(r.score).toBe(24 + 15 + 17 + 10 + 11);
    expect(r.reasons).toContain("復習期限3日超過");
  });

  it("flags effort without progress", () => {
    const r = calculateWeakness(input({ studyMinutesTotal: 180, mastery: 30 }));
    expect(r.score).toBe(WEAKNESS_CONFIG.effortPoints);
  });

  it("adds 第一志望 importance only when another signal exists", () => {
    expect(calculateWeakness(input({ firstChoiceImportance: 5 })).score).toBe(0);
    const r = calculateWeakness(input({ firstChoiceImportance: 5, failedReviews: 1 }));
    expect(r.score).toBe(12 + 10);
  });

  it("caps at 100", () => {
    const r = calculateWeakness(
      input({
        recent: { attempted: 20, correct: 0, rate: 0 },
        failedReviews: 10,
        shakyReviews: 10,
        daysSinceStatusUp: 100,
        pastExam: { partial: 5, wrong: 5 },
        mockWeakCount: 5,
        overdueDays: 30,
        firstChoiceImportance: 5,
      }),
    );
    expect(r.score).toBe(100);
  });
});

describe("isImproving", () => {
  it("detects a ≥15pt accuracy gain", () => {
    expect(
      isImproving(
        { attempted: 10, correct: 9, rate: 0.9 },
        { attempted: 10, correct: 7, rate: 0.72 },
      ),
    ).toBe(true);
    expect(
      isImproving(
        { attempted: 10, correct: 8, rate: 0.8 },
        { attempted: 10, correct: 7, rate: 0.7 },
      ),
    ).toBe(false);
  });
});
