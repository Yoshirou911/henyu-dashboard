import { describe, expect, it } from "vitest";
import {
  buildCategoryProgress,
  findCurrentTopic,
  findUpcomingTopics,
  weightedPercent,
} from "@/lib/progress";
import type { Category, Topic } from "@/lib/types";

const now = 1_700_000_000_000;

function topic(partial: Partial<Topic> & Pick<Topic, "id" | "status">): Topic {
  return {
    categoryId: "c1",
    name: partial.id,
    weight: 1,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("weightedPercent", () => {
  it("returns 0 for an empty list", () => {
    expect(weightedPercent([])).toBe(0);
  });

  it("maps statuses to 0/25/50/75/100 and averages them", () => {
    expect(weightedPercent([topic({ id: "a", status: 0 }), topic({ id: "b", status: 4 })])).toBe(
      50,
    );
    expect(weightedPercent([topic({ id: "a", status: 2 })])).toBe(50);
  });

  it("respects topic weight", () => {
    const result = weightedPercent([
      topic({ id: "a", status: 4, weight: 3 }), // 100 * 3
      topic({ id: "b", status: 0, weight: 1 }), // 0 * 1
    ]);
    expect(result).toBe(75);
  });

  it("treats non-positive weight as 1", () => {
    expect(weightedPercent([topic({ id: "a", status: 4, weight: 0 })])).toBe(100);
  });
});

describe("buildCategoryProgress", () => {
  const category: Category = {
    id: "c1",
    subjectId: "s1",
    name: "極限",
    order: 0,
    track: 0,
    prerequisiteIds: [],
    createdAt: now,
    updatedAt: now,
  };

  it("counts only its own topics and sorts by order", () => {
    const topics = [
      topic({ id: "t2", status: 3, order: 1 }),
      topic({ id: "t1", status: 4, order: 0 }),
      topic({ id: "x", status: 0, categoryId: "other", order: 0 }),
    ];
    const progress = buildCategoryProgress(category, topics);
    expect(progress.topics.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(progress.topicCount).toBe(2);
    expect(progress.doneCount).toBe(2); // status >= 3
    expect(progress.percent).toBe(87.5);
  });
});

describe("current / upcoming topics", () => {
  const ordered = [
    topic({ id: "a", status: 3, order: 0 }),
    topic({ id: "b", status: 2, order: 1 }),
    topic({ id: "c", status: 0, order: 2 }),
    topic({ id: "d", status: 0, order: 3 }),
  ];

  it("finds the first not-yet-固定 topic as current", () => {
    expect(findCurrentTopic(ordered)?.id).toBe("b");
  });

  it("returns the next N topics from the first unfinished one", () => {
    expect(findUpcomingTopics(ordered, 3).map((t) => t.id)).toEqual(["b", "c", "d"]);
  });

  it("returns nothing when everything is 定着+", () => {
    const done = ordered.map((t) => ({ ...t, status: 3 as const }));
    expect(findUpcomingTopics(done)).toEqual([]);
  });
});
