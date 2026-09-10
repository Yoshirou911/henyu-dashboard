import Dexie, { type EntityTable } from "dexie";
import { SCHEMA_VERSION } from "@/lib/constants";
import type {
  ActivityLog,
  Category,
  DailyGoal,
  ExamScore,
  Review,
  Settings,
  StudySession,
  Subject,
  Topic,
} from "@/lib/types";

export const DB_NAME = "henyu-dashboard";

/**
 * IndexedDB schema. Kept lightly indexed on purpose (spec §14 — don't
 * over-normalise). Bump `.version(n)` and add a migration when the shape
 * changes; `SCHEMA_VERSION` in settings tracks the logical version for backups.
 */
export class HenyuDB extends Dexie {
  subjects!: EntityTable<Subject, "id">;
  categories!: EntityTable<Category, "id">;
  topics!: EntityTable<Topic, "id">;
  studySessions!: EntityTable<StudySession, "id">;
  reviews!: EntityTable<Review, "id">;
  dailyGoals!: EntityTable<DailyGoal, "id">;
  examScores!: EntityTable<ExamScore, "id">;
  settings!: EntityTable<Settings, "id">;
  activityLogs!: EntityTable<ActivityLog, "id">;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      subjects: "id, slug, order",
      categories: "id, subjectId, order, track",
      topics: "id, categoryId, status, order, lastStudiedAt, basicOkAt",
      studySessions: "id, topicId, subjectId, startedAt",
      reviews: "id, topicId, dueAt, completedAt, stage",
      dailyGoals: "id, date",
      examScores: "id, examName, year, date",
      settings: "id",
      activityLogs: "id, type, at, topicId, subjectId",
    });
  }
}

let instance: HenyuDB | null = null;

/** Lazy singleton so the DB is only constructed in environments that use it. */
export function getDb(): HenyuDB {
  if (!instance) instance = new HenyuDB();
  return instance;
}

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;
