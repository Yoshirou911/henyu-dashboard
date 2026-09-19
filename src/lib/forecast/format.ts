import type { SpeedSource } from "@/lib/forecast/learningSpeed";
import type { Confidence, RiskLevel } from "@/lib/forecast/pace";
import type { SubjectForecast } from "@/lib/forecast/buildForecast";

/* Display strings for forecasts. Never returns NaN / Infinity / "Invalid Date". */

export const RISK_META: Record<
  RiskLevel,
  { label: string; tone: "ok" | "warn" | "bad" | "muted" }
> = {
  done: { label: "完了", tone: "ok" },
  ahead: { label: "余裕あり", tone: "ok" },
  on_track: { label: "予定通り", tone: "ok" },
  caution: { label: "要注意", tone: "warn" },
  behind: { label: "遅延", tone: "bad" },
  overdue: { label: "期限超過", tone: "bad" },
  insufficient: { label: "データ不足", tone: "muted" },
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = { low: "低", medium: "中", high: "高" };

export const SPEED_SOURCE_LABEL: Record<SpeedSource, string> = {
  topic: "この単元の実績",
  category: "同じ分野の実績",
  subject: "この科目の実績",
  global: "全科目の実績",
  prior: "初期値",
};

/** 45 → "45分", 90 → "1.5時間", 5160 → "86時間" */
export function formatHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const m = Math.max(0, minutes);
  if (m < 60) return `${Math.round(m)}分`;
  const h = m / 60;
  return `${h >= 20 ? Math.round(h) : Math.round(h * 10) / 10}時間`;
}

export function formatPerWeek(minutes: number | null | undefined): string {
  const h = formatHours(minutes);
  return h === "—" ? h : `${h} / 週`;
}

/** "2027-02-14" → "2027/02/14" */
export function formatDayKey(key: string | null | undefined): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "—";
  return key.replaceAll("-", "/");
}

/** +21 → "21日先行", −14 → "14日遅れ", |d| ≤ 3 → "予定通り" */
export function formatMargin(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  if (Math.abs(days) <= 3) return "予定通り";
  return days > 0 ? `${days}日先行` : `${-days}日遅れ`;
}

/** "予想到達" line, with the reason when there is no date. */
export function formatEta(f: SubjectForecast): string {
  switch (f.eta.status) {
    case "done":
      return "完了";
    case "ok":
      return formatDayKey(f.eta.date);
    case "no_pace":
      return f.pace.source === "plan" ? "学習記録不足" : "現在のペースでは算出不能";
    case "too_far":
      return "現在のペースでは算出不能";
  }
}

/** Compact status for the dashboard: plan-only forecasts are "データ不足". */
export function dashboardStatus(f: SubjectForecast): { label: string; detail: string | null } {
  if (f.risk.level !== "done" && f.pace.source === "plan") {
    return { label: RISK_META.insufficient.label, detail: null };
  }
  const label = RISK_META[f.risk.level].label;
  const margin =
    f.marginDays !== null && Math.abs(f.marginDays) > 3 ? formatMargin(f.marginDays) : null;
  return {
    label,
    detail: [margin, f.provisional ? "暫定" : null].filter(Boolean).join("・") || null,
  };
}

/**
 * Subjects for the dashboard's 受験ペース card: those the 第一志望 requires,
 * most important first (then by weight); without requirements, by planned
 * time. At most `max`.
 */
export function pickDashboardSubjects(
  subjects: readonly SubjectForecast[],
  requirements: readonly { subjectId: string; importance: number; weight: number }[],
  max = 4,
): SubjectForecast[] {
  const bySubject = new Map(subjects.map((s) => [s.subjectId, s]));
  const required = requirements
    .filter((r) => r.weight > 0 && bySubject.has(r.subjectId))
    .sort((a, b) => b.importance - a.importance || b.weight - a.weight)
    .map((r) => bySubject.get(r.subjectId) as SubjectForecast);
  const pool =
    required.length > 0
      ? required
      : subjects.slice().sort((a, b) => b.plannedMinutesPerWeek - a.plannedMinutesPerWeek);
  return [...new Set(pool)].slice(0, max);
}
