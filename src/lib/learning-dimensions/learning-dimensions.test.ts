import { describe, expect, it } from "vitest";
import { DAY_MS, dayKey } from "@/lib/date";
import { FORECAST_CONFIG } from "@/lib/forecast/config";
import {
  masteryRemainingWorkFactor,
  topicRemainingMinutesByMastery,
} from "@/lib/forecast/masteryWork";
import { topicRemainingMinutes } from "@/lib/forecast/pace";
import {
  buildLearningDimensions,
  calculateCoverage,
  calculateMasteryAggregate,
  combineConfidence,
  type StudyDimensions,
} from "@/lib/learning-dimensions/buildLearningDimensions";
import { COVERAGE_CONFIG, EXAM_READINESS_CONFIG } from "@/lib/learning-dimensions/config";
import {
  calculateExamEvidenceConfidence,
  calculateExamShare,
  recencyFactor,
  summarizeEvidence,
  type EvidenceItem,
} from "@/lib/learning-dimensions/examReadiness";
import {
  explainExamReadiness,
  formatPercent,
  readinessHint,
} from "@/lib/learning-dimensions/format";
import { buildStudyModel, type StudyModel } from "@/lib/model/buildStudyModel";
import type { StudySnapshot } from "@/lib/model/snapshot";
import { subjectScore } from "@/lib/readiness/universityReadiness";
import type {
  Category,
  EvaluationType,
  ExerciseDifficulty,
  ExerciseResult,
  ExerciseType,
  MockExam,
  PastExam,
  PastExamProblem,
  ProblemResult,
  Review,
  Status,
  Subject,
  Topic,
  University,
  UniversityRequirement,
} from "@/lib/types";

const NOW = new Date("2026-09-20T21:00:00").getTime();
const T0 = new Date("2026-08-01T09:00:00").getTime();
const ago = (days: number) => NOW - days * DAY_MS - 3 * 3_600_000;
const dayAgo = (days: number) => dayKey(new Date(ago(days)));

/* ------------------------------- fixtures ------------------------------- */

let seq = 0;
const id = (p: string) => `${p}${seq++}`;

const subject = (
  sid: string,
  evaluationType: EvaluationType,
  extra: Partial<Subject> = {},
): Subject => ({
  id: sid,
  slug: sid,
  name: sid,
  order: 0,
  evaluationType,
  createdAt: T0,
  updatedAt: T0,
  ...extra,
});
const category = (cid: string, subjectId: string): Category => ({
  id: cid,
  subjectId,
  name: cid,
  order: 0,
  track: 0,
  prerequisiteIds: [],
  createdAt: T0,
  updatedAt: T0,
});
const topic = (
  tid: string,
  categoryId: string,
  status: Status,
  extra: Partial<Topic> = {},
): Topic => ({
  id: tid,
  categoryId,
  name: tid,
  status,
  weight: 1,
  order: 0,
  createdAt: T0,
  updatedAt: T0,
  lastStudiedAt: status > 0 ? ago(1) : undefined,
  ...extra,
});
const result = (
  topicId: string,
  daysAgo: number,
  attempted: number,
  correct: number,
  difficulty: ExerciseDifficulty = "standard",
  type: ExerciseType = "practice",
): ExerciseResult => ({
  id: id("er"),
  topicId,
  date: dayAgo(daysAgo),
  at: ago(daysAgo),
  attemptedCount: attempted,
  correctCount: correct,
  difficulty,
  type,
  createdAt: ago(daysAgo),
});
const review = (topicId: string, daysAgo: number, outcome: Review["outcome"]): Review => ({
  id: id("rv"),
  topicId,
  dueAt: ago(daysAgo),
  stage: 1,
  completedAt: ago(daysAgo),
  outcome,
  createdAt: ago(daysAgo + 3),
});
const paper = (
  subjectId: string,
  year: number,
  score: number,
  maxScore: number,
  daysAgo: number,
  universityId: string | null = "u1",
): PastExam => ({
  id: id("pe"),
  universityId,
  year,
  subject: subjectId,
  subjectId,
  score,
  maxScore,
  date: dayAgo(daysAgo),
  createdAt: ago(daysAgo),
});
const problem = (pastExamId: string, topicId: string, r: ProblemResult): PastExamProblem => ({
  id: id("pp"),
  pastExamId,
  number: 1,
  topicId,
  result: r,
});
const mock = (
  subjectId: string | undefined,
  score: number,
  maxScore: number,
  daysAgo: number,
  weakTopicIds?: string[],
): MockExam => ({
  id: id("mk"),
  examName: "模試",
  examDate: dayAgo(daysAgo),
  subject: "数学",
  subjectId,
  score,
  maxScore,
  weakTopicIds,
  createdAt: ago(daysAgo),
});
const university = (uid: string): University => ({
  id: uid,
  name: uid,
  faculty: "",
  departmentOrCourse: "",
  priority: "first_choice",
  order: 0,
  createdAt: T0,
  updatedAt: T0,
});
const requirement = (
  universityId: string,
  subjectId: string,
  weight: number,
): UniversityRequirement => ({
  id: id("req"),
  universityId,
  subjectId,
  required: true,
  importance: 5,
  weight,
});

function snapshot(parts: Partial<StudySnapshot> = {}): StudySnapshot {
  return {
    settings: {
      id: "app",
      schemaVersion: 2,
      examName: "編入",
      examDate: "2027-07-01",
      primarySubjectId: "math",
      theme: "dark",
      autoLowerStatusOnFailedReview: false,
      dailyStudyGoalMin: 60,
      weeklyStudyGoalMin: 600,
      onboardedAt: T0,
      primaryUniversityId: "u1",
      createdAt: T0,
      updatedAt: T0,
    },
    subjects: [subject("math", "problem")],
    categories: [category("calc", "math")],
    topics: [],
    sessions: [],
    reviews: [],
    exerciseResults: [],
    universities: [university("u1")],
    requirements: [requirement("u1", "math", 1)],
    monthlyGoals: [],
    milestones: [],
    mockExams: [],
    pastExams: [],
    pastExamProblems: [],
    dailyGoals: [],
    statusLogs: [],
    ...parts,
  };
}

function build(parts: Partial<StudySnapshot> = {}): { model: StudyModel; dims: StudyDimensions } {
  const model = buildStudyModel(snapshot(parts), NOW);
  return { model, dims: buildLearningDimensions(model) };
}

const mathOf = (dims: StudyDimensions) => dims.bySubject.get("math")!;

function allNumbersFinite(value: unknown, path = "dims"): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [path];
  if (typeof value === "string") return /NaN|Infinity|Invalid/.test(value) ? [path] : [];
  if (value instanceof Map)
    return [...value.values()].flatMap((v, i) => allNumbersFinite(v, `${path}[${i}]`));
  if (value instanceof Set) return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => allNumbersFinite(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => allNumbersFinite(v, `${path}.${k}`));
  return [];
}

/** a well-practised topic: status 4, lots of accurate recent practice, stable reviews */
function practised(tid: string) {
  return {
    topic: topic(tid, "calc", 4),
    results: [
      result(tid, 2, 10, 10, "basic"),
      result(tid, 3, 10, 9, "standard"),
      result(tid, 5, 10, 9, "standard"),
      result(tid, 6, 10, 10, "advanced"),
    ],
    reviews: [review(tid, 4, "got"), review(tid, 8, "got")],
  };
}

/* ------------------------------- coverage ------------------------------- */

describe("coverage", () => {
  it("A: is 0 when every topic is untouched", () => {
    const { dims } = build({
      topics: [topic("a", "calc", 0), topic("b", "calc", 0), topic("c", "calc", 0)],
    });
    const m = mathOf(dims);
    expect(m.coverage).toBe(0);
    expect(m.mastery).toBe(0);
    expect(m.examReadiness).toBe(0);
    expect(m.examEvidenceConfidence).toBe("low");
  });

  it("B: half the topics studied → about 50%", () => {
    const { dims } = build({
      topics: [
        topic("a", "calc", 2),
        topic("b", "calc", 3),
        topic("c", "calc", 0),
        topic("d", "calc", 0),
      ],
    });
    expect(mathOf(dims).coverage).toBe(50);
    expect(mathOf(dims).categories[0]!.coverage).toBe(50);
  });

  it("C: 学習中 counts as the configured factor", () => {
    const ts = [topic("a", "calc", 1), topic("b", "calc", 0)];
    expect(COVERAGE_CONFIG.statusCoverageFactor[1]).toBe(0.5);
    expect(calculateCoverage(ts)).toBe(25);
    expect(
      calculateCoverage(ts, { statusCoverageFactor: { 0: 0, 1: 0.3, 2: 1, 3: 1, 4: 1 } }),
    ).toBe(15);
    expect(calculateCoverage([])).toBe(0);
  });

  it("weights topics by their importance weight, like the existing progress", () => {
    expect(calculateCoverage([topic("a", "calc", 2, { weight: 3 }), topic("b", "calc", 0)])).toBe(
      75,
    );
  });
});

/* -------------------------------- mastery ------------------------------- */

describe("mastery", () => {
  it("D: is the existing weighted mean of topic mastery (single source of truth)", () => {
    const { model, dims } = build({
      subjects: [subject("math", "problem")],
      categories: [category("calc", "math"), category("lin", "math")],
      topics: [
        topic("a", "calc", 3, { weight: 2 }),
        topic("b", "calc", 1),
        topic("c", "lin", 2),
        topic("d", "lin", 0),
      ],
      exerciseResults: [result("a", 1, 10, 4), result("c", 2, 10, 10)],
      reviews: [review("a", 3, "failed")],
    });
    const summary = model.subjectSummaries.find((s) => s.subject.id === "math")!;
    const m = mathOf(dims);
    expect(m.mastery).toBe(summary.score);
    const masteryById = new Map([...model.topicMetrics].map(([k, v]) => [k, v.mastery.score]));
    expect(m.mastery).toBe(subjectScore(model.snapshot.topics, masteryById));
    m.categories.forEach((c, i) => expect(c.mastery).toBe(summary.categories[i]!.score));
    for (const [tid, t] of dims.topics) {
      expect(t.mastery).toBe(model.topicMetrics.get(tid)!.mastery.score);
    }
    expect(calculateMasteryAggregate([...model.topicMetrics.values()])).toBe(summary.score);
  });
});

/* ---------------------------- exam readiness ---------------------------- */

describe("exam readiness", () => {
  it("E/M: high mastery without exam evidence → above 0, below mastery, confidence low", () => {
    const a = practised("a");
    const { dims } = build({ topics: [a.topic], exerciseResults: a.results, reviews: a.reviews });
    const t = dims.topics.get("a")!;
    expect(t.mastery).toBeGreaterThanOrEqual(90);
    expect(t.examReadiness).toBeGreaterThan(0);
    expect(t.examReadiness).toBeLessThan(t.mastery);
    expect(t.examReadiness).toBeCloseTo(t.mastery * EXAM_READINESS_CONFIG.noExamEvidenceFactor, 0);
    expect(t.examEvidenceConfidence).toBe("low");
    const m = mathOf(dims);
    expect(m.examReadiness).toBeLessThan(m.mastery);
    expect(readinessHint(m.readiness, "problem")).toContain("本番形式の証拠がまだない");
    const why = explainExamReadiness({
      mastery: m.mastery,
      readiness: m.readiness,
      evaluationType: "problem",
    });
    expect(why).toContain("編入過去問は未実施");
    expect(why.some((l) => l.startsWith("通常演習 40問"))).toBe(true);
    expect(why.some((l) => l.startsWith("復習は安定"))).toBe(true);
  });

  it("F: practice-only evidence is weaker than evidence including past papers", () => {
    const a = practised("a");
    const only = build({ topics: [a.topic], exerciseResults: a.results, reviews: a.reviews });
    const pe = paper("math", 2025, 80, 100, 3);
    const withPast = build({
      topics: [a.topic],
      exerciseResults: a.results,
      reviews: a.reviews,
      pastExams: [pe],
      pastExamProblems: [problem(pe.id, "a", "correct")],
    });
    const s1 = only.dims.topics.get("a")!.readiness.evidence;
    const s2 = withPast.dims.topics.get("a")!.readiness.evidence;
    expect(s1.examStrength).toBe(0);
    expect(s2.examStrength).toBeGreaterThan(0);
    expect(s2.strength).toBeGreaterThan(s1.strength);
    expect(mathOf(withPast.dims).readiness.evidence.strength).toBeGreaterThan(
      mathOf(only.dims).readiness.evidence.strength,
    );
  });

  it("G/L: high past-paper scores across years lift readiness and confidence", () => {
    const a = practised("a");
    const b = practised("b");
    const papers = [
      paper("math", 2023, 90, 100, 5),
      paper("math", 2024, 85, 100, 10),
      paper("math", 2025, 95, 100, 20),
    ];
    const problems = papers.flatMap((p) => [
      problem(p.id, "a", "correct"),
      problem(p.id, "b", "correct"),
    ]);
    const without = build({
      topics: [a.topic, b.topic],
      exerciseResults: [...a.results, ...b.results],
      reviews: [...a.reviews, ...b.reviews],
    });
    const { dims } = build({
      topics: [a.topic, b.topic],
      exerciseResults: [...a.results, ...b.results],
      reviews: [...a.reviews, ...b.reviews],
      pastExams: papers,
      pastExamProblems: problems,
    });
    const m = mathOf(dims);
    // L: everything at 過去問レベル
    expect(m.coverage).toBe(100);
    expect(m.mastery).toBeGreaterThanOrEqual(90);
    expect(m.examReadiness).toBeGreaterThanOrEqual(85);
    expect(m.examReadiness).toBeGreaterThan(mathOf(without.dims).examReadiness + 30);
    expect(m.examEvidenceConfidence).toBe("high");
    expect(m.readiness.evidence.years).toBe(3);
    expect(dims.topics.get("a")!.examEvidenceConfidence).toBe("high");
  });

  it("H: low past-paper scores pull readiness down despite accurate practice", () => {
    const a = practised("a");
    const papers = [paper("math", 2024, 20, 100, 4), paper("math", 2025, 25, 100, 6)];
    const base = { topics: [a.topic], exerciseResults: a.results, reviews: a.reviews };
    const practiceOnly = build(base);
    const { dims } = build({
      ...base,
      pastExams: papers,
      pastExamProblems: papers.map((p) => problem(p.id, "a", "wrong")),
    });
    const t = dims.topics.get("a")!;
    expect(t.readiness.evidence.byTier.practice.rate).toBeGreaterThan(0.9);
    expect(t.examReadiness).toBeLessThan(practiceOnly.dims.topics.get("a")!.examReadiness - 10);
    expect(mathOf(dims).examReadiness).toBeLessThan(mathOf(practiceOnly.dims).examReadiness - 10);
    expect(t.examReadiness).toBeLessThan(t.mastery / 2);
  });

  it("I: a mock's weak-topic list is negative-only — unflagged topics gain nothing", () => {
    const parts = {
      topics: [topic("a", "calc", 2), topic("b", "calc", 2)],
      exerciseResults: [result("a", 2, 10, 8), result("b", 2, 10, 8)],
    };
    const before = build(parts);
    // no subjectId → no whole-paper score, only the weak-topic list
    const after = build({ ...parts, mockExams: [mock(undefined, 0, 0, 3, ["a"])] });
    const b0 = before.dims.topics.get("b")!;
    const b1 = after.dims.topics.get("b")!;
    expect(b1.examReadiness).toBe(b0.examReadiness);
    expect(b1.readiness.evidence).toEqual(b0.readiness.evidence);
    expect(b1.examEvidenceConfidence).toBe("low");
    const a1 = after.dims.topics.get("a")!;
    expect(a1.readiness.mockPenalty).toBeGreaterThan(0);
    expect(a1.examReadiness).toBeLessThan(before.dims.topics.get("a")!.examReadiness);
    expect(a1.readiness.evidence.examRecords).toBe(0);
  });

  it("uses a mock's total score as subject-level evidence (both directions)", () => {
    const parts = { topics: [topic("a", "calc", 2)], exerciseResults: [result("a", 2, 10, 8)] };
    const none = mathOf(build(parts).dims).examReadiness;
    const high = mathOf(build({ ...parts, mockExams: [mock("math", 90, 100, 3)] }).dims);
    const low = mathOf(build({ ...parts, mockExams: [mock("math", 10, 100, 3)] }).dims);
    expect(high.examReadiness).toBeGreaterThan(none);
    expect(low.examReadiness).toBeLessThan(none);
  });

  it("whole-paper totals are capped and never fully replace the per-topic evidence", () => {
    const papers = [2021, 2022, 2023, 2024, 2025].map((y, i) => paper("math", y, 100, 100, i + 1));
    const m = mathOf(
      build({ topics: [topic("a", "calc", 0), topic("b", "calc", 0)], pastExams: papers }).dims,
    );
    // topics untouched (readiness 0), five perfect papers → exactly the paper cap
    expect(m.examReadiness).toBeCloseTo(EXAM_READINESS_CONFIG.maxPaperShare * 100, 5);
    expect(m.readiness.examShare).toBeCloseTo(EXAM_READINESS_CONFIG.maxPaperShare, 5);
  });

  it("J: older evidence counts less than equally good recent evidence", () => {
    expect(recencyFactor(ago(5), NOW)).toBe(1);
    expect(recencyFactor(ago(60), NOW)).toBe(0.6);
    expect(recencyFactor(ago(200), NOW)).toBe(0.3);
    const run = (days: number) => {
      const pe = paper("math", 2025, 90, 100, days);
      return build({
        topics: [topic("a", "calc", 1)],
        pastExams: [pe],
        pastExamProblems: [problem(pe.id, "a", "correct")],
      }).dims;
    };
    const recent = run(5);
    const old = run(200);
    expect(old.topics.get("a")!.examReadiness).toBeLessThan(recent.topics.get("a")!.examReadiness);
    expect(mathOf(old).examReadiness).toBeLessThan(mathOf(recent).examReadiness);
    expect(old.topics.get("a")!.readiness.evidence.recentShare).toBeCloseTo(0.3);
  });

  it("N: one high past-paper question does not push low mastery near 100", () => {
    const pe = paper("math", 2025, 100, 100, 2);
    const { dims } = build({
      topics: [topic("a", "calc", 1)],
      pastExams: [pe],
      pastExamProblems: [problem(pe.id, "a", "correct")],
    });
    const t = dims.topics.get("a")!;
    expect(t.readiness.examShare).toBeLessThanOrEqual(EXAM_READINESS_CONFIG.maxSharePerRecord);
    expect(t.examReadiness).toBeLessThan(50);
    // the paper's own total (one full paper at 100%) moves the subject by at most maxSharePerPaper
    expect(mathOf(dims).readiness.examShare).toBeLessThan(0.6);
    expect(mathOf(dims).examReadiness).toBeLessThan(60);
    // one big result set is capped the same way
    const one = build({
      topics: [topic("a", "calc", 1)],
      exerciseResults: [result("a", 1, 10, 10, "past_exam", "past_exam")],
    });
    expect(one.dims.topics.get("a")!.examReadiness).toBeLessThan(50);
  });

  it("O: 面接 is judged by mock interviews, not by math-style past papers", () => {
    const parts = {
      subjects: [subject("math", "problem"), subject("iv", "interview")],
      categories: [category("calc", "math"), category("ivc", "iv")],
      topics: [topic("a", "calc", 0), topic("q", "ivc", 2)],
    };
    const base = build(parts).dims.bySubject.get("iv")!;
    const pe = paper("iv", 2025, 100, 100, 2);
    const stray = build({
      ...parts,
      pastExams: [pe],
      pastExamProblems: [problem(pe.id, "q", "correct")],
      exerciseResults: [result("q", 2, 10, 10, "past_exam", "past_exam")],
      mockExams: [mock("iv", 100, 100, 2)],
    }).dims.bySubject.get("iv")!;
    // no exam-format evidence for 面接: readiness stays the mastery baseline
    // (the existing mastery score itself applies its past-exam correction to every type)
    expect(stray.examReadiness).toBeCloseTo(
      stray.mastery * EXAM_READINESS_CONFIG.noExamEvidenceFactor,
      0,
    );
    expect(stray.readiness.examShare).toBe(0);
    expect(base.examReadiness).toBeCloseTo(
      base.mastery * EXAM_READINESS_CONFIG.noExamEvidenceFactor,
      0,
    );
    expect(stray.readiness.evidence.examRecords).toBe(0);
    expect(stray.examEvidenceConfidence).toBe("low");

    const mocks = build({
      ...parts,
      exerciseResults: [
        result("q", 2, 10, 8, "standard", "mock"),
        result("q", 9, 10, 9, "standard", "mock"),
      ],
    }).dims.bySubject.get("iv")!;
    expect(mocks.readiness.evidence.examRecords).toBe(2);
    expect(mocks.examEvidenceConfidence).toBe("medium");
    expect(mocks.examReadiness).toBeGreaterThan(base.examReadiness);
    const why = explainExamReadiness({
      mastery: mocks.mastery,
      readiness: mocks.readiness,
      evaluationType: "interview",
    });
    expect(why.some((l) => l.startsWith("模擬面接 2回"))).toBe(true);
    expect(why.join()).not.toContain("過去問");
    expect(readinessHint(base.readiness, "interview")).toContain("模擬面接");
  });

  it("confidence is never high without the strongest tier", () => {
    const summary = { examRecords: 10, strongRecords: 0, years: 0, recentShare: 1 };
    expect(calculateExamEvidenceConfidence(summary, "problem")).toBe("medium");
    expect(
      calculateExamEvidenceConfidence({ ...summary, strongRecords: 3, years: 1 }, "problem"),
    ).toBe("medium");
    expect(
      calculateExamEvidenceConfidence({ ...summary, strongRecords: 3, years: 2 }, "problem"),
    ).toBe("high");
    expect(
      calculateExamEvidenceConfidence(
        { ...summary, strongRecords: 3, years: 2, recentShare: 0.3 },
        "problem",
      ),
    ).toBe("medium");
    expect(calculateExamEvidenceConfidence({ ...summary, examRecords: 1 }, "problem")).toBe("low");
  });

  it("exam share: 0 without evidence, capped per record and at 1", () => {
    const f = { fullStrength: 12, maxSharePerRecord: 0.35 };
    expect(calculateExamShare({ ...f, strength: 0, records: 0 })).toBe(0);
    expect(calculateExamShare({ ...f, strength: 100, records: 1 })).toBe(0.35);
    expect(calculateExamShare({ ...f, strength: 6, records: 5 })).toBe(0.5);
    expect(calculateExamShare({ ...f, strength: 100, records: 10 })).toBe(1);
    expect(calculateExamShare({ ...f, strength: NaN, records: 3 })).toBe(0);
  });

  it("K: sparse / malformed data never yields NaN, Infinity or Invalid Date", () => {
    const bad: PastExam = { ...paper("math", 2025, 5, 0, 1), date: "not-a-date" };
    const weird: ExerciseResult = { ...result("a", 1, 0, 0), date: "" };
    const { dims } = build({
      topics: [topic("a", "calc", 2), topic("b", "calc", 0)],
      exerciseResults: [weird, result("a", 1, 5, 9)],
      pastExams: [bad],
      pastExamProblems: [
        problem(bad.id, "a", "partial"),
        { ...problem("missing", "a", "correct") },
        { ...problem(bad.id, "b", "wrong"), score: 3, maxScore: 0 },
      ],
      mockExams: [{ ...mock("math", 10, 0, 1, ["a"]), examDate: "??" }],
    });
    expect(allNumbersFinite(dims)).toEqual([]);
    const m = mathOf(dims);
    expect(
      allNumbersFinite(
        explainExamReadiness({
          mastery: m.mastery,
          readiness: m.readiness,
          evaluationType: "problem",
        }),
      ),
    ).toEqual([]);
    const empty = build({ topics: [] }).dims;
    expect(allNumbersFinite(empty)).toEqual([]);
    expect(mathOf(empty).coverage).toBe(0);
    expect(formatPercent(NaN)).toBe("—");
    expect(summarizeEvidence([], "problem", NOW).examPerformance).toBeNull();
  });

  it("ignores evidence dated after now", () => {
    const future: EvidenceItem = {
      tier: "past_exam",
      rate: 1,
      units: 3,
      at: NOW + 5 * DAY_MS,
      recordKey: "x",
    };
    expect(recencyFactor(future.at, NOW)).toBe(1);
    const pe = paper("math", 2026, 100, 100, -10);
    const { dims } = build({
      topics: [topic("a", "calc", 1)],
      pastExams: [pe],
      pastExamProblems: [problem(pe.id, "a", "correct")],
      exerciseResults: [{ ...result("a", 0, 10, 10, "past_exam", "past_exam"), at: NOW + DAY_MS }],
    });
    expect(mathOf(dims).readiness.evidence.examRecords).toBe(0);
  });
});

/* ------------------------------ scope / univ ----------------------------- */

describe("scope and universities", () => {
  it("P: archived topics and archived subjects are excluded, as in the study model", () => {
    const { dims } = build({
      subjects: [subject("math", "problem"), subject("old", "problem", { archived: true })],
      categories: [category("calc", "math"), category("oc", "old")],
      topics: [
        topic("a", "calc", 0),
        topic("gone", "calc", 4, { archived: true }),
        topic("o", "oc", 4),
      ],
    });
    expect(mathOf(dims).coverage).toBe(0);
    expect(mathOf(dims).topicCount).toBe(1);
    expect(dims.topics.has("gone")).toBe(false);
    expect(dims.bySubject.has("old")).toBe(false);
  });

  it("Q: university dimensions only use required subjects, with the existing weights", () => {
    const parts = {
      subjects: [subject("math", "problem"), subject("cpp", "problem")],
      categories: [category("calc", "math"), category("cc", "cpp")],
      universities: [university("u1"), { ...university("u2"), priority: "candidate" as const }],
      requirements: [
        requirement("u1", "math", 1),
        requirement("u2", "math", 3),
        requirement("u2", "cpp", 1),
      ],
    };
    const lo = build({ ...parts, topics: [topic("a", "calc", 2), topic("c", "cc", 0)] });
    const cppPe = paper("cpp", 2025, 95, 100, 2);
    const hi = build({
      ...parts,
      topics: [topic("a", "calc", 2), topic("c", "cc", 4)],
      exerciseResults: [result("c", 1, 10, 10)],
      pastExams: [cppPe],
      pastExamProblems: [problem(cppPe.id, "c", "correct")],
    });
    const u1lo = lo.dims.byUniversity.get("u1")!;
    const u1hi = hi.dims.byUniversity.get("u1")!;
    expect(u1hi).toEqual(u1lo);
    expect(hi.dims.byUniversity.get("u2")!.examReadiness).toBeGreaterThan(
      lo.dims.byUniversity.get("u2")!.examReadiness,
    );
    expect(hi.dims.primary?.universityId).toBe("u1");
    // university mastery = the existing (mastery-based) readiness
    for (const { model, dims } of [lo, hi]) {
      for (const u of model.universities) {
        expect(dims.byUniversity.get(u.university.id)!.mastery).toBeCloseTo(u.readiness.score, 5);
      }
    }
    const u2 = hi.dims.byUniversity.get("u2")!;
    expect(u2.breakdown.map((b) => b.share)).toEqual([0.75, 0.25]);
  });

  it("combines subject confidence by share", () => {
    expect(combineConfidence([])).toBe("low");
    expect(
      combineConfidence([
        { share: 0.9, confidence: "high" },
        { share: 0.1, confidence: "low" },
      ]),
    ).toBe("high");
    expect(
      combineConfidence([
        { share: 0.5, confidence: "high" },
        { share: 0.5, confidence: "low" },
      ]),
    ).toBe("medium");
  });

  it("R: the same snapshot and now always give the same result", () => {
    const a = practised("a");
    const pe = paper("math", 2025, 70, 100, 12);
    const parts = {
      topics: [a.topic, topic("b", "calc", 1)],
      exerciseResults: a.results,
      reviews: a.reviews,
      pastExams: [pe],
      pastExamProblems: [problem(pe.id, "a", "partial")],
      mockExams: [mock("math", 60, 100, 20, ["b"])],
    };
    const one = build(parts);
    const two = build(parts);
    expect(two.dims).toEqual(one.dims);
    expect(buildLearningDimensions(one.model)).toEqual(one.dims);
  });
});

/* ------------------------- forecast (mastery work) ------------------------ */

describe("mastery-based remaining work (not wired into the forecast yet)", () => {
  it("matches the status factor exactly at the mastery base anchors", () => {
    for (const [status, m] of [
      [0, 0],
      [1, 20],
      [2, 50],
      [3, 75],
      [4, 100],
    ] as const) {
      expect(masteryRemainingWorkFactor(m)).toBeCloseTo(
        FORECAST_CONFIG.remainingWorkFactor[status],
      );
      expect(topicRemainingMinutesByMastery(120, m)).toBeCloseTo(
        topicRemainingMinutes(120, status),
      );
    }
  });

  it("is continuous and decreasing between anchors, and safe on bad input", () => {
    expect(masteryRemainingWorkFactor(35)).toBeCloseTo((0.7 + 0.35) / 2);
    let prev = Infinity;
    for (let m = 0; m <= 100; m += 5) {
      const f = masteryRemainingWorkFactor(m);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
    expect(masteryRemainingWorkFactor(-10)).toBe(1);
    expect(masteryRemainingWorkFactor(150)).toBe(0);
    expect(masteryRemainingWorkFactor(NaN)).toBe(1);
    expect(topicRemainingMinutesByMastery(NaN, 50)).toBe(0);
  });

  it("differs from the status factor when evidence moves mastery (comparison)", () => {
    // 基本OK but failing basics and reviews → lower mastery → more work left than the status says
    const { model } = build({
      topics: [topic("a", "calc", 2)],
      exerciseResults: [result("a", 1, 10, 3, "basic"), result("a", 2, 10, 3, "basic")],
      reviews: [review("a", 3, "failed")],
    });
    const m = model.topicMetrics.get("a")!;
    expect(m.mastery.score).toBeLessThan(50);
    expect(topicRemainingMinutesByMastery(120, m.mastery.score)).toBeGreaterThan(
      topicRemainingMinutes(120, 2),
    );
  });
});
