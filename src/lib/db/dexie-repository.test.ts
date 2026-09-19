import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildStudyModel } from "@/lib/model/buildStudyModel";
import { DexieRepository } from "@/lib/db/dexie-repository";
import { DB_NAME, HenyuDB } from "@/lib/db/schema";
import { SUBJECT_TEMPLATES, UNIVERSITY_TEMPLATES, buildMathSeed } from "@/lib/db/seed";

let db: HenyuDB;
let repo: DexieRepository;

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  await deleteDb();
  db = new HenyuDB();
  repo = new DexieRepository(db);
});

afterEach(() => {
  repo.close();
});

const totalTemplateTopics = SUBJECT_TEMPLATES.reduce(
  (n, s) => n + s.categories.reduce((m, c) => m + c.topics.length, 0),
  0,
);
const totalTemplateCategories = SUBJECT_TEMPLATES.reduce((n, s) => n + s.categories.length, 0);
const mathTopic = async (name: string) =>
  (await repo.listTopics()).find((t) => t.name === name && t.id.startsWith("topic_math_"))!;

describe("initialize (fresh install)", () => {
  it("seeds every exam subject, universities and is idempotent", async () => {
    const first = await repo.initialize();
    expect(first.seeded).toBe(true);
    expect(await repo.listSubjects()).toHaveLength(SUBJECT_TEMPLATES.length);
    expect(await repo.listTopics()).toHaveLength(totalTemplateTopics);
    expect(await repo.listCategories()).toHaveLength(totalTemplateCategories);
    expect(await db.universities.count()).toBe(UNIVERSITY_TEMPLATES.length);

    const second = await repo.initialize();
    expect(second).toEqual({ seeded: false, migrated: false });
    expect(await repo.listTopics()).toHaveLength(totalTemplateTopics);
  });

  it("sets the 第一志望, allocation and schemaVersion", async () => {
    await repo.initialize();
    const settings = await repo.getSettings();
    expect(settings.schemaVersion).toBe(2);
    expect(settings.primaryUniversityId).toBe("univ_uec");
    expect(settings.subjectAllocation?.subj_math).toBe(60);
    expect(settings.primarySubjectId).toBe("subj_math");
  });

  it("resolves topic dependencies (微分係数 → 微分につながる極限)", async () => {
    await repo.initialize();
    const deriv = await mathTopic("微分係数");
    const limit = await mathTopic("微分につながる極限");
    expect(deriv.dependsOn).toEqual([limit.id]);
  });
});

describe("roadmap order in the model", () => {
  it("locks untouched topics behind unfinished prerequisite categories", async () => {
    await repo.initialize();
    const model = buildStudyModel(await repo.getSnapshot());
    const multivar = model.topicMetrics.get((await mathTopic("多変数関数")).id)!;
    const expand = model.topicMetrics.get((await mathTopic("展開")).id)!;
    expect(multivar.depsMet).toBe(false);
    expect(multivar.lockedBy.map((c) => c.name)).toEqual(["一変数積分"]);
    expect(expand.depsMet).toBe(true);
    const learn = model.candidates.filter((c) => c.kind === "learn" && c.subjectId === "subj_math");
    const top = learn.sort((a, b) => b.priority - a.priority)[0];
    expect(top?.topicName).toBe("展開");
  });

  it("never blocks a topic the user already started", async () => {
    await repo.initialize();
    const t = await mathTopic("多変数関数");
    await repo.setTopicStatus(t.id, 1);
    const model = buildStudyModel(await repo.getSnapshot());
    expect(model.topicMetrics.get(t.id)?.depsMet).toBe(true);
  });
});

describe("migration v1 → v2", () => {
  async function seedV1() {
    const now = Date.now();
    const seed = buildMathSeed(now);
    // Phase 1 rows: no evaluationType, no universities, schemaVersion 1
    const { evaluationType: _drop, ...v1Subject } = seed.subject;
    void _drop;
    await db.subjects.put(v1Subject);
    await db.categories.bulkPut(seed.categories);
    await db.topics.bulkPut(
      seed.topics.map((t) => (t.name === "展開" ? { ...t, status: 3 as const } : t)),
    );
    await db.settings.put({
      id: "app",
      schemaVersion: 1,
      examName: "電通大",
      examDate: "2027-07-10",
      primarySubjectId: seed.subject.id,
      theme: "dark",
      autoLowerStatusOnFailedReview: false,
      dailyStudyGoalMin: 60,
      weeklyStudyGoalMin: 480,
      onboardedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.studySessions.put({
      id: "s1",
      topicId: seed.topics[0]!.id,
      subjectId: seed.subject.id,
      startedAt: now - 3_600_000,
      endedAt: now,
      durationSec: 3600,
      source: "timer",
      createdAt: now,
    });
    await db.examScores.put({
      id: "e1",
      examName: "電通大",
      year: 2024,
      subject: "数学",
      score: 61,
      maxScore: 120,
      date: "2026-08-01",
      createdAt: now,
    });
    await db.dailyGoals.put({
      id: "2026-09-01",
      date: "2026-09-01",
      text: "極限",
      done: true,
      createdAt: now,
      updatedAt: now,
    });
    return seed;
  }

  it("keeps Phase 1 data and adds only the missing subjects", async () => {
    const seed = await seedV1();
    const result = await repo.initialize();
    expect(result).toEqual({ seeded: false, migrated: true });

    // untouched Phase 1 data
    expect((await mathTopic("展開")).status).toBe(3);
    expect(await repo.listStudySessions()).toHaveLength(1);
    expect((await repo.getDailyGoal("2026-09-01"))?.done).toBe(true);
    expect(await db.examScores.count()).toBe(1);
    const mathTopics = (await repo.listTopics()).filter((t) => t.id.startsWith("topic_math_"));
    expect(mathTopics).toHaveLength(seed.topics.length);

    // new subjects, no duplicate math
    const subjects = await repo.listSubjects();
    expect(subjects).toHaveLength(SUBJECT_TEMPLATES.length);
    expect(subjects.filter((s) => s.slug === "math")).toHaveLength(1);
    expect(subjects.find((s) => s.slug === "math")?.evaluationType).toBe("problem");

    // universities + 第一志望 exam date carried over
    const uec = await db.universities.get("univ_uec");
    expect(uec?.examDate).toBe("2027-07-10");
    // examScores → pastExams
    const past = await db.pastExams.toArray();
    expect(past).toHaveLength(1);
    expect(past[0]?.universityId).toBe("univ_uec");
    expect((await repo.getSettings()).schemaVersion).toBe(2);
  });

  it("is idempotent and the template button never duplicates", async () => {
    await seedV1();
    await repo.initialize();
    expect(await repo.initialize()).toEqual({ seeded: false, migrated: false });
    expect((await repo.ensureExamTemplate()).addedSubjects).toEqual([]);
    expect(await repo.listSubjects()).toHaveLength(SUBJECT_TEMPLATES.length);
    expect(await db.pastExams.count()).toBe(1);
  });

  it("re-adds a deleted template subject with its university requirement", async () => {
    await repo.initialize();
    await repo.deleteSubject("subj_physics");
    expect(await db.universityRequirements.get("req_uec_physics")).toBeUndefined();
    const { addedSubjects } = await repo.ensureExamTemplate();
    expect(addedSubjects).toEqual(["物理"]);
    expect(await db.universityRequirements.get("req_uec_physics")).toBeDefined();
  });
});

describe("setTopicStatus", () => {
  it("stamps basicOkAt and opens a review when a topic first reaches 基本OK", async () => {
    await repo.initialize();
    const target = await mathTopic("展開");
    await repo.setTopicStatus(target.id, 2);
    const updated = await repo.getTopic(target.id);
    expect(updated?.status).toBe(2);
    expect(updated?.basicOkAt).toBeTruthy();
    const open = await repo.listOpenReviews();
    expect(open.filter((r) => r.topicId === target.id)).toHaveLength(1);
  });

  it("removes the open review if the topic drops back below 基本OK", async () => {
    await repo.initialize();
    const target = await mathTopic("展開");
    await repo.setTopicStatus(target.id, 2);
    await repo.setTopicStatus(target.id, 1);
    expect((await repo.listOpenReviews()).filter((r) => r.topicId === target.id)).toHaveLength(0);
  });
});

describe("exercise results & reviews", () => {
  it("records results, moves an untouched topic to 学習中, and feeds accuracy", async () => {
    await repo.initialize();
    const limit = await mathTopic("関数の極限");
    await repo.addExerciseResult({
      topicId: limit.id,
      attemptedCount: 10,
      correctCount: 8,
      difficulty: "basic",
      type: "practice",
    });
    expect((await repo.getTopic(limit.id))?.status).toBe(1);
    const model = buildStudyModel(await repo.getSnapshot());
    const m = model.topicMetrics.get(limit.id);
    expect(m?.accuracy.recent.rate).toBeCloseTo(0.8);
    expect(m?.mastery.score).toBeGreaterThan(20);
  });

  it("clamps correct ≤ attempted", async () => {
    await repo.initialize();
    const t = await mathTopic("展開");
    const r = await repo.addExerciseResult({
      topicId: t.id,
      attemptedCount: 3,
      correctCount: 9,
      difficulty: "basic",
      type: "practice",
    });
    expect(r.correctCount).toBe(3);
  });

  it("completeReview schedules the next stage and can log review problems", async () => {
    await repo.initialize();
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 2);
    const review = (await repo.listOpenReviews()).find((r) => r.topicId === t.id)!;
    await repo.completeReview(review.id, "got", { attemptedCount: 5, correctCount: 4 });
    const next = (await repo.listOpenReviews()).find((r) => r.topicId === t.id);
    expect(next?.stage).toBe(1);
    const results = await repo.listExerciseResults(t.id);
    expect(results[0]?.type).toBe("review");
  });

  it("lowers the status on できなかった when enabled", async () => {
    await repo.initialize();
    await repo.updateSettings({ autoLowerStatusOnFailedReview: true });
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 3);
    const review = (await repo.listOpenReviews()).find((r) => r.topicId === t.id)!;
    await repo.completeReview(review.id, "failed");
    expect((await repo.getTopic(t.id))?.status).toBe(2);
  });

  it("recordStudy writes a session and an exercise result together", async () => {
    await repo.initialize();
    const t = await mathTopic("因数分解");
    await repo.recordStudy({
      topicId: t.id,
      subjectId: null,
      minutes: 25,
      source: "timer",
      plannedMinutes: 30,
      exercise: { attemptedCount: 6, correctCount: 5, difficulty: "basic", type: "practice" },
    });
    const sessions = await repo.listStudySessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.subjectId).toBe("subj_math");
    expect(sessions[0]?.plannedMinutes).toBe(30);
    const results = await repo.listExerciseResults(t.id);
    expect(results[0]?.sessionId).toBe(sessions[0]?.id);
  });
});

/*
 * Phase 3 (学習速度・週次レビュー) reconstructs status history from
 * `status_change` activity logs — they are the only record of *when* a topic
 * moved. These tests pin that every status path writes one with from/to.
 * See docs/PHASE3_DESIGN.md §3.
 */
describe("status history for Phase 3", () => {
  const statusLogs = async (topicId: string) =>
    (await db.activityLogs.toArray())
      .filter((l) => l.type === "status_change" && l.topicId === topicId)
      // two changes can share a millisecond; a replay then orders them by chaining to → from
      .sort(
        (a, b) =>
          a.at - b.at || (a.meta?.to === b.meta?.from ? -1 : b.meta?.to === a.meta?.from ? 1 : 0),
      );

  it("logs from/to and the subject on a manual status change", async () => {
    await repo.initialize();
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 2);
    await repo.setTopicStatus(t.id, 3);
    const logs = await statusLogs(t.id);
    expect(logs.map((l) => l.meta)).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 3 },
    ]);
    expect(logs.every((l) => l.subjectId === "subj_math" && l.at > 0)).toBe(true);
  });

  it("logs the automatic 未学習 → 学習中 move from an exercise result", async () => {
    await repo.initialize();
    const t = await mathTopic("関数の極限");
    await repo.addExerciseResult({
      topicId: t.id,
      attemptedCount: 3,
      correctCount: 1,
      difficulty: "basic",
      type: "practice",
    });
    expect((await statusLogs(t.id)).map((l) => l.meta)).toEqual([{ from: 0, to: 1 }]);
  });

  it("logs a status lowered by a failed review", async () => {
    await repo.initialize();
    await repo.updateSettings({ autoLowerStatusOnFailedReview: true });
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 3);
    const review = (await repo.listOpenReviews()).find((r) => r.topicId === t.id)!;
    await repo.completeReview(review.id, "failed");
    expect((await statusLogs(t.id)).map((l) => l.meta)).toEqual([
      { from: 0, to: 3 },
      { from: 3, to: 2 },
    ]);
  });

  it("does not log a no-op status change", async () => {
    await repo.initialize();
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 1);
    await repo.setTopicStatus(t.id, 1);
    expect(await statusLogs(t.id)).toHaveLength(1);
  });

  it("keeps a deleted topic's study time attributable to its subject", async () => {
    await repo.initialize();
    const t = await mathTopic("因数分解");
    await repo.recordStudy({ topicId: t.id, subjectId: null, minutes: 20, source: "manual" });
    await repo.deleteTopic(t.id);
    const [session] = await repo.listStudySessions();
    expect(session?.topicId).toBeNull();
    expect(session?.subjectId).toBe("subj_math");
  });
});

describe("deleteTopic", () => {
  it("removes dangling dependency edges", async () => {
    await repo.initialize();
    const limit = await mathTopic("微分につながる極限");
    await repo.deleteTopic(limit.id);
    expect((await mathTopic("微分係数")).dependsOn).toEqual([]);
  });
});

describe("backup round-trip", () => {
  it("exports and re-imports every table without loss", async () => {
    await repo.initialize();
    const t = await mathTopic("展開");
    await repo.setTopicStatus(t.id, 2);
    await repo.setDailyGoal("2026-06-01", "テスト目標");
    await repo.addExerciseResult({
      topicId: t.id,
      attemptedCount: 5,
      correctCount: 5,
      difficulty: "basic",
      type: "practice",
    });
    await repo.addMockExam({
      examName: "全統記述",
      examDate: "2026-09-01",
      subject: "数学",
      score: 82,
      maxScore: 200,
      deviationValue: 52.4,
    });
    await repo.addPastExam(
      {
        universityId: "univ_uec",
        year: 2025,
        subject: "数学",
        score: 72,
        maxScore: 120,
        date: "2026-09-10",
      },
      [{ number: 1, topicId: t.id, result: "wrong" }],
    );

    const backup = await repo.exportBackup();
    expect(backup.schemaVersion).toBe(2);

    await repo.resetAll();
    await repo.importBackup(backup);

    expect((await repo.getTopic(t.id))?.status).toBe(2);
    expect(await repo.listExerciseResults(t.id)).toHaveLength(1);
    expect(await db.mockExams.count()).toBe(1);
    expect(await db.pastExamProblems.count()).toBe(1);
    expect((await repo.getDailyGoal("2026-06-01"))?.text).toBe("テスト目標");
  });

  it("imports a v1 backup and migrates it", async () => {
    const seed = buildMathSeed();
    await repo.importBackup({
      format: "henyu-dashboard-backup",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        subjects: [seed.subject],
        categories: seed.categories,
        topics: seed.topics,
        studySessions: [],
        reviews: [],
        dailyGoals: [],
        examScores: [],
        settings: [],
        activityLogs: [],
      },
    });
    expect(await repo.listSubjects()).toHaveLength(SUBJECT_TEMPLATES.length);
    expect((await repo.getSettings()).schemaVersion).toBe(2);
  });
});

describe("daily plan inputs", () => {
  it("stores available minutes on the day row without touching the goal", async () => {
    await repo.initialize();
    await repo.setDailyGoal("2026-09-19", "極限を基本OK");
    await repo.setAvailableMinutes("2026-09-19", 90);
    const g = await repo.getDailyGoal("2026-09-19");
    expect(g?.availableMinutes).toBe(90);
    expect(g?.text).toBe("極限を基本OK");
  });

  it("re-plans only the time left today and keeps math as the main subject", async () => {
    await repo.initialize();
    const t = await mathTopic("因数分解");
    await repo.recordStudy({ topicId: t.id, subjectId: null, minutes: 30, source: "manual" });
    const model = buildStudyModel(await repo.getSnapshot());
    const plan = model.buildPlan(120);
    expect(plan.doneMinutes).toBe(30);
    expect(plan.availableMinutes).toBe(90);
    expect(plan.plannedMinutes).toBeLessThanOrEqual(90);
    expect(plan.items[0]?.subjectId).toBe("subj_math");
    const math = plan.items
      .filter((i) => i.subjectId === "subj_math")
      .reduce((s, i) => s + i.minutes, 0);
    const others = new Map<string, number>();
    for (const i of plan.items)
      if (i.subjectId !== "subj_math")
        others.set(i.subjectId, (others.get(i.subjectId) ?? 0) + i.minutes);
    expect(math).toBeGreaterThanOrEqual(Math.max(0, ...others.values()));
  });
});
