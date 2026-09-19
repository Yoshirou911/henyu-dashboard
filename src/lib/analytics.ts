import { DAY_MS, dayKey, endOfDay, lastNDays, shortDateLabel, startOfDay } from "@/lib/date";
import { weightedPercent } from "@/lib/progress";
import type { ActivityLog, Category, Status, StudySession, Topic } from "@/lib/types";
import { roundTo } from "@/lib/utils";

export interface DayBucket {
  day: string;
  label: string;
  minutes: number;
}

/** Per-day study minutes for the last `count` days (spec §11 週間/月間). */
export function dailyStudyMinutes(
  sessions: readonly StudySession[],
  count: number,
  now: Date = new Date(),
): DayBucket[] {
  const keys = lastNDays(count, now);
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.startedAt));
    totals.set(key, (totals.get(key) ?? 0) + s.durationSec);
  }
  return keys.map((day) => ({
    day,
    label: shortDateLabel(new Date(`${day}T00:00:00`)),
    minutes: roundTo((totals.get(day) ?? 0) / 60, 0),
  }));
}

export interface WeekBucket {
  weekStart: string;
  label: string;
  minutes: number;
}

/** Study minutes bucketed by ISO week (Mon-start) for the last `weeks` weeks. */
export function weeklyStudyMinutes(
  sessions: readonly StudySession[],
  weeks: number,
  now: Date = new Date(),
): WeekBucket[] {
  const monday = (d: Date) => {
    const copy = new Date(startOfDay(d));
    const day = copy.getDay() || 7;
    copy.setDate(copy.getDate() - (day - 1));
    return copy;
  };
  const currentMonday = monday(now).getTime();
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = currentMonday - i * 7 * DAY_MS;
    const end = start + 7 * DAY_MS;
    let sec = 0;
    for (const s of sessions) {
      if (s.startedAt >= start && s.startedAt < end) sec += s.durationSec;
    }
    const startDate = new Date(start);
    buckets.push({
      weekStart: dayKey(startDate),
      label: `${startDate.getMonth() + 1}/${startDate.getDate()}`,
      minutes: roundTo(sec / 60, 0),
    });
  }
  return buckets;
}

export interface SplitSlice {
  id: string;
  name: string;
  minutes: number;
  percent: number;
}

/** Study-time split by category within a subject (spec §11 分野別学習時間). */
export function categoryStudySplit(
  sessions: readonly StudySession[],
  categories: readonly Category[],
  topics: readonly Topic[],
  subjectId: string,
): SplitSlice[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const catForTopic = new Map(topics.map((t) => [t.id, t.categoryId]));
  const subjectCatIds = new Set(
    categories.filter((c) => c.subjectId === subjectId).map((c) => c.id),
  );

  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (!s.topicId) continue;
    const catId = catForTopic.get(s.topicId);
    if (!catId || !subjectCatIds.has(catId)) continue;
    totals.set(catId, (totals.get(catId) ?? 0) + s.durationSec);
  }

  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  const slices: SplitSlice[] = [];
  for (const [catId, sec] of totals) {
    const cat = catById.get(catId);
    slices.push({
      id: catId,
      name: cat?.name ?? "不明",
      minutes: roundTo(sec / 60, 0),
      percent: grand > 0 ? roundTo((sec / grand) * 100, 1) : 0,
    });
  }
  return slices.sort((a, b) => b.minutes - a.minutes);
}

export interface TrendPoint {
  day: string;
  label: string;
  percent: number;
}

/**
 * Subject-wide progress % per day for the last `count` days, reconstructed by
 * replaying `status_change` activity logs backwards from the current state
 * (spec §11 進捗推移). No extra storage needed.
 */
export function progressTrend(
  count: number,
  subjectTopics: readonly Topic[],
  activityLogs: readonly ActivityLog[],
  now: Date = new Date(),
): TrendPoint[] {
  const topicIds = new Set(subjectTopics.map((t) => t.id));
  const changes = activityLogs
    .filter(
      (l) =>
        l.type === "status_change" &&
        l.topicId &&
        topicIds.has(l.topicId) &&
        l.meta &&
        typeof l.meta.from === "number",
    )
    .sort((a, b) => b.at - a.at);

  const statusAt = new Map<string, Status>(subjectTopics.map((t) => [t.id, t.status]));
  const keys = lastNDays(count, now);
  const points: TrendPoint[] = [];

  // Walk from today backwards; `changes` is newest-first.
  let changeIdx = 0;
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i] ?? dayKey(now);
    const cutoff = endOfDay(new Date(`${key}T00:00:00`));
    while (changeIdx < changes.length && (changes[changeIdx]?.at ?? 0) > cutoff) {
      const change = changes[changeIdx];
      if (change?.topicId && change.meta && typeof change.meta.from === "number") {
        statusAt.set(change.topicId, change.meta.from as Status);
      }
      changeIdx++;
    }
    const snapshot = subjectTopics.map((t) => ({
      ...t,
      status: statusAt.get(t.id) ?? t.status,
    }));
    points.push({
      day: key,
      label: shortDateLabel(new Date(`${key}T00:00:00`)),
      percent: weightedPercent(snapshot),
    });
  }
  return points.reverse();
}

export function totalStudySeconds(sessions: readonly StudySession[]): number {
  return sessions.reduce((sum, s) => sum + s.durationSec, 0);
}

/** Current consecutive-day study streak, counting today or yesterday as the anchor. */
export function studyStreakDays(sessions: readonly StudySession[], now: Date = new Date()): number {
  if (sessions.length === 0) return 0;
  const studied = new Set(sessions.map((s) => dayKey(new Date(s.startedAt))));
  let streak = 0;
  let cursor = startOfDay(now);
  if (!studied.has(dayKey(new Date(cursor)))) {
    cursor -= DAY_MS; // allow the streak to "hold" until end of today
    if (!studied.has(dayKey(new Date(cursor)))) return 0;
  }
  while (studied.has(dayKey(new Date(cursor)))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Study-time split across subjects (編入学習全体). */
export function subjectStudySplit(
  sessions: readonly StudySession[],
  subjects: readonly { id: string; name: string }[],
  subjectOf: (s: StudySession) => string | null,
  sinceMs = 0,
): SplitSlice[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (s.startedAt < sinceMs) continue;
    const sid = subjectOf(s);
    if (!sid) continue;
    totals.set(sid, (totals.get(sid) ?? 0) + s.durationSec);
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0);
  return subjects
    .map((subj) => {
      const sec = totals.get(subj.id) ?? 0;
      return {
        id: subj.id,
        name: subj.name,
        minutes: roundTo(sec / 60, 0),
        percent: grand > 0 ? roundTo((sec / grand) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
}
