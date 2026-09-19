import {
  DEFAULT_AVAILABLE_MINUTES,
  DEFAULT_DAILY_GOAL_MIN,
  DEFAULT_EXAM_DATE,
  DEFAULT_EXAM_NAME,
  DEFAULT_WEEKLY_GOAL_MIN,
  SCHEMA_VERSION,
} from "@/lib/constants";
import { DAY_MS, dayKey, startOfDay } from "@/lib/date";
import type {
  DataRepository,
  ExerciseInput,
  RecordStudyInput,
  SubjectPatch,
  TopicPatch,
  UniversityInput,
} from "@/lib/db/repository";
import { getDb, type HenyuDB } from "@/lib/db/schema";
import {
  DEFAULT_ALLOCATION_BY_SLUG,
  SUBJECT_TEMPLATES,
  UNIVERSITY_TEMPLATES,
  buildSubjectSeed,
  buildUniversitySeed,
  resolveDependencies,
} from "@/lib/db/seed";
import type { StudySnapshot } from "@/lib/model/snapshot";
import { firstReviewDueAt, planAfterReview } from "@/lib/review-schedule";
import type {
  ActivityLog,
  ActivityType,
  BackupFile,
  Category,
  DailyGoal,
  ExerciseResult,
  ID,
  Milestone,
  MockExam,
  MonthlyGoal,
  PastExam,
  PastExamProblem,
  Review,
  ReviewOutcome,
  Settings,
  StudySession,
  StudySource,
  Subject,
  Topic,
  University,
  UniversityRequirement,
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
    defaultAvailableMinutes: DEFAULT_AVAILABLE_MINUTES,
    createdAt: now,
    updatedAt: now,
  };
}

const clampInt = (n: number, min: number) => Math.max(min, Math.round(Number.isFinite(n) ? n : 0));

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
  /* lifecycle + migration                                              */
  /* ------------------------------------------------------------------ */

  async initialize(): Promise<{ seeded: boolean; migrated: boolean }> {
    const now = Date.now();
    let settings = await this.db.settings.get("app");
    const [topicCount, subjectCount] = await Promise.all([
      this.db.topics.count(),
      this.db.subjects.count(),
    ]);

    if (topicCount === 0 && subjectCount === 0) {
      if (!settings) {
        settings = defaultSettings(now);
        await this.db.settings.put(settings);
      }
      await this.db.transaction("rw", this.db.allTables(), async () => {
        await this.runMigrationSteps(now);
        await this.db.settings.update("app", { schemaVersion: SCHEMA_VERSION, updatedAt: now });
        await this.db.activityLogs.add(
          this.makeLog("seed", "受験科目のロードマップと志望校を作成しました"),
        );
      });
      return { seeded: true, migrated: false };
    }

    if (!settings) {
      // Data exists but settings row is missing — treat as v1.
      settings = { ...defaultSettings(now), schemaVersion: 1 };
      await this.db.settings.put(settings);
    }

    if ((settings.schemaVersion ?? 1) < SCHEMA_VERSION) {
      await this.db.transaction("rw", this.db.allTables(), async () => {
        await this.runMigrationSteps(now);
        await this.db.settings.update("app", { schemaVersion: SCHEMA_VERSION, updatedAt: now });
      });
      return { seeded: false, migrated: true };
    }
    return { seeded: false, migrated: false };
  }

  /**
   * v1 → v2 (and fresh install). Every step only *adds* or fills missing
   * fields, so it is safe to run repeatedly and never touches existing
   * statuses, sessions or goals. Must run inside an all-tables transaction.
   */
  private async runMigrationSteps(now: number): Promise<void> {
    await this.seedMissingSubjects(now);
    await this.fillMissingDependencies();
    await this.seedUniversitiesIfEmpty(now);
    await this.fillAllocation();
    await this.migrateExamScores(now);

    const settings = await this.db.settings.get("app");
    const math = await this.db.subjects.where("slug").equals("math").first();
    const patch: Partial<Settings> = {};
    if (settings && !settings.primarySubjectId) {
      patch.primarySubjectId = math?.id ?? (await this.db.subjects.orderBy("order").first())?.id;
    }
    if (settings && !settings.defaultAvailableMinutes) {
      patch.defaultAvailableMinutes = DEFAULT_AVAILABLE_MINUTES;
    }
    if (Object.keys(patch).length > 0) await this.db.settings.update("app", patch);
  }

  private async seedMissingSubjects(now: number): Promise<string[]> {
    const subjects = await this.db.subjects.toArray();
    const bySlug = new Map(subjects.map((s) => [s.slug, s]));
    let nextOrder = subjects.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const added: string[] = [];

    for (const template of SUBJECT_TEMPLATES) {
      const existing = bySlug.get(template.slug);
      if (existing) {
        if (!existing.evaluationType) {
          await this.db.subjects.update(existing.id, { evaluationType: template.evaluationType });
        }
        continue;
      }
      const seed = buildSubjectSeed(template, nextOrder++, now);
      if (await this.db.subjects.get(seed.subject.id)) continue; // id taken by a renamed slug
      await this.db.subjects.put(seed.subject);
      await this.db.categories.bulkPut(seed.categories);
      await this.db.topics.bulkPut(seed.topics);
      added.push(seed.subject.name);
    }

    // Phase 1 subjects created by the user (not in templates) default to "problem".
    for (const s of subjects) {
      if (!s.evaluationType && !SUBJECT_TEMPLATES.some((t) => t.slug === s.slug)) {
        await this.db.subjects.update(s.id, { evaluationType: "problem" });
      }
    }

    if (added.length > 0) {
      // universities that already exist get requirement rows for re-added subjects
      const all = await this.db.subjects.toArray();
      const idBySlug = new Map(all.map((s) => [s.slug, s.id]));
      for (const t of UNIVERSITY_TEMPLATES) {
        const univId = `univ_${t.key}`;
        if (!(await this.db.universities.get(univId))) continue;
        for (const r of t.requirements) {
          const reqId = `req_${t.key}_${r.slug}`;
          const subjectId = idBySlug.get(r.slug);
          if (!subjectId || (await this.db.universityRequirements.get(reqId))) continue;
          await this.db.universityRequirements.put({
            id: reqId,
            universityId: univId,
            subjectId,
            required: r.required,
            importance: r.importance,
            weight: r.weight,
          });
        }
      }
    }
    return added;
  }

  private async fillMissingDependencies(): Promise<void> {
    const [subjects, categories, topics] = await Promise.all([
      this.db.subjects.toArray(),
      this.db.categories.toArray(),
      this.db.topics.toArray(),
    ]);
    const deps = resolveDependencies(
      topics,
      new Map(categories.map((c) => [c.id, c.subjectId])),
      new Map(subjects.map((s) => [s.id, s.slug])),
    );
    for (const [topicId, dependsOn] of deps) {
      const topic = topics.find((t) => t.id === topicId);
      if (topic && topic.dependsOn === undefined) {
        await this.db.topics.update(topicId, { dependsOn });
      }
    }
  }

  private async seedUniversitiesIfEmpty(now: number): Promise<void> {
    if ((await this.db.universities.count()) > 0) return;
    const [subjects, settings] = await Promise.all([
      this.db.subjects.toArray(),
      this.db.settings.get("app"),
    ]);
    const { universities, requirements } = buildUniversitySeed(
      new Map(subjects.map((s) => [s.slug, s.id])),
      settings?.examDate ?? DEFAULT_EXAM_DATE,
      now,
    );
    await this.db.universities.bulkPut(universities);
    await this.db.universityRequirements.bulkPut(requirements);
    const first = universities.find((u) => u.priority === "first_choice");
    if (settings && !settings.primaryUniversityId && first) {
      await this.db.settings.update("app", { primaryUniversityId: first.id });
    }
  }

  private async fillAllocation(): Promise<void> {
    const settings = await this.db.settings.get("app");
    if (!settings) return;
    const subjects = await this.db.subjects.toArray();
    const current = { ...(settings.subjectAllocation ?? {}) };
    let changed = false;
    for (const s of subjects) {
      if (current[s.id] === undefined) {
        current[s.id] = DEFAULT_ALLOCATION_BY_SLUG[s.slug] ?? 0;
        changed = true;
      }
    }
    if (changed) await this.db.settings.update("app", { subjectAllocation: current });
  }

  /** Phase 1 `examScores` → Phase 2 `pastExams` (originals are kept untouched). */
  private async migrateExamScores(now: number): Promise<void> {
    const [scores, universities, subjects] = await Promise.all([
      this.db.examScores.toArray(),
      this.db.universities.toArray(),
      this.db.subjects.toArray(),
    ]);
    for (const s of scores) {
      const id = `past_from_${s.id}`;
      if (await this.db.pastExams.get(id)) continue;
      const univ =
        universities.find((u) => s.examName.includes(u.name)) ??
        (s.examName.includes("電通") ? universities.find((u) => u.id === "univ_uec") : undefined);
      const subject = subjects.find((sub) => s.subject.includes(sub.name));
      await this.db.pastExams.put({
        id,
        universityId: univ?.id ?? null,
        examLabel: s.examName,
        year: s.year,
        subject: s.subject,
        subjectId: subject?.id,
        score: s.score,
        maxScore: s.maxScore,
        durationMin: s.durationMin,
        date: s.date,
        memo: s.note,
        createdAt: s.createdAt ?? now,
      });
    }
  }

  async ensureExamTemplate(): Promise<{ addedSubjects: string[] }> {
    const now = Date.now();
    let added: string[] = [];
    await this.db.transaction("rw", this.db.allTables(), async () => {
      added = await this.seedMissingSubjects(now);
      await this.fillMissingDependencies();
      await this.seedUniversitiesIfEmpty(now);
      await this.fillAllocation();
      if (added.length > 0) {
        await this.db.activityLogs.add(this.makeLog("seed", `受験科目を追加: ${added.join("・")}`));
      }
    });
    return { addedSubjects: added };
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

  async getSnapshot(): Promise<StudySnapshot> {
    const since = dayKey(new Date(Date.now() - 60 * DAY_MS));
    const [
      settings,
      subjects,
      categories,
      topics,
      sessions,
      reviews,
      exerciseResults,
      universities,
      requirements,
      monthlyGoals,
      milestones,
      mockExams,
      pastExams,
      pastExamProblems,
      dailyGoals,
      statusLogs,
    ] = await Promise.all([
      this.getSettings(),
      this.db.subjects.orderBy("order").toArray(),
      this.db.categories.orderBy("order").toArray(),
      this.db.topics.orderBy("order").toArray(),
      this.db.studySessions.orderBy("startedAt").toArray(),
      this.db.reviews.orderBy("dueAt").toArray(),
      this.db.exerciseResults.orderBy("at").toArray(),
      this.db.universities.orderBy("order").toArray(),
      this.db.universityRequirements.toArray(),
      this.db.monthlyGoals.toArray(),
      this.db.milestones.orderBy("date").toArray(),
      this.db.mockExams.orderBy("examDate").toArray(),
      this.db.pastExams.toArray(),
      this.db.pastExamProblems.toArray(),
      this.db.dailyGoals.where("date").aboveOrEqual(since).toArray(),
      this.db.activityLogs.where("type").equals("status_change").toArray(),
    ]);
    return {
      settings,
      subjects,
      categories,
      topics,
      sessions,
      reviews,
      exerciseResults,
      universities,
      requirements,
      monthlyGoals,
      milestones,
      mockExams,
      pastExams,
      pastExamProblems,
      dailyGoals,
      statusLogs,
    };
  }

  async getSettings(): Promise<Settings> {
    const settings = await this.db.settings.get("app");
    if (settings) return settings;
    return defaultSettings(Date.now());
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

  async listActivity(limit = 40): Promise<ActivityLog[]> {
    return this.db.activityLogs.orderBy("at").reverse().limit(limit).toArray();
  }

  listExerciseResults(topicId?: ID): Promise<ExerciseResult[]> {
    if (topicId) return this.db.exerciseResults.where("topicId").equals(topicId).sortBy("at");
    return this.db.exerciseResults.orderBy("at").toArray();
  }

  /* ------------------------------------------------------------------ */
  /* topic mutations                                                   */
  /* ------------------------------------------------------------------ */

  async setTopicStatus(topicId: ID, status: Topic["status"]): Promise<void> {
    const now = Date.now();
    await this.db.transaction(
      "rw",
      [this.db.topics, this.db.reviews, this.db.activityLogs, this.db.categories, this.db.subjects],
      () => this.applyStatus(topicId, status, now),
    );
  }

  /** Status change + review bookkeeping; caller provides the transaction. */
  private async applyStatus(topicId: ID, status: Topic["status"], now: number, suffix = "") {
    const topic = await this.db.topics.get(topicId);
    if (!topic || topic.status === status) return;
    const prev = topic.status;

    const patch: Partial<Topic> = { status, updatedAt: now };
    if (status > prev) patch.lastStatusUpAt = now;
    if (status >= 2 && !topic.basicOkAt) patch.basicOkAt = now;
    await this.db.topics.update(topicId, patch);

    const openReviews = (await this.db.reviews.where("topicId").equals(topicId).toArray()).filter(
      (r) => !r.completedAt,
    );
    if (status >= 2 && prev < 2 && openReviews.length === 0) {
      await this.db.reviews.add({
        id: createId("rev"),
        topicId,
        stage: 0,
        dueAt: firstReviewDueAt(topic.basicOkAt ?? now),
        createdAt: now,
      });
    } else if (status < 2 && openReviews.length > 0) {
      await this.db.reviews.bulkDelete(openReviews.map((r) => r.id));
    }

    const subjectId = await this.subjectIdForTopic(topic);
    await this.db.activityLogs.add(
      this.makeLog("status_change", `${topic.name} を「${labelFor(status)}」に変更${suffix}`, {
        topicId,
        subjectId,
        meta: { from: prev, to: status },
      }),
    );
  }

  async updateTopic(topicId: ID, patch: TopicPatch): Promise<void> {
    const clean: Partial<Topic> = { ...patch, updatedAt: Date.now() };
    if (clean.weight !== undefined && (!Number.isFinite(clean.weight) || clean.weight <= 0)) {
      clean.weight = 1;
    }
    if (clean.dependsOn) clean.dependsOn = clean.dependsOn.filter((id) => id !== topicId);
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
      [this.db.topics, this.db.reviews, this.db.studySessions, this.db.exerciseResults],
      () => this.deleteTopicsInTx([topicId]),
    );
  }

  private async deleteTopicsInTx(topicIds: ID[]) {
    if (topicIds.length === 0) return;
    const set = new Set(topicIds);
    await this.db.topics.bulkDelete(topicIds);
    await this.db.reviews.where("topicId").anyOf(topicIds).delete();
    await this.db.exerciseResults.where("topicId").anyOf(topicIds).delete();
    // sessions stay for time analytics, detached from the topic
    await this.db.studySessions.where("topicId").anyOf(topicIds).modify({ topicId: null });
    // drop dangling prerequisite edges
    await this.db.topics
      .filter((t) => (t.dependsOn ?? []).some((d) => set.has(d)))
      .modify((t) => {
        t.dependsOn = (t.dependsOn ?? []).filter((d) => !set.has(d));
      });
  }

  async reorderTopics(_categoryId: ID, orderedIds: ID[]): Promise<void> {
    const now = Date.now();
    await this.db.transaction("rw", this.db.topics, async () => {
      await Promise.all(
        orderedIds.map((id, index) => this.db.topics.update(id, { order: index, updatedAt: now })),
      );
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
      [
        this.db.categories,
        this.db.topics,
        this.db.reviews,
        this.db.studySessions,
        this.db.exerciseResults,
      ],
      async () => {
        const topicIds = (await this.db.topics
          .where("categoryId")
          .equals(categoryId)
          .primaryKeys()) as ID[];
        await this.deleteTopicsInTx(topicIds);
        await this.db.categories.delete(categoryId);
      },
    );
  }

  async reorderCategories(_subjectId: ID, orderedIds: ID[]): Promise<void> {
    const now = Date.now();
    await this.db.transaction("rw", this.db.categories, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          this.db.categories.update(id, { order: index, updatedAt: now }),
        ),
      );
    });
  }

  async addSubject(
    name: string,
    slug: string,
    evaluationType: Subject["evaluationType"] = "problem",
  ): Promise<Subject> {
    const now = Date.now();
    const count = await this.db.subjects.count();
    const subject: Subject = {
      id: createId("subj"),
      slug: slug.trim() || createId("s"),
      name: name.trim() || "新しい科目",
      evaluationType,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.transaction("rw", [this.db.subjects, this.db.settings], async () => {
      await this.db.subjects.add(subject);
      const settings = await this.db.settings.get("app");
      if (settings) {
        await this.db.settings.update("app", {
          subjectAllocation: { ...(settings.subjectAllocation ?? {}), [subject.id]: 0 },
        });
      }
    });
    return subject;
  }

  async updateSubject(subjectId: ID, patch: SubjectPatch): Promise<void> {
    await this.db.subjects.update(subjectId, { ...patch, updatedAt: Date.now() });
  }

  async reorderSubjects(orderedIds: ID[]): Promise<void> {
    const now = Date.now();
    await this.db.transaction("rw", this.db.subjects, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          this.db.subjects.update(id, { order: index, updatedAt: now }),
        ),
      );
    });
  }

  async deleteSubject(subjectId: ID): Promise<void> {
    await this.db.transaction("rw", this.db.allTables(), async () => {
      const catIds = (await this.db.categories
        .where("subjectId")
        .equals(subjectId)
        .primaryKeys()) as ID[];
      const topicIds = (await this.db.topics
        .where("categoryId")
        .anyOf(catIds)
        .primaryKeys()) as ID[];
      await this.deleteTopicsInTx(topicIds);
      await this.db.categories.bulkDelete(catIds);
      await this.db.universityRequirements.where("subjectId").equals(subjectId).delete();
      await this.db.monthlyGoals.where("subjectId").equals(subjectId).delete();
      await this.db.subjects.delete(subjectId);
      const settings = await this.db.settings.get("app");
      if (settings?.subjectAllocation) {
        const next = { ...settings.subjectAllocation };
        delete next[subjectId];
        await this.db.settings.update("app", { subjectAllocation: next });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* study time + exercise results                                     */
  /* ------------------------------------------------------------------ */

  async logStudySession(input: {
    topicId: ID | null;
    subjectId: ID | null;
    startedAt: number;
    endedAt: number;
    durationSec: number;
    source: StudySource;
    note?: string;
    plannedMinutes?: number;
  }): Promise<StudySession> {
    let session: StudySession | undefined;
    await this.db.transaction(
      "rw",
      [this.db.studySessions, this.db.topics, this.db.activityLogs, this.db.categories],
      async () => {
        session = await this.addSessionInTx(input, Date.now());
      },
    );
    return session as StudySession;
  }

  private async addSessionInTx(
    input: {
      topicId: ID | null;
      subjectId: ID | null;
      startedAt: number;
      endedAt: number;
      durationSec: number;
      source: StudySource;
      note?: string;
      plannedMinutes?: number;
    },
    now: number,
  ): Promise<StudySession> {
    let subjectId = input.subjectId ?? null;
    let name = "全体";
    if (input.topicId) {
      const topic = await this.db.topics.get(input.topicId);
      if (topic) {
        name = topic.name;
        subjectId = (await this.subjectIdForTopic(topic)) ?? subjectId;
        await this.db.topics.update(topic.id, {
          lastStudiedAt: Math.max(topic.lastStudiedAt ?? 0, input.endedAt),
          updatedAt: now,
        });
      }
    }
    const session: StudySession = {
      id: createId("sess"),
      topicId: input.topicId,
      subjectId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationSec: clampInt(input.durationSec, 0),
      source: input.source,
      note: input.note?.trim() || undefined,
      plannedMinutes: input.plannedMinutes,
      createdAt: now,
    };
    await this.db.studySessions.add(session);
    await this.db.activityLogs.add(
      this.makeLog("study_logged", `${name} を学習 (${Math.round(session.durationSec / 60)}分)`, {
        topicId: input.topicId ?? undefined,
        subjectId: subjectId ?? undefined,
        meta: { durationSec: session.durationSec, source: session.source },
      }),
    );
    return session;
  }

  async deleteStudySession(id: ID): Promise<void> {
    await this.db.studySessions.delete(id);
  }

  async addExerciseResult(input: ExerciseInput): Promise<ExerciseResult> {
    let result: ExerciseResult | undefined;
    await this.db.transaction(
      "rw",
      [
        this.db.exerciseResults,
        this.db.topics,
        this.db.reviews,
        this.db.activityLogs,
        this.db.categories,
        this.db.subjects,
      ],
      async () => {
        result = await this.addExerciseInTx(input, Date.now());
      },
    );
    return result as ExerciseResult;
  }

  private async addExerciseInTx(
    input: ExerciseInput & { sessionId?: ID },
    now: number,
  ): Promise<ExerciseResult> {
    const attempted = clampInt(input.attemptedCount, 0);
    const correct = Math.min(attempted, clampInt(input.correctCount, 0));
    const at = input.at ?? now;
    const result: ExerciseResult = {
      id: createId("ex"),
      topicId: input.topicId,
      date: dayKey(new Date(at)),
      at,
      attemptedCount: attempted,
      correctCount: correct,
      difficulty: input.difficulty,
      type: input.type,
      memo: input.memo?.trim() || undefined,
      sessionId: input.sessionId,
      createdAt: now,
    };
    await this.db.exerciseResults.add(result);

    const topic = await this.db.topics.get(input.topicId);
    if (topic) {
      await this.db.topics.update(topic.id, {
        lastStudiedAt: Math.max(topic.lastStudiedAt ?? 0, at),
        updatedAt: now,
      });
      // Solving problems on an untouched topic means it's being studied —
      // saves the user a separate status tap.
      if (topic.status === 0 && attempted > 0) await this.applyStatus(topic.id, 1, now);
      await this.db.activityLogs.add(
        this.makeLog("exercise_logged", `${topic.name}: ${attempted}問中${correct}問正解`, {
          topicId: topic.id,
          subjectId: await this.subjectIdForTopic(topic),
          meta: { attempted, correct, difficulty: input.difficulty, type: input.type },
        }),
      );
    }
    return result;
  }

  async deleteExerciseResult(id: ID): Promise<void> {
    await this.db.exerciseResults.delete(id);
  }

  async recordStudy(input: RecordStudyInput): Promise<void> {
    const now = Date.now();
    await this.db.transaction(
      "rw",
      [
        this.db.studySessions,
        this.db.exerciseResults,
        this.db.topics,
        this.db.reviews,
        this.db.activityLogs,
        this.db.categories,
        this.db.subjects,
      ],
      async () => {
        let sessionId: ID | undefined;
        const minutes = Math.max(0, input.minutes);
        if (minutes > 0) {
          const endedAt = input.endedAt ?? now;
          const session = await this.addSessionInTx(
            {
              topicId: input.topicId,
              subjectId: input.subjectId,
              startedAt: input.startedAt ?? endedAt - minutes * 60_000,
              endedAt,
              durationSec: minutes * 60,
              source: input.source,
              note: input.note,
              plannedMinutes: input.plannedMinutes,
            },
            now,
          );
          sessionId = session.id;
        }
        if (input.topicId && input.exercise && input.exercise.attemptedCount > 0) {
          await this.addExerciseInTx({ ...input.exercise, topicId: input.topicId, sessionId }, now);
        }
      },
    );
  }

  /* ------------------------------------------------------------------ */
  /* daily goal / plan                                                 */
  /* ------------------------------------------------------------------ */

  async setDailyGoal(date: string, text: string, topicId?: ID): Promise<DailyGoal> {
    const now = Date.now();
    const existing = await this.db.dailyGoals.get(date);
    const goal: DailyGoal = {
      ...existing,
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

  async setAvailableMinutes(date: string, minutes: number): Promise<void> {
    const now = Date.now();
    const existing = await this.db.dailyGoals.get(date);
    const value = clampInt(minutes, 0);
    if (existing) {
      await this.db.dailyGoals.update(date, { availableMinutes: value, updatedAt: now });
    } else {
      await this.db.dailyGoals.put({
        id: date,
        date,
        text: "",
        done: false,
        availableMinutes: value,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* reviews                                                           */
  /* ------------------------------------------------------------------ */

  async completeReview(
    reviewId: ID,
    outcome: ReviewOutcome,
    exercise?: { attemptedCount: number; correctCount: number },
  ): Promise<void> {
    const now = Date.now();
    // read settings outside the transaction — `settings` is not in its scope
    const settings = await this.getSettings();
    await this.db.transaction(
      "rw",
      [
        this.db.reviews,
        this.db.topics,
        this.db.activityLogs,
        this.db.categories,
        this.db.subjects,
        this.db.exerciseResults,
      ],
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

        if (exercise && exercise.attemptedCount > 0) {
          await this.addExerciseInTx(
            {
              topicId: topic.id,
              attemptedCount: exercise.attemptedCount,
              correctCount: exercise.correctCount,
              difficulty: "basic",
              type: "review",
              at: now,
            },
            now,
          );
        } else {
          await this.db.topics.update(topic.id, {
            lastStudiedAt: Math.max(topic.lastStudiedAt ?? 0, now),
          });
        }

        if (plan.nextStatus !== topic.status) {
          await this.applyStatus(topic.id, plan.nextStatus, now, " (復習)");
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
            subjectId: await this.subjectIdForTopic(topic),
            meta: { outcome, stage: review.stage },
          }),
        );
      },
    );
  }

  async snoozeReview(reviewId: ID, days: number): Promise<void> {
    const review = await this.db.reviews.get(reviewId);
    if (!review || review.completedAt) return;
    const base = Math.max(review.dueAt, startOfDay());
    await this.db.reviews.update(reviewId, { dueAt: base + days * DAY_MS });
  }

  /* ------------------------------------------------------------------ */
  /* universities                                                      */
  /* ------------------------------------------------------------------ */

  async addUniversity(input: UniversityInput): Promise<University> {
    const now = Date.now();
    const count = await this.db.universities.count();
    const univ: University = {
      ...input,
      id: createId("univ"),
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.universities.add(univ);
    return univ;
  }

  async updateUniversity(id: ID, patch: Partial<UniversityInput>): Promise<void> {
    await this.db.transaction("rw", [this.db.universities, this.db.settings], async () => {
      await this.db.universities.update(id, { ...patch, updatedAt: Date.now() });
      // keep the legacy countdown date in step with the 第一志望
      const settings = await this.db.settings.get("app");
      if (patch.examDate && settings?.primaryUniversityId === id) {
        await this.db.settings.update("app", { examDate: patch.examDate, updatedAt: Date.now() });
      }
    });
  }

  async deleteUniversity(id: ID): Promise<void> {
    await this.db.transaction(
      "rw",
      [this.db.universities, this.db.universityRequirements, this.db.pastExams, this.db.settings],
      async () => {
        await this.db.universityRequirements.where("universityId").equals(id).delete();
        await this.db.pastExams.where("universityId").equals(id).modify({ universityId: null });
        await this.db.universities.delete(id);
        const settings = await this.db.settings.get("app");
        if (settings?.primaryUniversityId === id) {
          await this.db.settings.update("app", { primaryUniversityId: null });
        }
      },
    );
  }

  async upsertRequirement(req: Omit<UniversityRequirement, "id"> & { id?: ID }): Promise<void> {
    const id =
      req.id ??
      (
        await this.db.universityRequirements
          .where("universityId")
          .equals(req.universityId)
          .filter((r) => r.subjectId === req.subjectId)
          .first()
      )?.id ??
      createId("req");
    await this.db.universityRequirements.put({
      ...req,
      id,
      importance: Math.min(5, Math.max(1, Math.round(req.importance))),
      weight: Math.max(0, req.weight),
    });
  }

  async deleteRequirement(id: ID): Promise<void> {
    await this.db.universityRequirements.delete(id);
  }

  /* ------------------------------------------------------------------ */
  /* goals                                                             */
  /* ------------------------------------------------------------------ */

  async addMonthlyGoal(
    input: Omit<MonthlyGoal, "id" | "createdAt" | "updatedAt">,
  ): Promise<MonthlyGoal> {
    const now = Date.now();
    const goal: MonthlyGoal = { ...input, id: createId("mg"), createdAt: now, updatedAt: now };
    await this.db.monthlyGoals.add(goal);
    return goal;
  }

  async updateMonthlyGoal(
    id: ID,
    patch: Partial<Omit<MonthlyGoal, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    await this.db.monthlyGoals.update(id, { ...patch, updatedAt: Date.now() });
  }

  async deleteMonthlyGoal(id: ID): Promise<void> {
    await this.db.monthlyGoals.delete(id);
  }

  async addMilestone(input: Omit<Milestone, "id" | "createdAt" | "updatedAt">): Promise<Milestone> {
    const now = Date.now();
    const m: Milestone = { ...input, id: createId("ms"), createdAt: now, updatedAt: now };
    await this.db.milestones.add(m);
    return m;
  }

  async updateMilestone(
    id: ID,
    patch: Partial<Omit<Milestone, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    await this.db.milestones.update(id, { ...patch, updatedAt: Date.now() });
  }

  async deleteMilestone(id: ID): Promise<void> {
    await this.db.milestones.delete(id);
  }

  /* ------------------------------------------------------------------ */
  /* exams                                                             */
  /* ------------------------------------------------------------------ */

  async addMockExam(input: Omit<MockExam, "id" | "createdAt">): Promise<MockExam> {
    const now = Date.now();
    const exam: MockExam = { ...input, id: createId("mock"), createdAt: now };
    await this.db.transaction("rw", [this.db.mockExams, this.db.activityLogs], async () => {
      await this.db.mockExams.add(exam);
      await this.db.activityLogs.add(
        this.makeLog(
          "mock_added",
          `模試を記録: ${exam.examName} ${exam.subject} ${exam.score}/${exam.maxScore}`,
          { subjectId: exam.subjectId },
        ),
      );
    });
    return exam;
  }

  async deleteMockExam(id: ID): Promise<void> {
    await this.db.mockExams.delete(id);
  }

  async addPastExam(
    exam: Omit<PastExam, "id" | "createdAt">,
    problems: Omit<PastExamProblem, "id" | "pastExamId">[],
  ): Promise<PastExam> {
    const now = Date.now();
    const row: PastExam = { ...exam, id: createId("past"), createdAt: now };
    await this.db.transaction(
      "rw",
      [this.db.pastExams, this.db.pastExamProblems, this.db.activityLogs, this.db.universities],
      async () => {
        await this.db.pastExams.add(row);
        await this.db.pastExamProblems.bulkAdd(
          problems.map((p) => ({ ...p, id: createId("pp"), pastExamId: row.id })),
        );
        const univ = row.universityId ? await this.db.universities.get(row.universityId) : null;
        await this.db.activityLogs.add(
          this.makeLog(
            "exam_added",
            `過去問を記録: ${univ?.name ?? row.examLabel ?? ""} ${row.year} ${row.subject} ${row.score}/${row.maxScore}`,
            { subjectId: row.subjectId, meta: { score: row.score, maxScore: row.maxScore } },
          ),
        );
      },
    );
    return row;
  }

  async deletePastExam(id: ID): Promise<void> {
    await this.db.transaction("rw", [this.db.pastExams, this.db.pastExamProblems], async () => {
      await this.db.pastExamProblems.where("pastExamId").equals(id).delete();
      await this.db.pastExams.delete(id);
    });
  }

  /* ------------------------------------------------------------------ */
  /* settings                                                          */
  /* ------------------------------------------------------------------ */

  async updateSettings(patch: Partial<Omit<Settings, "id" | "createdAt">>): Promise<void> {
    const existing = await this.db.settings.get("app");
    if (!existing) await this.db.settings.put(defaultSettings(Date.now()));
    await this.db.settings.update("app", { ...patch, updatedAt: Date.now() });
  }

  async markOnboarded(): Promise<void> {
    await this.updateSettings({ onboardedAt: Date.now() });
  }

  /* ------------------------------------------------------------------ */
  /* backup                                                            */
  /* ------------------------------------------------------------------ */

  async exportBackup(): Promise<BackupFile> {
    const d = this.db;
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
      universities,
      universityRequirements,
      exerciseResults,
      monthlyGoals,
      milestones,
      mockExams,
      pastExams,
      pastExamProblems,
    ] = await Promise.all([
      d.subjects.toArray(),
      d.categories.toArray(),
      d.topics.toArray(),
      d.studySessions.toArray(),
      d.reviews.toArray(),
      d.dailyGoals.toArray(),
      d.examScores.toArray(),
      d.settings.toArray(),
      d.activityLogs.toArray(),
      d.universities.toArray(),
      d.universityRequirements.toArray(),
      d.exerciseResults.toArray(),
      d.monthlyGoals.toArray(),
      d.milestones.toArray(),
      d.mockExams.toArray(),
      d.pastExams.toArray(),
      d.pastExamProblems.toArray(),
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
        universities,
        universityRequirements,
        exerciseResults,
        monthlyGoals,
        milestones,
        mockExams,
        pastExams,
        pastExamProblems,
      },
    };
  }

  async importBackup(file: BackupFile): Promise<void> {
    const d = file.data;
    const fileVersion = typeof file.schemaVersion === "number" ? file.schemaVersion : 1;
    // A newer app's backup may hold tables/fields this version would silently
    // drop. Refuse before touching anything so current data stays intact.
    if (fileVersion > SCHEMA_VERSION) {
      throw new Error(
        `このバックアップは新しいバージョン（v${fileVersion}）のアプリで作成されています。アプリを更新してから取り込んでください。`,
      );
    }
    await this.db.transaction("rw", this.db.allTables(), async () => {
      await Promise.all(this.db.allTables().map((t) => t.clear()));
      await Promise.all([
        this.db.subjects.bulkAdd(d.subjects ?? []),
        this.db.categories.bulkAdd(d.categories ?? []),
        this.db.topics.bulkAdd(d.topics ?? []),
        this.db.studySessions.bulkAdd(d.studySessions ?? []),
        this.db.reviews.bulkAdd(d.reviews ?? []),
        this.db.dailyGoals.bulkAdd(d.dailyGoals ?? []),
        this.db.examScores.bulkAdd(d.examScores ?? []),
        this.db.activityLogs.bulkAdd(d.activityLogs ?? []),
        this.db.universities.bulkAdd(d.universities ?? []),
        this.db.universityRequirements.bulkAdd(d.universityRequirements ?? []),
        this.db.exerciseResults.bulkAdd(d.exerciseResults ?? []),
        this.db.monthlyGoals.bulkAdd(d.monthlyGoals ?? []),
        this.db.milestones.bulkAdd(d.milestones ?? []),
        this.db.mockExams.bulkAdd(d.mockExams ?? []),
        this.db.pastExams.bulkAdd(d.pastExams ?? []),
        this.db.pastExamProblems.bulkAdd(d.pastExamProblems ?? []),
      ]);
      const settingsRows = d.settings ?? [];
      const merged: Settings = {
        ...defaultSettings(Date.now()),
        ...(settingsRows[0] ?? {}),
        id: "app",
        // keep the file's version so initialize() migrates older backups
        schemaVersion: Math.min(fileVersion, SCHEMA_VERSION),
        updatedAt: Date.now(),
      };
      await this.db.settings.put(merged);
    });
    await this.initialize();
  }

  async resetAll(): Promise<void> {
    await this.db.transaction("rw", this.db.allTables(), async () => {
      await Promise.all(this.db.allTables().map((t) => t.clear()));
    });
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
