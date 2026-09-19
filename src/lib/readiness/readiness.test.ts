import { describe, expect, it } from "vitest";
import { subjectScore, universityReadiness } from "@/lib/readiness/universityReadiness";
import type { UniversityRequirement } from "@/lib/types";

const req = (subjectId: string, weight: number): UniversityRequirement => ({
  id: `req_${subjectId}`,
  universityId: "uec",
  subjectId,
  required: true,
  importance: 5,
  weight,
});

// 電通大: 数学40 / 物理30 / 英語25 / 面接5
const UEC = [req("math", 40), req("physics", 30), req("english", 25), req("interview", 5)];

describe("universityReadiness", () => {
  it("weights subject scores by the requirement weights", () => {
    const scores = new Map([
      ["math", 31],
      ["physics", 8],
      ["english", 22],
      ["interview", 0],
    ]);
    const r = universityReadiness(UEC, scores);
    expect(r.score).toBeCloseTo(0.4 * 31 + 0.3 * 8 + 0.25 * 22, 1);
    expect(r.breakdown[0]?.subjectId).toBe("math");
    expect(r.breakdown[0]?.share).toBeCloseTo(0.4);
  });

  it("is not moved by subjects the university does not require (C++)", () => {
    const base = new Map([
      ["math", 30],
      ["physics", 10],
      ["english", 20],
      ["interview", 0],
      ["cpp", 0],
    ]);
    const withCpp = new Map(base).set("cpp", 100);
    expect(universityReadiness(UEC, withCpp).score).toBe(universityReadiness(UEC, base).score);
  });

  it("normalises arbitrary weights and skips missing subjects", () => {
    const r = universityReadiness(
      [req("math", 2), req("ghost", 5), req("english", 2)],
      new Map([
        ["math", 100],
        ["english", 0],
      ]),
    );
    expect(r.score).toBe(50);
    expect(r.breakdown).toHaveLength(2);
  });

  it("is 0 when nothing is configured", () => {
    expect(universityReadiness([], new Map()).score).toBe(0);
  });
});

describe("subjectScore", () => {
  it("is the topic-weight-weighted mean of mastery, ignoring archived topics", () => {
    const topics = [
      { id: "a", weight: 3 },
      { id: "b", weight: 1 },
      { id: "c", weight: 1, archived: true },
    ];
    const mastery = new Map([
      ["a", 100],
      ["b", 0],
      ["c", 0],
    ]);
    expect(subjectScore(topics, mastery)).toBe(75);
  });
});
