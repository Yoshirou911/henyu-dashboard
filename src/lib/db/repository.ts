import type {
  ActivityLog,
  BackupFile,
  Category,
  DailyGoal,
  ExerciseDifficulty,
  ExerciseResult,
  ExerciseType,
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
import type { StudySnapshot } from "@/lib/model/snapshot";

export interface ExerciseInput {
  topicId: ID;
  attemptedCount: number;
  correctCount: number;
  difficulty: ExerciseDifficulty;
  type: ExerciseType;
  memo?: string;
  /** defaults to now */
  at?: number;
}

export interface RecordStudyInput {
  topicId: ID | null;
  subjectId: ID | null;
  minutes: number;
  /** defaults to now − minutes */
  startedAt?: number;
  endedAt?: number;
  source: StudySource;
  plannedMinutes?: number;
  note?: string;
  /** optional problem result recorded in the same step (spec §27) */
  exercise?: Omit<ExerciseInput, "topicId" | "at">;
}

export type TopicPatch = Partial<
  Pick<
    Topic,
    | "name"
    | "description"
    | "note"
    | "weight"
    | "order"
    | "dependsOn"
    | "readyOverride"
    | "archived"
  >
>;

export type SubjectPatch = Partial<
  Pick<Subject, "name" | "color" | "order" | "evaluationType" | "hidden" | "archived">
>;

export type UniversityInput = Omit<University, "id" | "createdAt" | "updatedAt" | "order">;

/**
 * The only surface the UI is allowed to touch. Swapping IndexedDB for Supabase
 * later means writing one more class that implements this interface.
 *
 * Reads return plain Promises; screens wrap them in `useLive` so a future
 * realtime backend can replace that layer without changing call sites.
 */
export interface DataRepository {
  /** Ensure settings exist, seed on first run, and migrate older data (idempotent). */
  initialize(): Promise<{ seeded: boolean; migrated: boolean }>;
  isEmpty(): Promise<boolean>;
  /** Add any missing exam-subject templates (spec §30). Never duplicates. */
  ensureExamTemplate(): Promise<{ addedSubjects: string[] }>;

  /* reads */
  /** Everything the derived model needs, in one live-queryable call. */
  getSnapshot(): Promise<StudySnapshot>;
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
  listActivity(limit?: number): Promise<ActivityLog[]>;
  listExerciseResults(topicId?: ID): Promise<ExerciseResult[]>;

  /* topic mutations */
  setTopicStatus(topicId: ID, status: Topic["status"]): Promise<void>;
  updateTopic(topicId: ID, patch: TopicPatch): Promise<void>;
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
  addSubject(
    name: string,
    slug: string,
    evaluationType?: Subject["evaluationType"],
  ): Promise<Subject>;
  updateSubject(subjectId: ID, patch: SubjectPatch): Promise<void>;
  reorderSubjects(orderedIds: ID[]): Promise<void>;
  deleteSubject(subjectId: ID): Promise<void>;

  /* study time + exercise results */
  logStudySession(input: {
    topicId: ID | null;
    subjectId: ID | null;
    startedAt: number;
    endedAt: number;
    durationSec: number;
    source: StudySource;
    note?: string;
    plannedMinutes?: number;
  }): Promise<StudySession>;
  deleteStudySession(id: ID): Promise<void>;
  addExerciseResult(input: ExerciseInput): Promise<ExerciseResult>;
  deleteExerciseResult(id: ID): Promise<void>;
  /** Session + optional exercise result in one transaction (timer stop / quick record). */
  recordStudy(input: RecordStudyInput): Promise<void>;

  /* daily goal / plan */
  setDailyGoal(date: string, text: string, topicId?: ID): Promise<DailyGoal>;
  setDailyGoalDone(date: string, done: boolean): Promise<void>;
  setAvailableMinutes(date: string, minutes: number): Promise<void>;

  /* reviews */
  completeReview(
    reviewId: ID,
    outcome: ReviewOutcome,
    exercise?: { attemptedCount: number; correctCount: number },
  ): Promise<void>;
  snoozeReview(reviewId: ID, days: number): Promise<void>;

  /* universities */
  addUniversity(input: UniversityInput): Promise<University>;
  updateUniversity(id: ID, patch: Partial<UniversityInput>): Promise<void>;
  deleteUniversity(id: ID): Promise<void>;
  upsertRequirement(req: Omit<UniversityRequirement, "id"> & { id?: ID }): Promise<void>;
  deleteRequirement(id: ID): Promise<void>;

  /* goals */
  addMonthlyGoal(input: Omit<MonthlyGoal, "id" | "createdAt" | "updatedAt">): Promise<MonthlyGoal>;
  updateMonthlyGoal(
    id: ID,
    patch: Partial<Omit<MonthlyGoal, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void>;
  deleteMonthlyGoal(id: ID): Promise<void>;
  addMilestone(input: Omit<Milestone, "id" | "createdAt" | "updatedAt">): Promise<Milestone>;
  updateMilestone(
    id: ID,
    patch: Partial<Omit<Milestone, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void>;
  deleteMilestone(id: ID): Promise<void>;

  /* exams */
  addMockExam(input: Omit<MockExam, "id" | "createdAt">): Promise<MockExam>;
  deleteMockExam(id: ID): Promise<void>;
  addPastExam(
    exam: Omit<PastExam, "id" | "createdAt">,
    problems: Omit<PastExamProblem, "id" | "pastExamId">[],
  ): Promise<PastExam>;
  deletePastExam(id: ID): Promise<void>;

  /* settings */
  updateSettings(patch: Partial<Omit<Settings, "id" | "createdAt">>): Promise<void>;
  markOnboarded(): Promise<void>;

  /* backup */
  exportBackup(): Promise<BackupFile>;
  importBackup(file: BackupFile): Promise<void>;
  resetAll(): Promise<void>;
}
