import { DAY_MS, startOfDay } from "@/lib/date";
import { FORECAST_CONFIG, type ForecastConfig } from "@/lib/forecast/config";
import type {
  ActivityLog,
  EvaluationType,
  ExerciseResult,
  ID,
  Status,
  StudySession,
} from "@/lib/types";

/** Where a topic belongs, for the fallback hierarchy. */
export interface TopicRef {
  topicId: ID;
  categoryId: ID;
  subjectId: ID;
  evaluationType: EvaluationType;
}

/**
 * One observed "learned it" event: a topic that first reached 基本OK or
 * above *after* study was recorded on it.
 */
export interface SpeedSample extends TopicRef {
  /** recorded study minutes on the topic before it reached `toStatus` */
  minutes: number;
  /** status when recording started (usually 0) */
  fromStatus: Status;
  toStatus: Status;
  /** minutes ÷ the share of the topic's work that step covers */
  baseMinutes: number;
  /** baseMinutes ÷ prior, clamped — comparable across evaluation types */
  ratio: number;
  /** problems attempted up to reaching the status */
  problems: number;
  /** calendar days from the first recorded session to reaching the status */
  days: number;
}

export type SpeedSource = "topic" | "category" | "subject" | "global" | "prior";

export interface SpeedEstimate {
  /** estimated minutes for this topic from 未学習 to done */
  minutes: number;
  /** multiplier on the prior (1 = prior) */
  ratio: number;
  source: SpeedSource;
  /** samples at the level the estimate came from */
  samples: number;
  /** 0–1: how much of the estimate comes from observations rather than the prior */
  observedWeight: number;
}

const statusOf = (v: unknown): Status | null =>
  typeof v === "number" && v >= 0 && v <= 4 && Number.isInteger(v) ? (v as Status) : null;

/** Chronological order; same-millisecond changes are chained to → from. */
export function sortStatusLogs(logs: readonly ActivityLog[]): ActivityLog[] {
  return logs
    .slice()
    .sort(
      (a, b) =>
        a.at - b.at ||
        (a.meta?.to === b.meta?.from ? -1 : b.meta?.to === a.meta?.from ? 1 : 0) ||
        a.id.localeCompare(b.id),
    );
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Speed samples from facts only. Self-reported statuses (onboarding, manual
 * jumps with no study recorded before them) produce no sample.
 */
export function collectSpeedSamples(
  input: {
    topics: readonly TopicRef[];
    sessions: readonly StudySession[];
    exerciseResults: readonly ExerciseResult[];
    statusLogs: readonly ActivityLog[];
  },
  cfg: ForecastConfig = FORECAST_CONFIG,
): SpeedSample[] {
  const group = <T>(rows: readonly T[], key: (r: T) => ID | null | undefined) => {
    const m = new Map<ID, T[]>();
    for (const r of rows) {
      const k = key(r);
      if (!k) continue;
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return m;
  };
  const sessionsBy = group(input.sessions, (s) => s.topicId);
  const resultsBy = group(input.exerciseResults, (r) => r.topicId);
  const logsBy = group(
    input.statusLogs.filter((l) => l.type === "status_change"),
    (l) => l.topicId,
  );

  const out: SpeedSample[] = [];
  for (const ref of input.topics) {
    const logs = sortStatusLogs(logsBy.get(ref.topicId) ?? []);
    const reach = logs.find((l) => (statusOf(l.meta?.to) ?? 0) >= 2);
    if (!reach) continue;
    const toStatus = statusOf(reach.meta?.to) as Status;

    const before = (sessionsBy.get(ref.topicId) ?? [])
      .filter((s) => s.startedAt < reach.at && s.durationSec > 0)
      .sort((a, b) => a.startedAt - b.startedAt);
    const minutes = before.reduce((sum, s) => sum + s.durationSec / 60, 0);
    if (before.length === 0 || minutes < cfg.minSampleMinutes) continue;
    const firstAt = (before[0] as StudySession).startedAt;

    // status the topic already had when recording started (e.g. set at onboarding)
    const prior = logs.filter((l) => l.at < firstAt).at(-1);
    const fromStatus = statusOf(prior?.meta?.to) ?? 0;
    const work = cfg.remainingWorkFactor[fromStatus] - cfg.remainingWorkFactor[toStatus];
    if (work <= 0.05) continue;

    const baseMinutes = minutes / work;
    const raw = baseMinutes / cfg.priorMinutesPerTopic[ref.evaluationType];
    out.push({
      ...ref,
      minutes,
      fromStatus,
      toStatus,
      baseMinutes,
      ratio: Math.min(cfg.ratioClamp.max, Math.max(cfg.ratioClamp.min, raw)),
      problems: (resultsBy.get(ref.topicId) ?? [])
        .filter((r) => r.at <= reach.at)
        .reduce((sum, r) => sum + r.attemptedCount, 0),
      days: Math.round((startOfDay(reach.at) - startOfDay(firstAt)) / DAY_MS),
    });
  }
  return out;
}

/**
 * Estimated full-topic minutes with a fallback hierarchy:
 *
 *   parent = the first of category → subject → global with enough samples
 *            (minSamplesByLevel), blended with the prior by n / (n + k);
 *            none → the prior
 *   topic  = the topic's own sample(s), blended with that parent the same way
 *
 * Levels use the median ratio (robust to one odd session) of clamped
 * samples, so one extreme record moves an estimate by at most 20 %.
 */
export function createSpeedEstimator(
  samples: readonly SpeedSample[],
  cfg: ForecastConfig = FORECAST_CONFIG,
): (ref: TopicRef) => SpeedEstimate {
  const k = cfg.priorStrength;
  const ratios = (pick: (s: SpeedSample) => boolean) => samples.filter(pick).map((s) => s.ratio);
  const blend = (values: number[], parent: number) =>
    (values.length * (median(values) as number) + k * parent) / (values.length + k);
  const cache = new Map<
    string,
    { ratio: number; source: SpeedSource; samples: number; priorShare: number }
  >();

  const parentOf = (ref: TopicRef) => {
    const key = `${ref.subjectId}|${ref.categoryId}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const levels: [SpeedSource, number[], number][] = [
      ["category", ratios((s) => s.categoryId === ref.categoryId), cfg.minSamplesByLevel.category],
      ["subject", ratios((s) => s.subjectId === ref.subjectId), cfg.minSamplesByLevel.subject],
      ["global", ratios(() => true), cfg.minSamplesByLevel.global],
    ];
    const found = levels.find(([, values, min]) => values.length >= Math.max(1, min));
    const result = found
      ? {
          ratio: blend(found[1], 1),
          source: found[0],
          samples: found[1].length,
          priorShare: k / (found[1].length + k),
        }
      : { ratio: 1, source: "prior" as SpeedSource, samples: 0, priorShare: 1 };
    cache.set(key, result);
    return result;
  };

  return (ref) => {
    const parent = parentOf(ref);
    const own = ratios((s) => s.topicId === ref.topicId);
    const ratio = own.length > 0 ? blend(own, parent.ratio) : parent.ratio;
    const priorShare =
      own.length > 0 ? (k / (own.length + k)) * parent.priorShare : parent.priorShare;
    return {
      minutes: cfg.priorMinutesPerTopic[ref.evaluationType] * ratio,
      ratio,
      source: own.length > 0 ? "topic" : parent.source,
      samples: own.length > 0 ? own.length : parent.samples,
      observedWeight: 1 - priorShare,
    };
  };
}
