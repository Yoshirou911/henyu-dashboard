import { describe, expect, it } from "vitest";
import { dailyStudyMinutes, studyStreakDays } from "@/lib/analytics";
import { DAY_MS } from "@/lib/date";
import type { StudySession } from "@/lib/types";

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
