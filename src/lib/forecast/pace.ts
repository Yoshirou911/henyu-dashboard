import { DAY_MS, dayKey, parseDayKey, startOfDay } from "@/lib/date";
import { FORECAST_CONFIG, type ForecastConfig } from "@/lib/forecast/config";
import type { Status } from "@/lib/types";

/* Pure pace / deadline maths (Phase 3.0b). All inputs explicit, no clock reads. */

/** Remaining minutes for one topic: estimated full minutes × work still left at its status. */
export function topicRemainingMinutes(
  estimatedMinutes: number,
  status: Status,
  cfg: ForecastConfig = FORECAST_CONFIG,
): number {
  const f = cfg.remainingWorkFactor[status] ?? 0;
  return Number.isFinite(estimatedMinutes) ? Math.max(0, estimatedMinutes * f) : 0;
}

export type PaceSource = "actual" | "plan";

export interface PaceEstimate {
  minutesPerWeek: number;
  /** "plan" = too little history, the weekly goal × allocation is used instead */
  source: PaceSource;
  /** completed days the actual pace is averaged over (0 for "plan") */
  days: number;
}

/**
 * Recent weekly pace: minutes over the last completed days (today excluded,
 * so the figure is stable within a day), averaged over the days since
 * tracking began when that is shorter than the window.
 */
export function estimateCurrentPace(
  input: {
    /** subject minutes per completed day, most recent first is not required */
    minutesInWindow: number;
    /** completed days since the first record of any subject */
    trackedDays: number;
    plannedMinutesPerWeek: number;
  },
  cfg: ForecastConfig = FORECAST_CONFIG,
): PaceEstimate {
  const days = Math.min(cfg.paceWindowDays, Math.max(0, Math.floor(input.trackedDays)));
  if (days < cfg.minTrackedDaysForPace) {
    return { minutesPerWeek: Math.max(0, input.plannedMinutesPerWeek), source: "plan", days: 0 };
  }
  return {
    minutesPerWeek: (Math.max(0, input.minutesInWindow) / days) * 7,
    source: "actual",
    days,
  };
}

export interface RequiredPace {
  /** "YYYY-MM-DD": exam date − examPrepReserveDays */
  completionTarget: string;
  /** days from today to the completion target (can be ≤ 0) */
  usableDays: number;
  /** null when there is no usable time left but work remains */
  minutesPerWeek: number | null;
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(parseDayKey(key));
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function estimateRequiredPace(
  input: { remainingMinutes: number; examDate: string; now: number },
  cfg: ForecastConfig = FORECAST_CONFIG,
): RequiredPace {
  const completionTarget = addDaysKey(input.examDate, -cfg.examPrepReserveDays);
  const usableDays = Math.round((parseDayKey(completionTarget) - startOfDay(input.now)) / DAY_MS);
  let minutesPerWeek: number | null;
  if (input.remainingMinutes <= 0) minutesPerWeek = 0;
  else if (usableDays <= 0) minutesPerWeek = null;
  else minutesPerWeek = (input.remainingMinutes / usableDays) * 7;
  return { completionTarget, usableDays, minutesPerWeek };
}

export type EtaStatus = "done" | "ok" | "no_pace" | "too_far";

export interface CompletionEstimate {
  status: EtaStatus;
  /** "YYYY-MM-DD" when status is "done" (today) or "ok" */
  date: string | null;
  daysNeeded: number | null;
}

export function estimateCompletionDate(
  input: { remainingMinutes: number; minutesPerWeek: number; now: number },
  cfg: ForecastConfig = FORECAST_CONFIG,
): CompletionEstimate {
  const today = dayKey(new Date(input.now));
  if (input.remainingMinutes <= 0) return { status: "done", date: today, daysNeeded: 0 };
  if (!(input.minutesPerWeek >= cfg.minimumPaceForEta)) {
    return { status: "no_pace", date: null, daysNeeded: null };
  }
  const daysNeeded = Math.ceil((input.remainingMinutes / input.minutesPerWeek) * 7);
  if (!Number.isFinite(daysNeeded) || daysNeeded > cfg.maxEtaDays) {
    return { status: "too_far", date: null, daysNeeded: null };
  }
  return { status: "ok", date: addDaysKey(today, daysNeeded), daysNeeded };
}

/** Signed days: + ahead of the completion target, − behind. null without a date. */
export function calculateScheduleMargin(
  completionTarget: string,
  eta: CompletionEstimate,
): number | null {
  if (!eta.date) return null;
  return Math.round((parseDayKey(completionTarget) - parseDayKey(eta.date)) / DAY_MS);
}

export type RiskLevel =
  "done" | "ahead" | "on_track" | "caution" | "behind" | "overdue" | "insufficient";

export interface DeadlineRisk {
  level: RiskLevel;
  /** required ÷ pace; null when it cannot be computed */
  pressure: number | null;
}

/**
 * Display-only deadline risk from pressure = required pace ÷ pace. With no
 * pace at all it is "insufficient" when the pace is only the plan, and
 * "behind" when real records show nothing is happening.
 */
export function calculateDeadlineRisk(
  input: {
    remainingMinutes: number;
    topicCount: number;
    required: RequiredPace;
    pace: PaceEstimate;
  },
  cfg: ForecastConfig = FORECAST_CONFIG,
): DeadlineRisk {
  if (input.topicCount === 0) return { level: "insufficient", pressure: null };
  if (input.remainingMinutes <= 0) return { level: "done", pressure: 0 };
  if (input.required.minutesPerWeek === null) return { level: "overdue", pressure: null };
  if (!(input.pace.minutesPerWeek > 0)) {
    return { level: input.pace.source === "plan" ? "insufficient" : "behind", pressure: null };
  }
  const pressure = input.required.minutesPerWeek / input.pace.minutesPerWeek;
  const t = cfg.riskThresholds;
  const level: RiskLevel =
    pressure <= t.ahead
      ? "ahead"
      : pressure <= t.onTrack
        ? "on_track"
        : pressure <= t.caution
          ? "caution"
          : "behind";
  return { level, pressure };
}

export type Confidence = "low" | "medium" | "high";

/**
 * How far a forecast can be trusted: speed samples observed in the subject
 * and how long records have been kept. A plan-based pace is always "low".
 */
export function calculatePredictionConfidence(
  input: { subjectSamples: number; daysSinceFirstRecord: number; paceSource: PaceSource },
  cfg: ForecastConfig = FORECAST_CONFIG,
): Confidence {
  if (input.paceSource === "plan") return "low";
  const { high, medium } = cfg.confidenceThresholds;
  if (input.subjectSamples >= high.samples && input.daysSinceFirstRecord >= high.days)
    return "high";
  if (input.subjectSamples >= medium.samples && input.daysSinceFirstRecord >= medium.days)
    return "medium";
  return "low";
}
