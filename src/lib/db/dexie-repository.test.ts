import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DexieRepository } from "@/lib/db/dexie-repository";
import { DB_NAME, HenyuDB } from "@/lib/db/schema";
import { MATH_ROADMAP } from "@/lib/db/seed";

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
  repo = new DexieRepository(new HenyuDB());
});

afterEach(() => {
  repo.close();
});

const totalSeedTopics = MATH_ROADMAP.reduce((n, c) => n + c.topics.length, 0);

describe("initialize", () => {
  it("seeds the math roadmap on first run and is idempotent afterwards", async () => {
    const first = await repo.initialize();
    expect(first.seeded).toBe(true);

    const topics = await repo.listTopics();
    const categories = await repo.listCategories();
    expect(topics).toHaveLength(totalSeedTopics);
    expect(categories).toHaveLength(MATH_ROADMAP.length);

    const second = await repo.initialize();
    expect(second.seeded).toBe(false);
    expect(await repo.listTopics()).toHaveLength(totalSeedTopics);
  });

  it("creates a settings row and points primarySubject at 数学", async () => {
    await repo.initialize();
    const settings = await repo.getSettings();
    const subjects = await repo.listSubjects();
    expect(settings.primarySubjectId).toBe(subjects[0]?.id);
    expect(settings.schemaVersion).toBeGreaterThan(0);
  });
});

describe("setTopicStatus", () => {
  it("stamps basicOkAt and opens a review when a topic first reaches 基本OK", async () => {
    await repo.initialize();
    const topics = await repo.listTopics();
    const target = topics[0]!;

    await repo.setTopicStatus(target.id, 2);

    const updated = await repo.getTopic(target.id);
    expect(updated?.status).toBe(2);
    expect(updated?.basicOkAt).toBeTruthy();
    expect(updated?.lastStatusUpAt).toBeTruthy();

    const open = await repo.listOpenReviews();
    expect(open.filter((r) => r.topicId === target.id)).toHaveLength(1);
  });

  it("removes the open review if the topic drops back below 基本OK", async () => {
    await repo.initialize();
    const target = (await repo.listTopics())[0]!;
    await repo.setTopicStatus(target.id, 2);
    await repo.setTopicStatus(target.id, 1);

    const open = await repo.listOpenReviews();
    expect(open.filter((r) => r.topicId === target.id)).toHaveLength(0);
  });

  it("logs an activity entry for each status change", async () => {
    await repo.initialize();
    const target = (await repo.listTopics())[0]!;
    await repo.setTopicStatus(target.id, 1);
    const activity = await repo.listActivity(10);
    expect(activity.some((a) => a.type === "status_change" && a.topicId === target.id)).toBe(true);
  });
});

describe("completeReview", () => {
  it("schedules the next stage on できた", async () => {
    await repo.initialize();
    const target = (await repo.listTopics())[0]!;
    await repo.setTopicStatus(target.id, 2);
    const review = (await repo.listOpenReviews()).find((r) => r.topicId === target.id)!;

    await repo.completeReview(review.id, "got");

    const open = await repo.listOpenReviews();
    const next = open.find((r) => r.topicId === target.id);
    expect(next?.stage).toBe(1);
    expect((await repo.listReviews()).find((r) => r.id === review.id)?.completedAt).toBeTruthy();
  });

  it("lowers the status on できなかった when the setting is enabled", async () => {
    await repo.initialize();
    await repo.updateSettings({ autoLowerStatusOnFailedReview: true });
    const target = (await repo.listTopics())[0]!;
    await repo.setTopicStatus(target.id, 3);
    const review = (await repo.listOpenReviews()).find((r) => r.topicId === target.id)!;

    await repo.completeReview(review.id, "failed");

    expect((await repo.getTopic(target.id))?.status).toBe(2);
  });
});

describe("study sessions", () => {
  it("records a session and bumps the topic's lastStudiedAt", async () => {
    await repo.initialize();
    const target = (await repo.listTopics())[0]!;
    const endedAt = Date.now();

    await repo.logStudySession({
      topicId: target.id,
      subjectId: null,
      startedAt: endedAt - 1_500_000,
      endedAt,
      durationSec: 1500,
      source: "timer",
    });

    const sessions = await repo.listStudySessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationSec).toBe(1500);
    expect((await repo.getTopic(target.id))?.lastStudiedAt).toBe(endedAt);
  });
});

describe("backup round-trip", () => {
  it("exports and re-imports every table without loss", async () => {
    await repo.initialize();
    const target = (await repo.listTopics())[0]!;
    await repo.setTopicStatus(target.id, 2);
    await repo.setDailyGoal("2026-06-01", "テスト目標");
    await repo.addExamScore({
      examName: "電通大",
      year: 2024,
      subject: "数学",
      score: 61,
      maxScore: 120,
      date: "2024-07-01",
    });

    const backup = await repo.exportBackup();
    expect(backup.format).toBe("henyu-dashboard-backup");

    // wipe and restore
    await repo.resetAll();
    await repo.importBackup(backup);

    expect(await repo.listTopics()).toHaveLength(totalSeedTopics);
    expect((await repo.getTopic(target.id))?.status).toBe(2);
    expect(await repo.listExamScores()).toHaveLength(1);
    expect((await repo.getDailyGoal("2026-06-01"))?.text).toBe("テスト目標");
  });
});

describe("daily goals", () => {
  it("keeps one goal per day and toggles done with an activity log", async () => {
    await repo.initialize();
    await repo.setDailyGoal("2026-06-02", "微分の復習");
    await repo.setDailyGoal("2026-06-02", "微分の復習（修正）");
    const goals = await repo.listDailyGoals();
    expect(goals).toHaveLength(1);
    expect(goals[0]?.text).toBe("微分の復習（修正）");

    await repo.setDailyGoalDone("2026-06-02", true);
    expect((await repo.getDailyGoal("2026-06-02"))?.done).toBe(true);
    expect((await repo.listActivity(10)).some((a) => a.type === "goal_completed")).toBe(true);
  });
});
