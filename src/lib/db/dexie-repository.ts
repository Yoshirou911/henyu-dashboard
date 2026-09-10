import {
  DEFAULT_DAILY_GOAL_MIN,
  DEFAULT_EXAM_DATE,
  DEFAULT_EXAM_NAME,
  DEFAULT_WEEKLY_GOAL_MIN,
  SCHEMA_VERSION,
} from "@/lib/constants";
import { dayKey } from "@/lib/date";
import { buildMathSeed } from "@/lib/db/seed";
import { getDb, type HenyuDB } from "@/lib/db/schema";
import type { DataRepository } from "@/lib/db/repository";
import { firstReviewDueAt, planAfterReview } from "@/lib/review-schedule";
import type {
  ActivityLog,
  ActivityType,
  BackupFile,
  Category,
  DailyGoal,
  ExamScore,
  ID,
  Review,
  ReviewOutcome,
  Settings,
  StudySession,
  StudySource,
  Subject,
  Topic,
} from "@/lib/types";
import { createId } from "@/lib/utils";

function defaultSettings(now: number): Settings {
  return {
    id: "app",
    schemaVersion: SCHEMA_VERSION,
    examName: DEFAULT_EXAM_NAME,
    examDate: DEFAULT_EXAM_DATE,
    primarySubjectId: null,
    theme: "dark",
    autoLowerStatusOnFailedReview: false,
    dailyStudyGoalMin: DEFAULT_DAILY_GOAL_MIN,
    weeklyStudyGoalMin: DEFAULT_WEEKLY_GOAL_MIN,
    createdAt: now,
    updatedAt: now,
  };
}

export class DexieRepository implements DataRepository {
  private readonly db: HenyuDB;

  constructor(db: HenyuDB = getDb()) {
    this.db = db;
  }

  /** Close the underlying connection (used in tests / teardown). */
  close(): void {
    this.db.close();
  }

  /* ------------------------------------------------------------------ */
  /* lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  async initialize(): Promise<{ seeded: boolean }> {
    const now = Date.now();
    let settings = await this.db.settings.get("app");
    if (!settings) {
      settings = defaultSettings(now);
      await this.db.settings.put(settings);
    }

    const topicCount = await this.db.topics.count();
    if (topicCount > 0) return { seeded: false };

    const seed = buildMathSeed(now);
    await this.db.transaction(
      "rw",
      [
        this.db.subjects,
        this.db.categories,
        this.db.topics,
        this.db.settings,
        this.db.activityLogs,
      ],
      async () => {
        await this.db.subjects.put(seed.subject);
        await this.db.categories.bulkPut(seed.categories);
        await this.db.topics.bulkPut(seed.topics);
        await this.db.settings.update("app", {
          primarySubjectId: seed.subject.id,
          updatedAt: now,
        });
        await this.db.activityLogs.add(
          this.makeLog("seed", "数学ロードマップを作成しました", {
            subjectId: seed.subject.id,
            meta: { categories: seed.categories.length, topics: seed.topics.length },
          }),
        );
      },
    );
    return { seeded: true };
  }

  async isEmpty(): Promise<boolean> {
    const [topics, subjects] = await Promise.all([
      this.db.topics.count(),
      this.db.subjects.count(),
    ]);
    return topics === 0 && subjects === 0;
  }

  /* ------------------------------------------------------------------ */
  /* reads                                                             */
  /* ------------------------------------------------------------------ */

  async getSettings(): Promise<Settings> {
    const settings = await this.db.settings.get("app");
    if (settings) return settings;
    const fresh = defaultSettings(Date.now());
    await this.db.settings.put(fresh);
    return fresh;
  }

  listSubjects(): Promise<Subject[]> {
    return this.db.subjects.orderBy("order").toArray();
  }

  listCategories(subjectId?: ID): Promise<Category[]> {
    if (subjectId) {
      return this.db.categories.where("subjectId").equals(subjectId).sortBy("order");
    }
    return this.db.categories.orderBy("order").toArray();
  }

  listTopics(): Promise<Topic[]> {
    return this.db.topics.orderBy("order").toArray();
  }

  getTopic(id: ID): Promise<Topic | undefined> {
    return this.db.topics.get(id);
  }

  listStudySessions(sinceMs?: number): Promise<StudySession[]> {
    if (sinceMs !== undefined) {
      return this.db.studySessions.where("startedAt").aboveOrEqual(sinceMs).sortBy("startedAt");
    }
    return this.db.studySessions.orderBy("startedAt").toArray();
  }

  listReviews(): Promise<Review[]> {
    return this.db.reviews.orderBy("dueAt").toArray();
  }

  async listOpenReviews(): Promise<Review[]> {
    const all = await this.db.reviews.orderBy("dueAt").toArray();
    return all.filter((r) => !r.completedAt);
  }

  getDailyGoal(date: string): Promise<DailyGoal | undefined> {
    return this.db.dailyGoals.get(date);
  }

  listDailyGoals(sinceDate?: string): Promise<DailyGoal[]> {
    if (sinceDate) {
      return this.db.dailyGoals.where("date").aboveOrEqual(sinceDate).sortBy("date");
    }
    return this.db.dailyGoals.orderBy("date").toArray();
  }

  listExamScores(): Promise<ExamScore[]> {
    return this.db.examScores.orderBy("year").toArray();
  }

  async listActivity(limit = 40): Promise<ActivityLog[]> {
    return this.db.activityLogs.orderBy("at").reverse().limit(limit).toArray();
  }

  /* ------------------------------------------------------------------ */
  /* topic mutations                                                   */
  /* ------------------------------------------------------------------ */

  async setTopicStatus(topicId: ID, status: Topic["status"]): Promise<void> {
    const now = Date.now();
    await this.db.transaction(
      "rw",
      [this.db.topics, this.db.reviews, this.db.activityLogs, this.db.categories, this.db.subjects],
      async () => {
        const topic = await this.db.topics.get(topicId);
        if (!topic || topic.status === status) return;
        const prev = topic.status;

        const patch: Partial<Topic> = { status, updatedAt: now };
        if (status > prev) patch.lastStatusUpAt = now;
        if (status >= 2 && !topic.basicOkAt) patch.basicOkAt = now;
        await this.db.topics.update(topicId, patch);

        const openReviews = (
          await this.db.reviews.where("topicId").equals(topicId).toArray()
        ).filter((r) => !r.completedAt);

        if (status >= 2 && prev < 2 && openReviews.length === 0) {
          const anchor = topic.basicOkAt ?? now;
          await this.db.reviews.add({
            id: createId("rev"),
            topicId,
            stage: 0,
            dueAt: firstReviewDueAt(anchor),
            createdAt: now,
          });
        } else if (status < 2 && openReviews.length > 0) {
          await this.db.reviews.bulkDelete(openReviews.map((r) => r.id));
        }

        const subjectId = await this.subjectIdForTopic(topic);
        await this.db.activityLogs.add(
          this.makeLog("status_change", `${topic.name} を「${labelFor(status)}」に変更`, {
            topicId,
            subjectId,
            meta: { from: prev, to: status },
          }),
        );
      },
    );
  }

  async updateTopic(
    topicId: ID,
    patch: Partial<Pick<Topic, "name" | "description" | "note" | "weight" | "order">>,
  ): Promise<void> {
    const clean: Partial<Topic> = { ...patch, updatedAt: Date.now() };
    if (clean.weight !== undefined && (!Number.isFinite(clean.weight) || clean.weight <= 0)) {
      clean.weight = 1;
    }
    await this.db.topics.update(topicId, clean);
  }

  async addTopic(categoryId: ID, name: string): Promise<Topic> {
    const now = Date.now();
    const count = await this.db.topics.where("categoryId").equals(categoryId).count();
    const topic: Topic = {
      id: createId("topic"),
      categoryId,
      name: name.trim() || "新しい単元",
      status: 0,
      weight: 1,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction("rw", [this.db.topics, this.db.activityLogs], async () => {
      await this.db.topics.add(topic);
      await this.db.activityLogs.add(
        this.makeLog("topic_added", `単元「${topic.name}」を追加`, { topicId: topic.id }),
      );
    });
    return topic;
  }

  async deleteTopic(topicId: ID): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.topics, this.db.reviews, this.db.studySessions],
      async () => {
        await this.db.topics.delete(topicId);
        const reviews = await this.db.reviews.where("topicId").equals(topicId).primaryKeys();
        await this.db.reviews.bulkDelete(reviews as ID[]);
        // Study sessions are kept for time analytics but detached from the topic.
        await this.db.studySessions.where("topicId").equals(topicId).modify({ topicId: null });
      },
    );
  }

  async reorderTopics(categoryId: ID, orderedIds: ID[]): Promise<void> {
    await this.db.transaction("rw", this.db.topics, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          this.db.topics.update(id, { order: index, updatedAt: Date.now() }),
        ),
      );
      void categoryId;
    });
  }

  /* ------------------------------------------------------------------ */
  /* category / subject mutations                                      */
  /* ------------------------------------------------------------------ */

  async addCategory(subjectId: ID, name: string): Promise<Category> {
    const now = Date.now();
    const count = await this.db.categories.where("subjectId").equals(subjectId).count();
    const category: Category = {
      id: createId("cat"),
      subjectId,
      name: name.trim() || "新しい分野",
      order: count,
      track: 0,
      prerequisiteIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.db.categories.add(category);
    return category;
  }

  async updateCategory(
    categoryId: ID,
    patch: Partial<Pick<Category, "name" | "description" | "order" | "track" | "prerequisiteIds">>,
  ): Promise<void> {
    await this.db.categories.update(categoryId, { ...patch, updatedAt: Date.now() });
  }

  async deleteCategory(categoryId: ID): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.categories, this.db.topics, this.db.reviews],
      async () => {
        const topicIds = (await this.db.topics
          .where("categoryId")
          .equals(categoryId)
          .primaryKeys()) as ID[];
        await this.db.topics.bulkDelete(topicIds);
        for (const tid of topicIds) {
          const revIds = (await this.db.reviews.where("topicId").equals(tid).primaryKeys()) as ID[];
          await this.db.reviews.bulkDelete(revIds);
        }
        await this.db.categories.delete(categoryId);
      },
    );
  }

  async reorderCategories(subjectId: ID, orderedIds: ID[]): Promise<void> {
    await this.db.transaction("rw", this.db.categories, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          this.db.categories.update(id, { order: index, updatedAt: Date.now() }),
        ),
      );
      void subjectId;
    });
  }

  async addSubject(name: string, slug: string): Promise<Subject> {
    const now = Date.now();
    const count = await this.db.subjects.count();
    const subject: Subject = {
      id: createId("subj"),
      slug: slug.trim() || createId("s"),
      name: name.trim() || "新しい教科",
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.subjects.add(subject);
    return subject;
  }

  async updateSubject(
    subjectId: ID,
    patch: Partial<Pick<Subject, "name" | "color" | "order">>,
  ): Promise<void> {
    await this.db.subjects.update(subjectId, { ...patch, updatedAt: Date.now() });
  }

  async deleteSubject(subjectId: ID): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.subjects, this.db.categories, this.db.topics, this.db.reviews],
      async () => {
        const catIds = (await this.db.categories
          .where("subjectId")
          .equals(subjectId)
          .primaryKeys()) as ID[];
        for (const cid of catIds) {
          const topicIds = (await this.db.topics
            .where("categoryId")
            .equals(cid)
            .primaryKeys()) as ID[];
          await this.db.topics.bulkDelete(topicIds);
          for (const tid of topicIds) {
            const revIds = (await this.db.reviews
              .where("topicId")
              .equals(tid)
              .primaryKeys()) as ID[];
            await this.db.reviews.bulkDelete(revIds);
          }
        }
        await this.db.categories.bulkDelete(catIds);
        await this.db.subjects.delete(subjectId);
      },
    );
  }

  /* ------------------------------------------------------------------ */
  /* study time                                                        */
  /* ------------------------------------------------------------------ */

  async logStudySession(input: {
    topicId: ID | null;
    subjectId: ID | null;
    startedAt: number;
    endedAt: number;
    durationSec: number;
    source: StudySource;
    note?: string;
  }): Promise<StudySession> {
    const now = Date.now();
    const session: StudySession = {
      id: createId("sess"),
      topicId: input.topicId,
      subjectId: input.subjectId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationSec: Math.max(0, Math.round(input.durationSec)),
      source: input.source,
      note: input.note?.trim() || undefined,
      createdAt: now,
    };

    await this.db.transaction(
      "rw",
      [this.db.studySessions, this.db.topics, this.db.activityLogs, this.db.categories],
      async () => {
        await this.db.studySessions.add(session);
        let name = "全体";
        let subjectId = input.subjectId ?? undefined;
        if (input.topicId) {
          const topic = await this.db.topics.get(input.topicId);
          if (topic) {
            name = topic.name;
            subjectId = await this.subjectIdForTopic(topic);
            await this.db.topics.update(topic.id, {
              lastStudiedAt: Math.max(topic.lastStudiedAt ?? 0, session.endedAt),
              updatedAt: now,
            });
          }
        }
        await this.db.activityLogs.add(
          this.makeLog(
            "study_logged",
            `${name} を学習 (${Math.round(session.durationSec / 60)}分)`,
            {
              topicId: input.topicId ?? undefined,
              subjectId,
              meta: { durationSec: session.durationSec, source: session.source },
            },
          ),
        );
      },
    );
    return session;
  }

  async deleteStudySession(id: ID): Promise<void> {
    await this.db.studySessions.delete(id);
  }

  /* ------------------------------------------------------------------ */
  /* daily goal                                                        */
  /* ------------------------------------------------------------------ */

  async setDailyGoal(date: string, text: string, topicId?: ID): Promise<DailyGoal> {
    const now = Date.now();
    const existing = await this.db.dailyGoals.get(date);
    const goal: DailyGoal = {
      id: date,
      date,
      text: text.trim(),
      done: existing?.done ?? false,
      topicId: topicId ?? existing?.topicId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.db.dailyGoals.put(goal);
    return goal;
  }

  async setDailyGoalDone(date: string, done: boolean): Promise<void> {
    const now = Date.now();
    await this.db.transaction("rw", [this.db.dailyGoals, this.db.activityLogs], async () => {
      const existing = await this.db.dailyGoals.get(date);
      if (!existing) return;
      await this.db.dailyGoals.update(date, { done, updatedAt: now });
      if (done && !existing.done) {
        await this.db.activityLogs.add(
          this.makeLog("goal_completed", `今日の目標を達成: ${existing.text}`, {
            topicId: existing.topicId,
          }),
        );
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* reviews                                                           */
  /* ------------------------------------------------------------------ */

  async completeReview(reviewId: ID, outcome: ReviewOutcome): Promise<void> {
    const now = Date.now();
    // read settings outside the transaction — `settings` is not in its scope
    const settings = await this.getSettings();
    await this.db.transaction(
      "rw",
      [this.db.reviews, this.db.topics, this.db.activityLogs, this.db.categories, this.db.subjects],
      async () => {
        const review = await this.db.reviews.get(reviewId);
        if (!review || review.completedAt) return;
        const topic = await this.db.topics.get(review.topicId);
        if (!topic) {
          await this.db.reviews.delete(reviewId);
          return;
        }
        const plan = planAfterReview(review.stage, topic.status, outcome, {
          autoLowerOnFailed: settings.autoLowerStatusOnFailedReview,
          now,
        });

        await this.db.reviews.update(reviewId, {
          completedAt: now,
          outcome,
          statusLowered: plan.statusLowered,
        });

        const subjectId = await this.subjectIdForTopic(topic);

        if (plan.nextStatus !== topic.status) {
          await this.db.topics.update(topic.id, { status: plan.nextStatus, updatedAt: now });
          await this.db.activityLogs.add(
            this.makeLog(
              "status_change",
              `${topic.name} を「${labelFor(plan.nextStatus)}」に変更 (復習)`,
              { topicId: topic.id, subjectId, meta: { from: topic.status, to: plan.nextStatus } },
            ),
          );
        }

        if (plan.nextStage !== null && plan.nextDueAt !== null) {
          await this.db.reviews.add({
            id: createId("rev"),
            topicId: topic.id,
            stage: plan.nextStage,
            dueAt: plan.nextDueAt,
            createdAt: now,
          });
        }

        await this.db.activityLogs.add(
          this.makeLog("review_done", `${topic.name} の復習: ${outcomeLabel(outcome)}`, {
            topicId: topic.id,
            subjectId,
            meta: { outcome, stage: review.stage },
          }),
        );
      },
    );
  }

  async snoozeReview(reviewId: ID, days: number): Promise<void> {
    const review = await this.db.reviews.get(reviewId);
    if (!review || review.completedAt) return;
    await this.db.reviews.update(reviewId, {
      dueAt: review.dueAt + days * 24 * 60 * 60 * 1000,
    });
  }

  /* ------------------------------------------------------------------ */
  /* exam scores                                                       */
  /* ------------------------------------------------------------------ */

  async addExamScore(input: Omit<ExamScore, "id" | "createdAt">): Promise<ExamScore> {
    const now = Date.now();
    const score: ExamScore = { ...input, id: createId("exam"), createdAt: now };
    await this.db.transaction("rw", [this.db.examScores, this.db.activityLogs], async () => {
      await this.db.examScores.add(score);
      await this.db.activityLogs.add(
        this.makeLog(
          "exam_added",
          `過去問を記録: ${score.examName}${score.year} ${score.subject} ${score.score}/${score.maxScore}`,
          { meta: { score: score.score, maxScore: score.maxScore } },
        ),
      );
    });
    return score;
  }

  async deleteExamScore(id: ID): Promise<void> {
    await this.db.examScores.delete(id);
  }

  /* ------------------------------------------------------------------ */
  /* settings                                                          */
  /* ------------------------------------------------------------------ */

  async updateSettings(patch: Partial<Omit<Settings, "id" | "createdAt">>): Promise<void> {
    await this.getSettings();
    await this.db.settings.update("app", { ...patch, updatedAt: Date.now() });
  }

  async markOnboarded(): Promise<void> {
    await this.getSettings();
    await this.db.settings.update("app", { onboardedAt: Date.now(), updatedAt: Date.now() });
  }

  /* ------------------------------------------------------------------ */
  /* backup                                                            */
  /* ------------------------------------------------------------------ */

  async exportBackup(): Promise<BackupFile> {
    const [
      subjects,
      categories,
      topics,
      studySessions,
      reviews,
      dailyGoals,
      examScores,
      settings,
      activityLogs,
    ] = await Promise.all([
      this.db.subjects.toArray(),
      this.db.categories.toArray(),
      this.db.topics.toArray(),
      this.db.studySessions.toArray(),
      this.db.reviews.toArray(),
      this.db.dailyGoals.toArray(),
      this.db.examScores.toArray(),
      this.db.settings.toArray(),
      this.db.activityLogs.toArray(),
    ]);
    return {
      format: "henyu-dashboard-backup",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        subjects,
        categories,
        topics,
        studySessions,
        reviews,
        dailyGoals,
        examScores,
        settings,
        activityLogs,
      },
    };
  }

  async importBackup(file: BackupFile): Promise<void> {
    const d = file.data;
    await this.db.transaction(
      "rw",
      [
        this.db.subjects,
        this.db.categories,
        this.db.topics,
        this.db.studySessions,
        this.db.reviews,
        this.db.dailyGoals,
        this.db.examScores,
        this.db.settings,
        this.db.activityLogs,
      ],
      async () => {
        await Promise.all([
          this.db.subjects.clear(),
          this.db.categories.clear(),
          this.db.topics.clear(),
          this.db.studySessions.clear(),
          this.db.reviews.clear(),
          this.db.dailyGoals.clear(),
          this.db.examScores.clear(),
          this.db.settings.clear(),
          this.db.activityLogs.clear(),
        ]);
        await Promise.all([
          this.db.subjects.bulkAdd(d.subjects ?? []),
          this.db.categories.bulkAdd(d.categories ?? []),
          this.db.topics.bulkAdd(d.topics ?? []),
          this.db.studySessions.bulkAdd(d.studySessions ?? []),
          this.db.reviews.bulkAdd(d.reviews ?? []),
          this.db.dailyGoals.bulkAdd(d.dailyGoals ?? []),
          this.db.examScores.bulkAdd(d.examScores ?? []),
          this.db.activityLogs.bulkAdd(d.activityLogs ?? []),
        ]);
        const settingsRows = d.settings ?? [];
        const merged: Settings = {
          ...defaultSettings(Date.now()),
          ...(settingsRows[0] ?? {}),
          id: "app",
          schemaVersion: SCHEMA_VERSION,
          updatedAt: Date.now(),
        };
        await this.db.settings.put(merged);
      },
    );
  }

  async resetAll(): Promise<void> {
    await this.db.transaction(
      "rw",
      [
        this.db.subjects,
        this.db.categories,
        this.db.topics,
        this.db.studySessions,
        this.db.reviews,
        this.db.dailyGoals,
        this.db.examScores,
        this.db.settings,
        this.db.activityLogs,
      ],
      async () => {
        await Promise.all([
          this.db.subjects.clear(),
          this.db.categories.clear(),
          this.db.topics.clear(),
          this.db.studySessions.clear(),
          this.db.reviews.clear(),
          this.db.dailyGoals.clear(),
          this.db.examScores.clear(),
          this.db.settings.clear(),
          this.db.activityLogs.clear(),
        ]);
      },
    );
    await this.initialize();
  }

  /* ------------------------------------------------------------------ */
  /* internal helpers                                                  */
  /* ------------------------------------------------------------------ */

  private async subjectIdForTopic(topic: Topic): Promise<ID | undefined> {
    const category = await this.db.categories.get(topic.categoryId);
    return category?.subjectId;
  }

  private makeLog(
    type: ActivityType,
    message: string,
    extra: {
      topicId?: ID;
      subjectId?: ID;
      meta?: Record<string, string | number | boolean | null>;
    } = {},
  ): ActivityLog {
    return {
      id: createId("log"),
      type,
      at: Date.now(),
      message,
      topicId: extra.topicId,
      subjectId: extra.subjectId,
      meta: extra.meta,
    };
  }
}

function labelFor(status: Topic["status"]): string {
  return ["未学習", "学習中", "基本OK", "定着", "過去問レベル"][status] ?? String(status);
}

function outcomeLabel(outcome: ReviewOutcome): string {
  return outcome === "got" ? "できた" : outcome === "shaky" ? "怪しい" : "できなかった";
}

/** Default day key export kept here so callers don't import `date` just for this. */
export const today = () => dayKey();
