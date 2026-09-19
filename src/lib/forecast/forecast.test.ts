import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY_MS, parseDayKey } from "@/lib/date";
import { DexieRepository } from "@/lib/db/dexie-repository";
import { DB_NAME, HenyuDB } from "@/lib/db/schema";
import { buildForecast, type StudyForecast } from "@/lib/forecast/buildForecast";
import { FORECAST_CONFIG } from "@/lib/forecast/config";
import {
  dashboardStatus,
  formatEta,
  formatHours,
  formatMargin,
  pickDashboardSubjects,
} from "@/lib/forecast/format";
import {
  collectSpeedSamples,
  createSpeedEstimator,
  median,
  type SpeedSample,
  type TopicRef,
} from "@/lib/forecast/learningSpeed";
import {
  addDaysKey,
  calculateDeadlineRisk,
  calculatePredictionConfidence,
  calculateScheduleMargin,
  estimateCompletionDate,
  estimateCurrentPace,
  estimateRequiredPace,
  topicRemainingMinutes,
} from "@/lib/forecast/pace";
import { buildStudyModel } from "@/lib/model/buildStudyModel";
import type { StudySnapshot } from "@/lib/model/snapshot";
import type { ActivityLog, Status, StudySession } from "@/lib/types";

const NOW = new Date("2026-09-20T21:00:00").getTime();
const PRIOR = FORECAST_CONFIG.priorMinutesPerTopic.problem;
const BASIC_WORK = FORECAST_CONFIG.remainingWorkFactor[0] - FORECAST_CONFIG.remainingWorkFactor[2];

/* ------------------------------- helpers ------------------------------- */

let seq = 0;
function session(
  topicId: string | null,
  subjectId: string,
  daysAgo: number,
  minutes: number,
  now = NOW,
): StudySession {
  const startedAt = now - daysAgo * DAY_MS - 3 * 3_600_000;
  return {
    id: `s${seq++}`,
    topicId,
    subjectId,
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    durationSec: minutes * 60,
    source: "manual",
    createdAt: startedAt,
  };
}
function statusLog(topicId: string, from: number, to: number, at: number): ActivityLog {
  return {
    id: `l${seq++}`,
    type: "status_change",
    at,
    message: "",
    topicId,
    meta: { from, to },
  };
}
const ref = (topicId: string, categoryId = "cat", subjectId = "math"): TopicRef => ({
  topicId,
  categoryId,
  subjectId,
  evaluationType: "problem",
});
/** a sample whose full-topic minutes are `baseMinutes` */
function sampleOf(r: TopicRef, baseMinutes: number): SpeedSample {
  const ratio = Math.min(3, Math.max(0.25, baseMinutes / PRIOR));
  return {
    ...r,
    minutes: baseMinutes * BASIC_WORK,
    fromStatus: 0,
    toStatus: 2,
    baseMinutes,
    ratio,
    problems: 0,
    days: 0,
  };
}
const samplesOf = (bases: number[], r: (i: number) => TopicRef = (i) => ref(`t${i}`)) =>
  bases.map((b, i) => sampleOf(r(i), b));
/** estimate for a topic with no own sample in category "cat" of math */
const estimateNew = (samples: SpeedSample[]) => createSpeedEstimator(samples)(ref("new"));

function allNumbersFinite(value: unknown, path = "forecast"): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? [] : [path];
  if (typeof value === "string") return /NaN|Infinity|Invalid/.test(value) ? [path] : [];
  if (value instanceof Map)
    return [...value.values()].flatMap((v, i) => allNumbersFinite(v, `${path}[${i}]`));
  if (Array.isArray(value)) return value.flatMap((v, i) => allNumbersFinite(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => allNumbersFinite(v, `${path}.${k}`));
  return [];
}

/* --------------------------- learning speed --------------------------- */

describe("collectSpeedSamples", () => {
  const topics = [ref("a"), ref("b"), ref("c"), ref("d")];
  const t0 = NOW - 5 * DAY_MS;

  it("uses study recorded before a topic first reached 基本OK", () => {
    const [s] = collectSpeedSamples({
      topics,
      sessions: [
        session("a", "math", 5, 30),
        session("a", "math", 4, 20),
        session("a", "math", 1, 99),
      ],
      exerciseResults: [
        {
          id: "e",
          topicId: "a",
          date: "",
          at: t0,
          attemptedCount: 12,
          correctCount: 9,
          difficulty: "basic",
          type: "practice",
          createdAt: t0,
        },
      ],
      statusLogs: [statusLog("a", 0, 1, t0), statusLog("a", 1, 2, NOW - 3 * DAY_MS)],
    });
    expect(s?.minutes).toBe(50); // the session after 基本OK is not counted
    expect(s?.baseMinutes).toBeCloseTo(50 / BASIC_WORK);
    expect(s?.problems).toBe(12);
    expect(s?.days).toBe(2);
  });

  it("ignores self-reported statuses (no study recorded before them)", () => {
    const samples = collectSpeedSamples({
      topics,
      sessions: [session("b", "math", 1, 60)], // studied only after being marked 基本OK
      exerciseResults: [],
      statusLogs: [statusLog("b", 0, 2, t0), statusLog("c", 0, 3, t0)],
    });
    expect(samples).toHaveLength(0);
  });

  it("only counts the work from the status the topic already had (onboarding 学習中)", () => {
    const [s] = collectSpeedSamples({
      topics,
      sessions: [session("d", "math", 3, 42)],
      exerciseResults: [],
      statusLogs: [statusLog("d", 0, 1, t0 - DAY_MS), statusLog("d", 1, 2, NOW - DAY_MS)],
    });
    const work = FORECAST_CONFIG.remainingWorkFactor[1] - FORECAST_CONFIG.remainingWorkFactor[2];
    expect(s?.fromStatus).toBe(1);
    expect(s?.baseMinutes).toBeCloseTo(42 / work);
  });

  it("drops stray records below minSampleMinutes and topicless sessions", () => {
    const samples = collectSpeedSamples({
      topics,
      sessions: [
        session("a", "math", 3, FORECAST_CONFIG.minSampleMinutes - 1),
        session(null, "math", 3, 90),
      ],
      exerciseResults: [],
      statusLogs: [statusLog("a", 0, 2, NOW - DAY_MS)],
    });
    expect(samples).toHaveLength(0);
  });
});

describe("createSpeedEstimator", () => {
  it("A. no data → the prior, source prior, no observed weight", () => {
    const e = estimateNew([]);
    expect(e).toMatchObject({
      minutes: PRIOR,
      ratio: 1,
      source: "prior",
      samples: 0,
      observedWeight: 0,
    });
  });

  it("B. a single extreme sample moves the estimate by at most 1/(1+k)", () => {
    const k = FORECAST_CONFIG.priorStrength;
    const fast = estimateNew(samplesOf([1]));
    const slow = estimateNew(samplesOf([100_000]));
    expect(fast.minutes).toBeCloseTo(PRIOR * ((0.25 + k) / (1 + k)));
    expect(slow.minutes).toBeCloseTo(PRIOR * ((3 + k) / (1 + k)));
    expect(slow.minutes).toBeLessThan(PRIOR * 1.5);
    expect(fast.minutes).toBeGreaterThan(PRIOR * 0.8);
  });

  it("C/D. more samples → observations dominate", () => {
    const at = (n: number) => estimateNew(samplesOf(Array(n).fill(PRIOR / 2)));
    const w1 = at(1).observedWeight;
    const w4 = at(4).observedWeight;
    const w12 = at(12).observedWeight;
    expect(w1).toBeLessThan(w4);
    expect(w4).toBeLessThan(w12);
    expect(w4).toBeCloseTo(0.5);
    expect(w12).toBeGreaterThan(0.7);
    // and the estimate moves toward the observed half-prior speed
    expect(at(1).minutes).toBeGreaterThan(at(4).minutes);
    expect(at(4).minutes).toBeGreaterThan(at(12).minutes);
    expect(at(20).minutes).toBeLessThan(PRIOR * 0.6);
  });

  it("E. a 300-minute outlier among 20–30 minute sessions does not drag the estimate", () => {
    const base = (m: number) => m / BASIC_WORK;
    const withOutlier = estimateNew(samplesOf([20, 25, 30, 300].map(base)));
    const without = estimateNew(samplesOf([20, 25, 30, 30].map(base)));
    const mean = estimateNew(samplesOf(Array(4).fill(base((20 + 25 + 30 + 300) / 4))));
    expect(withOutlier.minutes).toBeCloseTo(without.minutes, 0);
    expect(withOutlier.minutes).toBeLessThan(mean.minutes * 0.7);
  });

  it("F. falls back topic → category → subject → global → prior", () => {
    const cat = (i: number) => ref(`c${i}`, "cat", "math");
    const sub = (i: number) => ref(`s${i}`, "other-cat", "math");
    const glob = (i: number) => ref(`g${i}`, "x", "physics");
    const est = (samples: SpeedSample[], r = ref("q", "cat", "math")) =>
      createSpeedEstimator(samples)(r);

    expect(est([]).source).toBe("prior");
    expect(est(samplesOf([60], glob)).source).toBe("global");
    expect(est(samplesOf([60, 60, 60], sub)).source).toBe("subject");
    expect(est([...samplesOf([60, 60, 60], sub), ...samplesOf([60, 60], cat)]).source).toBe(
      "subject", // 2 < minSamplesByLevel.category
    );
    expect(est(samplesOf([60, 60, 60], cat)).source).toBe("category");
    const own = est(samplesOf([60, 60, 60, 300], (i) => (i === 3 ? ref("q", "cat") : cat(i))));
    expect(own.source).toBe("topic");
    expect(own.samples).toBe(1);
  });

  it("is deterministic and uses the median", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    const s = samplesOf([50, 80, 200, 90, 60]);
    expect(estimateNew(s)).toEqual(estimateNew(s.slice().reverse()));
  });
});

/* ------------------------------ remaining ------------------------------ */

describe("remaining work", () => {
  it("G. 未学習 > 学習中 > 基本OK > 定着 > 過去問レベル (= 0)", () => {
    const r = ([0, 1, 2, 3, 4] as Status[]).map((s) => topicRemainingMinutes(100, s));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThan(r[i - 1] as number);
    expect(r[4]).toBe(0);
    expect(topicRemainingMinutes(Number.NaN, 0)).toBe(0);
  });
});

/* ------------------------ pace / ETA / risk units ------------------------ */

const EXAM = "2027-07-03";
const required = (remaining: number, now = NOW) =>
  estimateRequiredPace({ remainingMinutes: remaining, examDate: EXAM, now });

describe("pace, required pace, ETA, margin", () => {
  it("falls back to the planned pace with too little history (boundary minTrackedDaysForPace)", () => {
    const min = FORECAST_CONFIG.minTrackedDaysForPace;
    const input = { minutesInWindow: 300, plannedMinutesPerWeek: 288 };
    expect(estimateCurrentPace({ ...input, trackedDays: min - 1 })).toEqual({
      minutesPerWeek: 288,
      source: "plan",
      days: 0,
    });
    expect(estimateCurrentPace({ ...input, trackedDays: min })).toEqual({
      minutesPerWeek: (300 / min) * 7,
      source: "actual",
      days: min,
    });
    // averaged over the window, not over the whole history
    expect(estimateCurrentPace({ ...input, trackedDays: 60 }).minutesPerWeek).toBeCloseTo(
      (300 / FORECAST_CONFIG.paceWindowDays) * 7,
    );
  });

  it("required pace = remaining ÷ weeks until exam − reserve", () => {
    const r = required(7000);
    expect(r.completionTarget).toBe(addDaysKey(EXAM, -FORECAST_CONFIG.examPrepReserveDays));
    expect(r.completionTarget).toBe("2027-06-03");
    expect(r.usableDays).toBe(256);
    expect(r.minutesPerWeek).toBeCloseTo((7000 / 256) * 7);
  });

  it("H. no pace → no completion date (never a far-future date)", () => {
    for (const pace of [0, -3, FORECAST_CONFIG.minimumPaceForEta - 0.5, Number.NaN]) {
      const eta = estimateCompletionDate({
        remainingMinutes: 3000,
        minutesPerWeek: pace,
        now: NOW,
      });
      expect(eta).toEqual({ status: "no_pace", date: null, daysNeeded: null });
      expect(calculateScheduleMargin("2027-06-03", eta)).toBeNull();
    }
    const far = estimateCompletionDate({ remainingMinutes: 1e7, minutesPerWeek: 60, now: NOW });
    expect(far.status).toBe("too_far");
    expect(far.date).toBeNull();
  });

  it("gives a calendar date and a signed margin", () => {
    const eta = estimateCompletionDate({ remainingMinutes: 700, minutesPerWeek: 350, now: NOW });
    expect(eta).toEqual({ status: "ok", date: "2026-10-04", daysNeeded: 14 });
    expect(calculateScheduleMargin("2026-10-10", eta)).toBe(6);
    expect(calculateScheduleMargin("2026-09-30", eta)).toBe(-4);
    expect(formatMargin(6)).toBe("6日先行");
    expect(formatMargin(-4)).toBe("4日遅れ");
    expect(formatMargin(3)).toBe("予定通り");
  });

  it("I. nothing left → done, required 0", () => {
    const r = required(0);
    expect(r.minutesPerWeek).toBe(0);
    const eta = estimateCompletionDate({ remainingMinutes: 0, minutesPerWeek: 0, now: NOW });
    expect(eta.status).toBe("done");
    const pace = { minutesPerWeek: 0, source: "actual" as const, days: 14 };
    expect(
      calculateDeadlineRisk({ remainingMinutes: 0, topicCount: 5, required: r, pace }).level,
    ).toBe("done");
  });

  it("J. inside the reserve period (usable days ≤ 0) → overdue, no NaN", () => {
    const examIn20 = parseDayKey(addDaysKey(EXAM, -20)) + 12 * 3_600_000;
    const r = required(3000, examIn20);
    expect(r.usableDays).toBe(-10);
    expect(r.minutesPerWeek).toBeNull();
    const pace = { minutesPerWeek: 300, source: "actual" as const, days: 14 };
    expect(
      calculateDeadlineRisk({ remainingMinutes: 3000, topicCount: 5, required: r, pace }),
    ).toEqual({
      level: "overdue",
      pressure: null,
    });
    const onDay = required(3000, parseDayKey("2027-06-03") + 1000);
    expect(onDay.usableDays).toBe(0);
    expect(onDay.minutesPerWeek).toBeNull();
  });

  it("K/L. risk levels follow pressure = required ÷ pace (boundaries)", () => {
    const risk = (pressure: number) =>
      calculateDeadlineRisk({
        remainingMinutes: 1000,
        topicCount: 3,
        required: {
          completionTarget: "2027-06-03",
          usableDays: 100,
          minutesPerWeek: pressure * 100,
        },
        pace: { minutesPerWeek: 100, source: "actual", days: 14 },
      }).level;
    const t = FORECAST_CONFIG.riskThresholds;
    expect(risk(0.5)).toBe("ahead");
    expect(risk(t.ahead)).toBe("ahead");
    expect(risk(t.ahead + 0.01)).toBe("on_track");
    expect(risk(t.onTrack)).toBe("on_track");
    expect(risk(t.onTrack + 0.01)).toBe("caution");
    expect(risk(t.caution)).toBe("caution");
    expect(risk(t.caution + 0.01)).toBe("behind");
  });

  it("no pace: 'insufficient' on a plan, 'behind' when records show no study", () => {
    const r = required(1000);
    const zero = (source: "plan" | "actual") =>
      calculateDeadlineRisk({
        remainingMinutes: 1000,
        topicCount: 3,
        required: r,
        pace: { minutesPerWeek: 0, source, days: 0 },
      }).level;
    expect(zero("plan")).toBe("insufficient");
    expect(zero("actual")).toBe("behind");
    expect(
      calculateDeadlineRisk({
        remainingMinutes: 0,
        topicCount: 0,
        required: r,
        pace: { minutesPerWeek: 0, source: "plan", days: 0 },
      }).level,
    ).toBe("insufficient");
  });

  it("M. confidence rises with samples and history, never high on a plan", () => {
    const c = (
      subjectSamples: number,
      daysSinceFirstRecord: number,
      paceSource: "plan" | "actual" = "actual",
    ) => calculatePredictionConfidence({ subjectSamples, daysSinceFirstRecord, paceSource });
    const { medium, high } = FORECAST_CONFIG.confidenceThresholds;
    expect(c(0, 30)).toBe("low");
    expect(c(medium.samples, medium.days)).toBe("medium");
    expect(c(medium.samples - 1, 30)).toBe("low");
    expect(c(medium.samples, medium.days - 1)).toBe("low");
    expect(c(high.samples, high.days)).toBe("high");
    expect(c(high.samples, high.days - 1)).toBe("medium");
    expect(c(50, 100, "plan")).toBe("low");
  });

  it("formats defensively", () => {
    expect(formatHours(Number.NaN)).toBe("—");
    expect(formatHours(Infinity)).toBe("—");
    expect(formatHours(45)).toBe("45分");
    expect(formatHours(90)).toBe("1.5時間");
    expect(formatHours(5160)).toBe("86時間");
    expect(formatMargin(null)).toBe("—");
  });
});

/* ----------------------- scenarios on the real seed ----------------------- */

let db: HenyuDB;
let repo: DexieRepository;
beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onblocked = req.onerror = () => resolve();
  });
  db = new HenyuDB();
  repo = new DexieRepository(db);
});
afterEach(() => repo.close());

async function seeded(): Promise<StudySnapshot> {
  await repo.initialize();
  return { ...(await repo.getSnapshot()), dailyGoals: [] };
}
const topicIdsOf = (snap: StudySnapshot, subjectId: string) => {
  const cats = snap.categories
    .filter((c) => c.subjectId === subjectId)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.id);
  return snap.topics
    .filter((t) => cats.includes(t.categoryId))
    .sort((a, b) => cats.indexOf(a.categoryId) - cats.indexOf(b.categoryId) || a.order - b.order)
    .map((t) => t.id);
};

/** topics learned to 基本OK with `minutes` each, one per day going back from `daysAgo` */
function learned(
  snap: StudySnapshot,
  subjectId: string,
  count: number,
  minutes: number,
  now = NOW,
) {
  const ids = topicIdsOf(snap, subjectId).slice(0, count);
  const sessions: StudySession[] = [];
  const logs: ActivityLog[] = [];
  ids.forEach((id, i) => {
    const s = session(id, subjectId, 1 + (i % 13), minutes, now);
    sessions.push(s);
    logs.push(statusLog(id, 0, 1, s.startedAt + 1000), statusLog(id, 1, 2, s.endedAt + 1000));
  });
  return { ids, sessions, logs };
}
function withHistory(
  snap: StudySnapshot,
  parts: { ids: string[]; sessions: StudySession[]; logs: ActivityLog[] }[],
  extraSessions: StudySession[] = [],
): StudySnapshot {
  const basic = new Set(parts.flatMap((p) => p.ids));
  return {
    ...snap,
    topics: snap.topics.map((t) => (basic.has(t.id) ? { ...t, status: 2 as Status } : t)),
    sessions: [...parts.flatMap((p) => p.sessions), ...extraSessions],
    statusLogs: parts.flatMap((p) => p.logs),
  };
}
const daily = (subjectId: string, minutes: number, fromDay: number, toDay: number, now = NOW) =>
  Array.from({ length: toDay - fromDay + 1 }, (_, i) =>
    session(null, subjectId, fromDay + i, minutes, now),
  );
const forecastOf = (snap: StudySnapshot, now = NOW): StudyForecast =>
  buildForecast(buildStudyModel(snap, now));

describe("scenario fixtures", () => {
  it("1. new user: prior-based, provisional, low confidence, no NaN", async () => {
    const f = forecastOf(await seeded());
    expect(f.subjects).toHaveLength(8);
    expect(allNumbersFinite(f)).toEqual([]);
    for (const s of f.subjects) {
      expect(s.pace.source).toBe("plan");
      expect(s.confidence).toBe("low");
      expect(s.provisional).toBe(true);
      expect(s.speed.source).toBe("prior");
      expect(dashboardStatus(s).label).toBe("データ不足");
    }
    const math = f.bySubject.get("subj_math")!;
    expect(math.remainingMinutes).toBeCloseTo(math.topicCount * PRIOR);
    expect(math.plannedMinutesPerWeek).toBeCloseTo(480 * 0.6);
  });

  it("2. math learned fast for two weeks → ahead, observed speed, higher confidence", async () => {
    const snap = await seeded();
    const fast = learned(snap, "subj_math", 12, 30);
    const f = forecastOf(withHistory(snap, [fast], daily("subj_math", 40, 1, 14)));
    const math = f.bySubject.get("subj_math")!;
    expect(math.speed.samples).toBe(12);
    expect(math.speed.source).toBe("subject");
    expect(math.speed.topicMinutes).toBeLessThan(PRIOR * 0.6);
    expect(math.pace.source).toBe("actual");
    expect(math.risk.level).toBe("ahead");
    expect(math.marginDays).toBeGreaterThan(0);
    expect(math.confidence).toBe("high");
    expect(dashboardStatus(math).label).toBe("余裕あり");
    expect(allNumbersFinite(f)).toEqual([]);
  });

  it("3. math slow and little time → behind with a negative margin", async () => {
    const snap = await seeded();
    const slow = learned(snap, "subj_math", 3, 150);
    // two weeks of records, math only on the 3 slow topics
    const f = forecastOf(withHistory(snap, [slow], daily("subj_english", 10, 1, 14)));
    const math = f.bySubject.get("subj_math")!;
    expect(math.speed.topicMinutes).toBeGreaterThan(PRIOR);
    expect(math.risk.level).toBe("behind");
    expect(math.marginDays === null || math.marginDays < 0).toBe(true);
    expect(math.confidence).toBe("medium");
  });

  it("4. physics untouched while studying other subjects → behind, no completion date", async () => {
    const snap = await seeded();
    const f = forecastOf(withHistory(snap, [], daily("subj_math", 60, 1, 14)));
    const physics = f.bySubject.get("subj_physics")!;
    expect(physics.pace).toMatchObject({ source: "actual", minutesPerWeek: 0 });
    expect(physics.eta.status).toBe("no_pace");
    expect(formatEta(physics)).toBe("現在のペースでは算出不能");
    expect(physics.risk.level).toBe("behind");
    expect(physics.confidence).toBe("low");
  });

  it("5. every subject at the required pace → on track", async () => {
    const snap = await seeded();
    const base = forecastOf(snap);
    const sessions = base.subjects.flatMap((s) =>
      daily(s.subjectId, (s.required.minutesPerWeek ?? 0) / 7, 1, 14),
    );
    const f = forecastOf({ ...snap, sessions });
    for (const s of f.subjects) {
      expect(s.risk.level).toBe("on_track");
      expect(Math.abs(s.marginDays ?? 99)).toBeLessThanOrEqual(3);
      expect(formatMargin(s.marginDays)).toBe("予定通り");
    }
  });

  it("6. a week off halves the recent pace instead of breaking", async () => {
    const snap = await seeded();
    const steady = forecastOf({ ...snap, sessions: daily("subj_math", 60, 1, 14) });
    const paused = forecastOf({ ...snap, sessions: daily("subj_math", 60, 8, 14) });
    const a = steady.bySubject.get("subj_math")!;
    const b = paused.bySubject.get("subj_math")!;
    expect(b.pace.minutesPerWeek).toBeCloseTo(a.pace.minutesPerWeek / 2);
    expect(["caution", "behind"]).toContain(b.risk.level);
    expect(allNumbersFinite(paused)).toEqual([]);
  });

  it("7/8. 30 and 10 days before the exam → overdue, safe output", async () => {
    const snap = await seeded();
    for (const before of [30, 10]) {
      const now = parseDayKey(addDaysKey(EXAM, -before)) + 20 * 3_600_000;
      const f = forecastOf({ ...snap, sessions: daily("subj_math", 60, 1, 14, now) }, now);
      const math = f.bySubject.get("subj_math")!;
      expect(math.required.usableDays).toBe(30 - before === 0 ? 0 : -(30 - before));
      expect(math.risk.level).toBe("overdue");
      expect(math.required.minutesPerWeek).toBeNull();
      expect(allNumbersFinite(f)).toEqual([]);
    }
  });

  it("I. a subject with every topic at 過去問レベル is complete", async () => {
    const snap = await seeded();
    const interview = new Set(topicIdsOf(snap, "subj_interview"));
    const f = forecastOf({
      ...snap,
      topics: snap.topics.map((t) => (interview.has(t.id) ? { ...t, status: 4 as Status } : t)),
    });
    const s = f.bySubject.get("subj_interview")!;
    expect(s.remainingMinutes).toBe(0);
    expect(s.required.minutesPerWeek).toBe(0);
    expect(s.eta.status).toBe("done");
    expect(s.risk.level).toBe("done");
    expect(s.provisional).toBe(false);
    expect(dashboardStatus(s).label).toBe("完了");
  });

  it("leaves out archived topics and hidden / archived subjects", async () => {
    const snap = await seeded();
    const math = topicIdsOf(snap, "subj_math");
    const full = forecastOf(snap).bySubject.get("subj_math")!;
    const f = forecastOf({
      ...snap,
      topics: snap.topics.map((t) => (t.id === math[0] ? { ...t, archived: true } : t)),
      subjects: snap.subjects.map((s) => (s.id === "subj_cs" ? { ...s, hidden: true } : s)),
    });
    expect(f.bySubject.get("subj_math")!.topicCount).toBe(full.topicCount - 1);
    expect(f.bySubject.has("subj_cs")).toBe(false);
  });

  it("N. same snapshot and now → identical forecast", async () => {
    const snap = await seeded();
    const hist = withHistory(
      snap,
      [learned(snap, "subj_math", 5, 45)],
      daily("subj_english", 20, 1, 10),
    );
    expect(forecastOf(hist)).toEqual(forecastOf(hist));
    expect(forecastOf({ ...hist, sessions: hist.sessions.slice().reverse() })).toEqual(
      forecastOf(hist),
    );
  });
});

describe("dashboard selection", () => {
  it("shows the 第一志望's subjects by importance, at most 4", async () => {
    const snap = await seeded();
    const model = buildStudyModel(snap, NOW);
    const f = buildForecast(model);
    const picked = pickDashboardSubjects(f.subjects, model.primaryUniversity?.requirements ?? []);
    expect(picked.length).toBeLessThanOrEqual(4);
    expect(picked[0]?.subjectId).toBe("subj_math");
    const required = new Set(
      (model.primaryUniversity?.requirements ?? [])
        .filter((r) => r.weight > 0)
        .map((r) => r.subjectId),
    );
    expect(picked.every((p) => required.has(p.subjectId))).toBe(true);
    // no 第一志望 → by planned time
    expect(pickDashboardSubjects(f.subjects, [])[0]?.subjectId).toBe("subj_math");
  });
});
