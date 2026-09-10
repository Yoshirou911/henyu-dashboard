/**
 * Domain model.
 *
 * Hierarchy is deliberately generic — `subject → category → topic` — so that
 * subjects beyond math (物理 / 英語 / C++ / アルゴリズム …) can be added later
 * without touching UI or storage code.
 */

export type ID = string;

/** Learning status, ordered. Persisted as the numeric value. */
export const STATUS_VALUES = [0, 1, 2, 3, 4] as const;
export type Status = (typeof STATUS_VALUES)[number];

/** Status → progress points (spec §6). */
export const STATUS_SCORE: Record<Status, number> = {
  0: 0,
  1: 25,
  2: 50,
  3: 75,
  4: 100,
};

export interface Subject {
  id: ID;
  /** stable machine key, e.g. "math" */
  slug: string;
  name: string;
  /** css color token name or hex; optional cosmetic */
  color?: string;
  order: number;
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
  /** importance multiplier for progress math; default 1 (spec §6) */
  weight: number;
  order: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
  lastStudiedAt?: number;
  /** first time the topic reached 基本OK — anchor for the review schedule (spec §12) */
  basicOkAt?: number;
  /** last time status moved *up* — used for stale-topic weakness detection (spec §13) */
  lastStatusUpAt?: number;
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
  createdAt: number;
}

/** できた / 怪しい / できなかった (spec §12) */
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
  /** id === date ("YYYY-MM-DD"); one goal per day keeps updates to one tap */
  id: ID;
  date: string;
  text: string;
  done: boolean;
  topicId?: ID;
  createdAt: number;
  updatedAt: number;
}

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
  /** topics this paper exercised — feeds weakness detection later (spec §13/§18) */
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
  | "seed";

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
  /** spec §12 — lower status automatically when a review is "できなかった" */
  autoLowerStatusOnFailedReview: boolean;
  dailyStudyGoalMin: number;
  weeklyStudyGoalMin: number;
  onboardedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** Shape of a full backup file (spec §15). */
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

export interface WeaknessItem {
  topic: Topic;
  categoryName: string;
  score: number;
  reasons: string[];
}
