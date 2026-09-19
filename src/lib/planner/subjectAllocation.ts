import { DAY_MS, startOfDay } from "@/lib/date";
import type { ID, StudySession } from "@/lib/types";

/**
 * Long-term time allocation vs. what actually happened (spec §18, Phase 3.0a).
 *
 * The balance is measured in **absolute minutes** against the weekly goal:
 *
 *   expectedMinutes = weeklyGoal × targetShare × trackedDays / 7
 *   balanceMinutes  = expectedMinutes − pastMinutes   (+ = behind, − = ahead)
 *
 * over the last `windowDays` *completed* days. Today is excluded — what was
 * done today is handled by the planner as "already done" instead.
 *
 * `trackedDays` only counts days since the first recorded session, so a
 * subject that simply hasn't been started yet on day 1 is not "behind".
 */
export interface AllocationStatus {
  subjectId: ID;
  /** 0–1 target share from settings */
  targetShare: number;
  /** 0–1 share of the last 7 days including today (display only) */
  actualShare: number;
  /** minutes in the last 7 days including today (display only) */
  actualMinutes: number;
  /** minutes the weekly goal expects over the tracked past days */
  expectedMinutes: number;
  /** minutes actually studied over the tracked past days (today excluded) */
  pastMinutes: number;
  /** expected − past; positive = behind, negative = ahead */
  balanceMinutes: number;
  /** max(0, balanceMinutes) */
  deficitMinutes: number;
  /** minutes studied today */
  todayMinutes: number;
  /** days since the subject was last studied; null = never */
  daysSinceStudied: number | null;
}

export function normaliseAllocation(
  allocation: Readonly<Record<ID, number>>,
  subjectIds: readonly ID[],
): Map<ID, number> {
  const total = subjectIds.reduce((s, id) => s + Math.max(0, allocation[id] ?? 0), 0);
  const out = new Map<ID, number>();
  for (const id of subjectIds) {
    out.set(id, total > 0 ? Math.max(0, allocation[id] ?? 0) / total : 1 / subjectIds.length);
  }
  return out;
}

export function computeAllocationStatus(input: {
  allocation: Readonly<Record<ID, number>>;
  subjectIds: readonly ID[];
  sessions: readonly StudySession[];
  /** settings.weeklyStudyGoalMin; 0 disables the minute balance */
  weeklyGoalMinutes: number;
  /** subject for a session whose subjectId is null (resolved via topic) */
  subjectOfSession?: (s: StudySession) => ID | null;
  now?: number;
  windowDays?: number;
}): AllocationStatus[] {
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? 7;
  const todayStart = startOfDay(now);
  const shares = normaliseAllocation(input.allocation, input.subjectIds);
  const subjectOf = input.subjectOfSession ?? ((s: StudySession) => s.subjectId);

  // tracking starts with the first recorded session of any subject
  const firstAt = input.sessions.reduce((m, s) => Math.min(m, s.startedAt), Infinity);
  const trackedDays = Number.isFinite(firstAt)
    ? Math.max(0, Math.min(windowDays, Math.round((todayStart - startOfDay(firstAt)) / DAY_MS)))
    : 0;
  const pastFrom = todayStart - trackedDays * DAY_MS;
  const displayFrom = todayStart - (windowDays - 1) * DAY_MS;

  const past = new Map<ID, number>();
  const today = new Map<ID, number>();
  const display = new Map<ID, number>();
  const lastAt = new Map<ID, number>();
  const add = (m: Map<ID, number>, id: ID, v: number) => m.set(id, (m.get(id) ?? 0) + v);
  for (const s of input.sessions) {
    const sid = subjectOf(s);
    if (!sid) continue;
    const min = s.durationSec / 60;
    if (s.startedAt >= todayStart) add(today, sid, min);
    else if (s.startedAt >= pastFrom) add(past, sid, min);
    if (s.startedAt >= displayFrom) add(display, sid, min);
    lastAt.set(sid, Math.max(lastAt.get(sid) ?? 0, s.endedAt));
  }
  const displayTotal = [...display.entries()]
    .filter(([id]) => shares.has(id))
    .reduce((s, [, m]) => s + m, 0);
  const weeklyGoal = Math.max(0, input.weeklyGoalMinutes);

  return input.subjectIds.map((subjectId) => {
    const targetShare = shares.get(subjectId) ?? 0;
    const expectedMinutes = (weeklyGoal * targetShare * trackedDays) / 7;
    const pastMinutes = past.get(subjectId) ?? 0;
    // a disabled weekly goal means "no minute target" rather than "everything is ahead"
    const balanceMinutes = weeklyGoal > 0 ? expectedMinutes - pastMinutes : 0;
    const last = lastAt.get(subjectId);
    return {
      subjectId,
      targetShare,
      actualShare: displayTotal > 0 ? (display.get(subjectId) ?? 0) / displayTotal : 0,
      actualMinutes: Math.round(display.get(subjectId) ?? 0),
      expectedMinutes,
      pastMinutes,
      balanceMinutes,
      deficitMinutes: Math.max(0, balanceMinutes),
      todayMinutes: today.get(subjectId) ?? 0,
      daysSinceStudied:
        last === undefined ? null : Math.floor((todayStart - startOfDay(last)) / DAY_MS),
    };
  });
}
