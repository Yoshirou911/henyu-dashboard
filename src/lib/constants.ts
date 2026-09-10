import type { Status } from "@/lib/types";

export const SCHEMA_VERSION = 1;

export const DEFAULT_EXAM_NAME = "電通大 情報理工学域Ⅰ類 3年次編入試験";

/**
 * Placeholder exam date until the official schedule is announced (spec §4).
 * Roughly the historical UEC transfer-exam window (early July).
 */
export const DEFAULT_EXAM_DATE = "2027-07-03";

export interface StatusMeta {
  value: Status;
  label: string;
  short: string;
  description: string;
  /** tailwind token suffix: text-status-N / bg-status-N */
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

/** Review offsets in days from the 基本OK date (spec §12). */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

export const REVIEW_OUTCOME_META: Record<
  "got" | "shaky" | "failed",
  { label: string; token: string }
> = {
  got: { label: "できた", token: "status-3" },
  shaky: { label: "怪しい", token: "status-1" },
  failed: { label: "できなかった", token: "destructive" },
};

export interface NavItem {
  href: string;
  label: string;
  /** lucide icon name resolved in the sidebar */
  icon: "layout-dashboard" | "target" | "git-branch" | "bar-chart-3" | "repeat" | "settings";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ダッシュボード", icon: "layout-dashboard" },
  { href: "/today", label: "今日", icon: "target" },
  { href: "/roadmap", label: "ロードマップ", icon: "git-branch" },
  { href: "/analytics", label: "Analytics", icon: "bar-chart-3" },
  { href: "/review", label: "復習", icon: "repeat" },
  { href: "/settings", label: "設定", icon: "settings" },
];

export const DEFAULT_DAILY_GOAL_MIN = 60;
export const DEFAULT_WEEKLY_GOAL_MIN = 60 * 8;
