import { describe, expect, it } from "vitest";
import {
  daysLeftInMonth,
  goalProgress,
  judgePace,
  monthElapsed,
  monthlySummary,
} from "@/lib/goals/monthlyProgress";
import type { MonthlyGoal, Status } from "@/lib/types";

function goal(partial: Partial<MonthlyGoal>): MonthlyGoal {
  return {
    id: Math.random().toString(36),
    month: "2026-09",
    subjectId: "math",
    text: "goal",
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const statuses: Record<string, Status> = { limit: 1, frac: 2, deriv: 0 };
const statusOf = (id: string) => statuses[id];

describe("goalProgress", () => {
  it("uses status score / target score for measurable goals", () => {
    expect(goalProgress(goal({ targetTopicId: "limit", targetStatus: 2 }), statusOf)).toBe(0.5);
    expect(goalProgress(goal({ targetTopicId: "frac", targetStatus: 2 }), statusOf)).toBe(1);
    expect(goalProgress(goal({ targetTopicId: "frac", targetStatus: 3 }), statusOf)).toBeCloseTo(
      2 / 3,
    );
  });

  it("uses the done flag for free-text goals", () => {
    expect(goalProgress(goal({ done: true }), statusOf)).toBe(1);
    expect(goalProgress(goal({}), statusOf)).toBe(0);
  });
});

describe("judgePace", () => {
  it("classifies against elapsed time with fixed margins", () => {
    expect(judgePace(0.75, 0.6)).toBe("ahead");
    expect(judgePace(0.6, 0.6)).toBe("on_track");
    expect(judgePace(0.5, 0.6)).toBe("on_track");
    expect(judgePace(0.49, 0.6)).toBe("slightly_behind");
    expect(judgePace(0.35, 0.6)).toBe("slightly_behind");
    expect(judgePace(0.34, 0.6)).toBe("far_behind");
  });
});

describe("month helpers", () => {
  const now = new Date("2026-09-20T00:00:00");
  it("computes elapsed fraction and days left", () => {
    expect(monthElapsed("2026-09", now)).toBeCloseTo(19 / 30);
    expect(daysLeftInMonth("2026-09", now)).toBe(11);
    expect(monthElapsed("2026-08", now)).toBe(1);
    expect(monthElapsed("2026-10", now)).toBe(0);
    expect(daysLeftInMonth("2026-10", now)).toBe(31);
  });

  it("summarises per subject", () => {
    const s = monthlySummary(
      "2026-09",
      [
        goal({ targetTopicId: "limit", targetStatus: 2 }),
        goal({ done: true }),
        goal({ subjectId: "physics", targetTopicId: "deriv", targetStatus: 1 }),
        goal({ month: "2026-10", done: true }),
      ],
      statusOf,
      now,
    );
    expect(s.subjects).toHaveLength(2);
    expect(s.subjects.find((x) => x.subjectId === "math")?.progress).toBe(0.75);
    expect(s.subjects.find((x) => x.subjectId === "physics")?.pace).toBe("far_behind");
    expect(s.progress).toBe(0.5);
  });
});
