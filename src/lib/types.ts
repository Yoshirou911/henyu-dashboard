/**
 * Domain model.
 *
 * Hierarchy is deliberately generic — `subject → category → topic` — so any
 * exam subject (数学 / 物理 / 英語 / TOEIC / C++ / アルゴリズム / CS基礎 / 面接 …)
 * uses the same storage, engines and UI.
 *
 * Only *facts* are persisted. Everything that can be recomputed (accuracy,
 * masteryScore, weaknessScore, readiness, today's plan …) is derived at read
 * time — see `src/lib/model/buildStudyModel.ts`.
 */

export type ID = string;

/** Learning status, ordered. Persisted as the numeric value. */
export const STATUS_VALUES = [0, 1, 2, 3, 4] as const;
export type Status = (typeof STATUS_VALUES)[number];

/** Status → progress points (Phase 1 roadmap progress). */
export const STATUS_SCORE: Record<Status, number> = {
  0: 0,
  1: 25,
  2: 50,
  3: 75,
  4: 100,
};

/**
 * How a subject's mastery is judged (Phase 2 §8). The status ladder is shared;
 * the evidence that corrects it differs per type.
 * - problem:   数学・物理・C++・アルゴリズム・CS基礎 — problem accuracy dominates
 * - language:  英語・TOEIC — accuracy + volume (vocab minutes) + mock results
 * - interview: 面接 — checklist / mock-interview completeness
 */
export type EvaluationType = "problem" | "language" | "interview";

export interface Subject {
  id: ID;
  /** stable machine key, e.g. "math" */
  slug: string;
  name: string;
  /** css color token name or hex; optional cosmetic */
  color?: string;
  order: number;
  /** v2 — defaults to "problem" when absent (Phase 1 rows) */
  evaluationType?: EvaluationType;
  /** v2 — hidden from planner / dashboards but still listed */
  hidden?: boolean;
  /** v2 — retired; only visible in settings */
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: ID;
  subjectId: ID;
  name: string;
  description?: string;
  order: number;
  /** roadmap lane: 0 = main progression, 1 = parallel route (線形代数) */
  track: number;
  /** categories that should come before this one in the roadmap flow */
  prerequisiteIds: ID[];
  createdAt: number;
  updatedAt: number;
}

export interface Topic {
  id: ID;
  categoryId: ID;
  name: string;
  description?: string;
  status: Status;
  /** importance multiplier for progress math; default 1 */
  weight: number;
  order: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
  lastStudiedAt?: number;
  /** first time the topic reached 基本OK — anchor for the review schedule */
  basicOkAt?: number;
  /** last time status moved *up* — used for stale-topic weakness detection */
  lastStatusUpAt?: number;
  /** v2 — prerequisite topics (may cross subjects, e.g. 電磁気 → ベクトル) */
  dependsOn?: ID[];
  /** v2 — manual override of readyForNext; undefined = automatic */
  readyOverride?: boolean;
  /** v2 — hidden from lists / planner */
  archived?: boolean;
}

export type StudySource = "timer" | "manual";

export interface StudySession {
  id: ID;
  topicId: ID | null;
  subjectId: ID | null;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  source: StudySource;
  note?: string;
  /** v2 — minutes planned when the session was started from the planner */
  plannedMinutes?: number;
  createdAt: number;
}

/** できた / 怪しい / できなかった */
export type ReviewOutcome = "got" | "shaky" | "failed";

export interface Review {
  id: ID;
  topicId: ID;
  /** scheduled day, epoch ms at local midnight */
  dueAt: number;
  /** index into REVIEW_INTERVALS_DAYS */
  stage: number;
  completedAt?: number;
  outcome?: ReviewOutcome;
  /** whether completing this review lowered the topic status */
  statusLowered?: boolean;
  createdAt: number;
}

export interface DailyGoal {
  /** id === date ("YYYY-MM-DD"); one row per day keeps updates to one tap */
  id: ID;
  date: string;
  text: string;
  done: boolean;
  topicId?: ID;
  /** v2 — minutes the user said they can study today (drives the planner) */
  availableMinutes?: number;
  createdAt: number;
  updatedAt: number;
}

/** Phase 1 過去問得点. Kept for backward compatibility; migrated into `pastExams`. */
export interface ExamScore {
  id: ID;
  examName: string;
  year: number;
  subject: string;
  score: number;
  maxScore: number;
  durationMin?: number;
  date: string;
  note?: string;
  relatedTopicIds?: ID[];
  createdAt: number;
}

export type ActivityType =
  | "status_change"
  | "study_logged"
  | "review_done"
  | "goal_completed"
  | "exam_added"
  | "topic_added"
  | "exercise_logged"
  | "mock_added"
  | "seed";

/**
 * Activity feed. `status_change` entries (meta `{ from, to }`) are also the
 * only history of *when* a topic's status moved, which Phase 3 uses for
 * learning-speed and weekly-review analysis — treat them as fact data:
 * never prune or rewrite them. See docs/PHASE3_DESIGN.md §3.
 */
export interface ActivityLog {
  id: ID;
  type: ActivityType;
  at: number;
  message: string;
  topicId?: ID;
  subjectId?: ID;
  meta?: Record<string, string | number | boolean | null>;
}

export type ThemePreference = "dark" | "light" | "system";

export interface Settings {
  /** singleton row */
  id: "app";
  schemaVersion: number;
  examName: string;
  /** YYYY-MM-DD */
  examDate: string;
  primarySubjectId: ID | null;
  theme: ThemePreference;
  autoLowerStatusOnFailedReview: boolean;
  dailyStudyGoalMin: number;
  weeklyStudyGoalMin: number;
  onboardedAt?: number;
  /** v2 — 第一志望 */
  primaryUniversityId?: ID | null;
  /** v2 — long-term time allocation, subjectId → percent (sums to ~100) */
  subjectAllocation?: Record<ID, number>;
  /** v2 — default "今日使える時間" for the planner */
  defaultAvailableMinutes?: number;
  createdAt: number;
  updatedAt: number;
}

/* ---------------------------- Phase 2 tables ---------------------------- */

export type UniversityPriority = "first_choice" | "strong_candidate" | "candidate" | "backup";

export interface University {
  id: ID;
  name: string;
  faculty: string;
  departmentOrCourse: string;
  priority: UniversityPriority;
  /** YYYY-MM-DD */
  examDate?: string;
  applicationDeadline?: string;
  resultDate?: string;
  notes?: string;
  order: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UniversityRequirement {
  id: ID;
  universityId: ID;
  subjectId: ID;
  required: boolean;
  /** 1–5 — how much it matters for this university */
  importance: number;
  /** share of the readiness score (any positive number; normalised at read time) */
  weight: number;
  note?: string;
}

export type ExerciseDifficulty = "basic" | "standard" | "advanced" | "past_exam";
export type ExerciseType = "practice" | "review" | "mock" | "past_exam";

export interface ExerciseResult {
  id: ID;
  topicId: ID;
  /** YYYY-MM-DD */
  date: string;
  /** epoch ms — ordering for "直近" windows */
  at: number;
  attemptedCount: number;
  correctCount: number;
  difficulty: ExerciseDifficulty;
  type: ExerciseType;
  memo?: string;
  sessionId?: ID;
  createdAt: number;
}

export interface MonthlyGoal {
  id: ID;
  /** YYYY-MM */
  month: string;
  subjectId: ID;
  text: string;
  /** optional measurable target: bring this topic to this status */
  targetTopicId?: ID;
  targetStatus?: Status;
  /** manual completion for free-text goals */
  done?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Milestone {
  id: ID;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  items: string[];
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MockExam {
  id: ID;
  examName: string;
  /** YYYY-MM-DD */
  examDate: string;
  /** free text as printed on the result sheet, e.g. "数学II BC" */
  subject: string;
  subjectId?: ID;
  score: number;
  maxScore: number;
  deviationValue?: number;
  rank?: number;
  participants?: number;
  memo?: string;
  /** topics that lost points — feeds weakness */
  weakTopicIds?: ID[];
  createdAt: number;
}

export interface PastExam {
  id: ID;
  universityId: ID | null;
  /** free-text label, used when universityId is unknown (migrated rows) */
  examLabel?: string;
  year: number;
  subject: string;
  subjectId?: ID;
  score: number;
  maxScore: number;
  durationMin?: number;
  /** YYYY-MM-DD the paper was attempted */
  date: string;
  memo?: string;
  createdAt: number;
}

export type ProblemResult = "correct" | "partial" | "wrong";

export interface PastExamProblem {
  id: ID;
  pastExamId: ID;
  number: number;
  topicId?: ID;
  result: ProblemResult;
  score?: number;
  maxScore?: number;
  memo?: string;
}

/** Shape of a full backup file. v2 tables are optional so v1 files still import. */
export interface BackupFile {
  format: "henyu-dashboard-backup";
  schemaVersion: number;
  exportedAt: string;
  data: {
    subjects: Subject[];
    categories: Category[];
    topics: Topic[];
    studySessions: StudySession[];
    reviews: Review[];
    dailyGoals: DailyGoal[];
    examScores: ExamScore[];
    settings: Settings[];
    activityLogs: ActivityLog[];
    universities?: University[];
    universityRequirements?: UniversityRequirement[];
    exerciseResults?: ExerciseResult[];
    monthlyGoals?: MonthlyGoal[];
    milestones?: Milestone[];
    mockExams?: MockExam[];
    pastExams?: PastExam[];
    pastExamProblems?: PastExamProblem[];
  };
}

/* ---------- Derived / view-model types (never persisted) ---------- */

export interface CategoryProgress {
  category: Category;
  topics: Topic[];
  percent: number;
  topicCount: number;
  doneCount: number;
}

export interface SubjectProgress {
  subject: Subject;
  categories: CategoryProgress[];
  percent: number;
  topicCount: number;
  doneCount: number;
}
