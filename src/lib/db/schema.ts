import Dexie, { type EntityTable } from "dexie";
import { SCHEMA_VERSION } from "@/lib/constants";
import type {
  ActivityLog,
  Category,
  DailyGoal,
  ExamScore,
  ExerciseResult,
  Milestone,
  MockExam,
  MonthlyGoal,
  PastExam,
  PastExamProblem,
  Review,
  Settings,
  StudySession,
  Subject,
  Topic,
  University,
  UniversityRequirement,
} from "@/lib/types";

export const DB_NAME = "henyu-dashboard";

/**
 * IndexedDB schema. Lightly indexed on purpose.
 *
 * - version(1): Phase 1 tables (unchanged, so existing data opens as-is)
 * - version(2): Phase 2 tables. Only *new stores* are declared here; the data
 *   migration (seeding extra subjects, moving examScores → pastExams, …) is
 *   idempotent and runs in `DexieRepository.initialize()` based on
 *   `settings.schemaVersion`, which keeps it testable and re-runnable after an
 *   import of an old backup.
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
  universities!: EntityTable<University, "id">;
  universityRequirements!: EntityTable<UniversityRequirement, "id">;
  exerciseResults!: EntityTable<ExerciseResult, "id">;
  monthlyGoals!: EntityTable<MonthlyGoal, "id">;
  milestones!: EntityTable<Milestone, "id">;
  mockExams!: EntityTable<MockExam, "id">;
  pastExams!: EntityTable<PastExam, "id">;
  pastExamProblems!: EntityTable<PastExamProblem, "id">;

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
    this.version(2).stores({
      universities: "id, priority, order",
      universityRequirements: "id, universityId, subjectId",
      exerciseResults: "id, topicId, at, date",
      monthlyGoals: "id, month, subjectId",
      milestones: "id, date",
      mockExams: "id, examDate",
      pastExams: "id, universityId, year",
      pastExamProblems: "id, pastExamId, topicId",
    });
  }

  /** Every table, for backup / reset transactions. */
  allTables() {
    return [
      this.subjects,
      this.categories,
      this.topics,
      this.studySessions,
      this.reviews,
      this.dailyGoals,
      this.examScores,
      this.settings,
      this.activityLogs,
      this.universities,
      this.universityRequirements,
      this.exerciseResults,
      this.monthlyGoals,
      this.milestones,
      this.mockExams,
      this.pastExams,
      this.pastExamProblems,
    ];
  }
}

let instance: HenyuDB | null = null;

/** Lazy singleton so the DB is only constructed in environments that use it. */
export function getDb(): HenyuDB {
  if (!instance) instance = new HenyuDB();
  return instance;
}

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;
