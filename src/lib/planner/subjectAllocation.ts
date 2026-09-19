import { DAY_MS, startOfDay } from "@/lib/date";
import type { ID, StudySession } from "@/lib/types";

/**
 * Long-term time allocation vs. what actually happened in the last 7 days
 * (spec §18). The planner uses `deficitRatio` so short-term priorities can't
 * starve a subject (e.g. 英語 = 0 minutes for a week).
 */
export interface AllocationStatus {
  subjectId: ID;
  /** 0–1 target share from settings */
  targetShare: number;
  /** 0–1 actual share of the window */
  actualShare: number;
  actualMinutes: number;
  /** 0–1: (target − actual) / target, 0 when on/over target */
  deficitRatio: number;
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
  /** subject for a session whose subjectId is null (resolved via topic) */
  subjectOfSession?: (s: StudySession) => ID | null;
  now?: number;
  windowDays?: number;
}): AllocationStatus[] {
  const now = input.now ?? Date.now();
  const windowDays = input.windowDays ?? 7;
  const from = startOfDay(now) - (windowDays - 1) * DAY_MS;
  const shares = normaliseAllocation(input.allocation, input.subjectIds);
  const subjectOf = input.subjectOfSession ?? ((s: StudySession) => s.subjectId);

  const minutes = new Map<ID, number>();
  const lastAt = new Map<ID, number>();
  for (const s of input.sessions) {
    const sid = subjectOf(s);
    if (!sid) continue;
    if (s.startedAt >= from) minutes.set(sid, (minutes.get(sid) ?? 0) + s.durationSec / 60);
    lastAt.set(sid, Math.max(lastAt.get(sid) ?? 0, s.endedAt));
  }
  const total = [...minutes.entries()]
    .filter(([id]) => shares.has(id))
    .reduce((s, [, m]) => s + m, 0);

  return input.subjectIds.map((subjectId) => {
    const targetShare = shares.get(subjectId) ?? 0;
    const actualMinutes = Math.round(minutes.get(subjectId) ?? 0);
    const actualShare = total > 0 ? (minutes.get(subjectId) ?? 0) / total : 0;
    // with no study at all in the window there is nothing to be "behind" relative to
    const deficitRatio =
      targetShare > 0 && total > 0
        ? Math.max(0, Math.min(1, (targetShare - actualShare) / targetShare))
        : 0;
    const last = lastAt.get(subjectId);
    return {
      subjectId,
      targetShare,
      actualShare,
      actualMinutes,
      deficitRatio,
      daysSinceStudied:
        last === undefined ? null : Math.floor((startOfDay(now) - startOfDay(last)) / DAY_MS),
    };
  });
}
