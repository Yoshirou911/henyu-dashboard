import type {
  ExerciseDifficulty,
  ExerciseType,
  ProblemResult,
  Status,
  UniversityPriority,
} from "@/lib/types";

/**
 * Logical data version. v1 = Phase 1 (math only). v2 = Phase 2 (all exam
 * subjects, universities, exercise results, goals, mocks, past exams).
 * Migration lives in `DexieRepository.migrate()`.
 */
export const SCHEMA_VERSION = 2;

export const DEFAULT_EXAM_NAME = "電通大 情報理工学域Ⅰ類 3年次編入試験";

/** Placeholder until the official schedule is announced. */
export const DEFAULT_EXAM_DATE = "2027-07-03";

export interface StatusMeta {
  value: Status;
  label: string;
  short: string;
  description: string;
  /** css token suffix: var(--status-N) */
  token: string;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  0: {
    value: 0,
    label: "未学習",
    short: "未",
    description: "まだ勉強していない。",
    token: "status-0",
  },
  1: {
    value: 1,
    label: "学習中",
    short: "中",
    description: "解説や例題を学習している途中。",
    token: "status-1",
  },
  2: {
    value: 2,
    label: "基本OK",
    short: "基",
    description: "基本問題なら解説を見ずに解ける。",
    token: "status-2",
  },
  3: {
    value: 3,
    label: "定着",
    short: "定",
    description: "数日空けても自力で解ける。",
    token: "status-3",
  },
  4: {
    value: 4,
    label: "過去問レベル",
    short: "過",
    description: "編入試験レベルの問題でも使える。",
    token: "status-4",
  },
};

export const STATUS_LIST = Object.values(STATUS_META);

/** A topic counts as "done" for headline counters at 定着 or above. */
export const DONE_THRESHOLD: Status = 3;

/** Review offsets in days from the 基本OK date. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

export const REVIEW_OUTCOME_META: Record<
  "got" | "shaky" | "failed",
  { label: string; token: string }
> = {
  got: { label: "できた", token: "status-3" },
  shaky: { label: "怪しい", token: "status-1" },
  failed: { label: "できなかった", token: "destructive" },
};

export const DIFFICULTY_META: Record<ExerciseDifficulty, string> = {
  basic: "基本",
  standard: "標準",
  advanced: "発展",
  past_exam: "過去問",
};

export const EXERCISE_TYPE_META: Record<ExerciseType, string> = {
  practice: "演習",
  review: "復習",
  mock: "模試",
  past_exam: "過去問",
};

export const PRIORITY_META: Record<UniversityPriority, { label: string; rank: number }> = {
  first_choice: { label: "第一志望", rank: 0 },
  strong_candidate: { label: "有力併願", rank: 1 },
  candidate: { label: "併願候補", rank: 2 },
  backup: { label: "予備", rank: 3 },
};

export const PROBLEM_RESULT_META: Record<ProblemResult, { label: string; symbol: string }> = {
  correct: { label: "正解", symbol: "○" },
  partial: { label: "部分点", symbol: "△" },
  wrong: { label: "不正解", symbol: "×" },
};

export type NavIconName =
  | "layout-dashboard"
  | "target"
  | "git-branch"
  | "bar-chart-3"
  | "repeat"
  | "settings"
  | "book-open"
  | "alert-triangle"
  | "graduation-cap"
  | "file-text"
  | "flag";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ダッシュボード", icon: "layout-dashboard" },
  { href: "/today", label: "今日", icon: "target" },
  { href: "/review", label: "復習", icon: "repeat" },
  { href: "/subjects", label: "科目", icon: "book-open" },
  { href: "/weakness", label: "弱点", icon: "alert-triangle" },
  { href: "/roadmap", label: "ロードマップ", icon: "git-branch" },
  { href: "/goals", label: "目標", icon: "flag" },
  { href: "/universities", label: "志望校", icon: "graduation-cap" },
  { href: "/exams", label: "模試・過去問", icon: "file-text" },
  { href: "/analytics", label: "Analytics", icon: "bar-chart-3" },
  { href: "/settings", label: "設定", icon: "settings" },
];

/** Mobile bottom bar — the phone use-cases (spec §34): today, review, timer, quick record. */
export const MOBILE_PRIMARY_NAV: string[] = ["/", "/today", "/review", "/subjects"];

export const DEFAULT_DAILY_GOAL_MIN = 60;
export const DEFAULT_WEEKLY_GOAL_MIN = 60 * 8;
export const DEFAULT_AVAILABLE_MINUTES = 120;
export const AVAILABLE_MINUTE_PRESETS = [30, 60, 90, 120, 180] as const;
