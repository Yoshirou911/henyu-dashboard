import type {
  ActivityLog,
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

/**
 * The only surface the UI is allowed to touch. Swapping IndexedDB for Supabase
 * later means writing one more class that implements this interface (spec §1).
 *
 * Read methods return plain Promises; screens wrap them in `useLiveQuery` so a
 * future realtime backend can replace that layer without changing call sites.
 */
export interface DataRepository {
  /** Ensure the settings row exists and seed the math roadmap on first run. */
  initialize(): Promise<{ seeded: boolean }>;
  isEmpty(): Promise<boolean>;

  /* reads */
  getSettings(): Promise<Settings>;
  listSubjects(): Promise<Subject[]>;
  listCategories(subjectId?: ID): Promise<Category[]>;
  listTopics(): Promise<Topic[]>;
  getTopic(id: ID): Promise<Topic | undefined>;
  listStudySessions(sinceMs?: number): Promise<StudySession[]>;
  listReviews(): Promise<Review[]>;
  listOpenReviews(): Promise<Review[]>;
  getDailyGoal(date: string): Promise<DailyGoal | undefined>;
  listDailyGoals(sinceDate?: string): Promise<DailyGoal[]>;
  listExamScores(): Promise<ExamScore[]>;
  listActivity(limit?: number): Promise<ActivityLog[]>;

  /* topic mutations */
  setTopicStatus(topicId: ID, status: Topic["status"]): Promise<void>;
  updateTopic(
    topicId: ID,
    patch: Partial<Pick<Topic, "name" | "description" | "note" | "weight" | "order">>,
  ): Promise<void>;
  addTopic(categoryId: ID, name: string): Promise<Topic>;
  deleteTopic(topicId: ID): Promise<void>;
  reorderTopics(categoryId: ID, orderedIds: ID[]): Promise<void>;

  /* category / subject mutations */
  addCategory(subjectId: ID, name: string): Promise<Category>;
  updateCategory(
    categoryId: ID,
    patch: Partial<Pick<Category, "name" | "description" | "order" | "track" | "prerequisiteIds">>,
  ): Promise<void>;
  deleteCategory(categoryId: ID): Promise<void>;
  reorderCategories(subjectId: ID, orderedIds: ID[]): Promise<void>;
  addSubject(name: string, slug: string): Promise<Subject>;
  updateSubject(
    subjectId: ID,
    patch: Partial<Pick<Subject, "name" | "color" | "order">>,
  ): Promise<void>;
  deleteSubject(subjectId: ID): Promise<void>;

  /* study time */
  logStudySession(input: {
    topicId: ID | null;
    subjectId: ID | null;
    startedAt: number;
    endedAt: number;
    durationSec: number;
    source: StudySource;
    note?: string;
  }): Promise<StudySession>;
  deleteStudySession(id: ID): Promise<void>;

  /* daily goal */
  setDailyGoal(date: string, text: string, topicId?: ID): Promise<DailyGoal>;
  setDailyGoalDone(date: string, done: boolean): Promise<void>;

  /* reviews */
  completeReview(reviewId: ID, outcome: ReviewOutcome): Promise<void>;
  snoozeReview(reviewId: ID, days: number): Promise<void>;

  /* exam scores */
  addExamScore(input: Omit<ExamScore, "id" | "createdAt">): Promise<ExamScore>;
  deleteExamScore(id: ID): Promise<void>;

  /* settings */
  updateSettings(patch: Partial<Omit<Settings, "id" | "createdAt">>): Promise<void>;
  markOnboarded(): Promise<void>;

  /* backup (spec §15) */
  exportBackup(): Promise<BackupFile>;
  importBackup(file: BackupFile): Promise<void>;
  resetAll(): Promise<void>;
}
