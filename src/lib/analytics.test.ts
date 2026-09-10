import { describe, expect, it } from "vitest";
import { dailyStudyMinutes, studyStreakDays, weaknessItems } from "@/lib/analytics";
import { DAY_MS } from "@/lib/date";
import type { Category, Review, StudySession, Topic } from "@/lib/types";

const NOW = new Date("2026-06-15T12:00:00");

function session(daysAgo: number, minutes: number): StudySession {
  const started = NOW.getTime() - daysAgo * DAY_MS;
  return {
    id: `s-${daysAgo}-${minutes}`,
    topicId: "t1",
    subjectId: "sub1",
    startedAt: started,
    endedAt: started + minutes * 60_000,
    durationSec: minutes * 60,
    source: "timer",
    createdAt: started,
  };
}

describe("dailyStudyMinutes", () => {
  it("buckets sessions into the last N days ending today", () => {
    const data = dailyStudyMinutes([session(0, 30), session(0, 15), session(2, 60)], 7, NOW);
    expect(data).toHaveLength(7);
    expect(data.at(-1)?.minutes).toBe(45);
    expect(data.at(-3)?.minutes).toBe(60);
    expect(data[0]?.minutes).toBe(0);
  });
});

describe("studyStreakDays", () => {
  it("counts consecutive days including today", () => {
    expect(studyStreakDays([session(0, 10), session(1, 10), session(2, 10)], NOW)).toBe(3);
  });

  it("still holds the streak if only yesterday was studied", () => {
    expect(studyStreakDays([session(1, 10), session(2, 10)], NOW)).toBe(2);
  });

  it("is 0 when the last study was 2+ days ago", () => {
    expect(studyStreakDays([session(2, 10), session(3, 10)], NOW)).toBe(0);
  });

  it("is 0 with no sessions", () => {
    expect(studyStreakDays([], NOW)).toBe(0);
  });
});

describe("weaknessItems", () => {
  const category: Category = {
    id: "c1",
    subjectId: "s1",
    name: "三角関数",
    order: 0,
    track: 0,
    prerequisiteIds: [],
    createdAt: 0,
    updatedAt: 0,
  };

  function topic(id: string, extra: Partial<Topic> = {}): Topic {
    return {
      id,
      categoryId: "c1",
      name: id,
      status: 2,
      weight: 1,
      order: 0,
      createdAt: NOW.getTime(),
      updatedAt: NOW.getTime(),
      ...extra,
    };
  }

  function review(topicId: string, outcome: Review["outcome"]): Review {
    return {
      id: `r-${topicId}-${outcome}`,
      topicId,
      dueAt: NOW.getTime(),
      stage: 0,
      completedAt: NOW.getTime(),
      outcome,
      createdAt: NOW.getTime(),
    };
  }

  it("ranks topics with more failed reviews higher", () => {
    const topics = [topic("weak"), topic("ok")];
    const reviews = [review("weak", "failed"), review("weak", "failed"), review("ok", "got")];
    const items = weaknessItems(topics, [category], reviews, { now: NOW.getTime() });
    expect(items[0]?.topic.id).toBe("weak");
    expect(items[0]?.reasons.join()).toContain("できなかった");
  });

  it("flags long-stalled topics", () => {
    const stale = topic("stale", {
      lastStatusUpAt: NOW.getTime() - 50 * DAY_MS,
    });
    const items = weaknessItems([stale], [category], [], { now: NOW.getTime() });
    expect(items).toHaveLength(1);
    expect(items[0]?.reasons.join()).toContain("停滞");
  });

  it("excludes 過去問レベル topics and clean topics", () => {
    const items = weaknessItems(
      [topic("mastered", { status: 4 }), topic("fine", { status: 2 })],
      [category],
      [],
      { now: NOW.getTime() },
    );
    expect(items).toHaveLength(0);
  });
});
