import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY_MS } from "@/lib/date";
import { DexieRepository } from "@/lib/db/dexie-repository";
import { DB_NAME, HenyuDB } from "@/lib/db/schema";
import { buildForecast } from "@/lib/forecast/buildForecast";
import { buildStudyModel } from "@/lib/model/buildStudyModel";
import type { StudySnapshot } from "@/lib/model/snapshot";
import type { StudySession } from "@/lib/types";

/*
 * Golden test for today's plan (Phase 3.0a behaviour). Forecasting (Phase
 * 3.0b) is display-only and must never change what the planner produces;
 * if this snapshot changes, the planner changed.
 */

const NOW = new Date("2026-09-20T21:00:00").getTime();
const T0 = new Date("2026-09-01T09:00:00").getTime();

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

function session(
  id: string,
  topicId: string | null,
  subjectId: string,
  daysAgo: number,
  min: number,
) {
  const startedAt = NOW - daysAgo * DAY_MS - 2 * 3_600_000;
  return {
    id,
    topicId,
    subjectId,
    startedAt,
    endedAt: startedAt + min * 60_000,
    durationSec: min * 60,
    source: "manual",
    createdAt: startedAt,
  } satisfies StudySession;
}

/** Seeded roadmap with a fixed, timestamp-normalised history. */
async function fixture(): Promise<StudySnapshot> {
  await repo.initialize();
  const snap = await repo.getSnapshot();
  const stamp = <T extends { createdAt?: number; updatedAt?: number }>(rows: T[]) =>
    rows.map((r) => ({ ...r, createdAt: T0, ...("updatedAt" in r ? { updatedAt: T0 } : {}) }));
  const topics = stamp(snap.topics).map((t) => {
    if (t.name === "展開") return { ...t, status: 3 as const, basicOkAt: T0, lastStatusUpAt: T0 };
    if (t.name === "因数分解")
      return { ...t, status: 1 as const, lastStatusUpAt: T0, lastStudiedAt: NOW - DAY_MS };
    if (t.name === "時制") return { ...t, status: 1 as const, lastStatusUpAt: T0 };
    return t;
  });
  const factor = topics.find((t) => t.name === "因数分解")!.id;
  const tense = topics.find((t) => t.name === "時制")!.id;
  return {
    ...snap,
    settings: { ...snap.settings, createdAt: T0, updatedAt: T0, onboardedAt: T0 },
    subjects: stamp(snap.subjects),
    categories: stamp(snap.categories),
    topics,
    sessions: [
      session("s1", factor, "subj_math", 1, 40),
      session("s2", factor, "subj_math", 3, 60),
      session("s3", tense, "subj_english", 2, 20),
      session("s4", null, "subj_physics", 9, 30),
      session("s5", factor, "subj_math", 0, 25),
    ],
    reviews: [
      {
        id: "rv1",
        topicId: topics.find((t) => t.name === "展開")!.id,
        dueAt: NOW - 2 * DAY_MS,
        stage: 1,
        createdAt: T0,
      },
    ],
    exerciseResults: [
      {
        id: "e1",
        topicId: factor,
        date: "2026-09-19",
        at: NOW - DAY_MS,
        attemptedCount: 8,
        correctCount: 5,
        difficulty: "basic",
        type: "practice",
        createdAt: NOW - DAY_MS,
      },
    ],
    universities: stamp(snap.universities),
    dailyGoals: [],
  };
}

const describePlan = (snapshot: StudySnapshot) => {
  const model = buildStudyModel(snapshot, NOW);
  return [30, 60, 90, 120, 180].map((m) => {
    const p = model.buildPlan(m);
    return [
      `${m}: total ${p.totalMinutes} done ${p.doneMinutes} avail ${p.availableMinutes} planned ${p.plannedMinutes}`,
      ...p.items.map(
        (i) =>
          `  ${i.kind} ${i.subjectName}/${i.topicName} ${i.minutes}分 ${i.task} [${i.reasons.join("・")}]`,
      ),
    ].join("\n");
  });
};

describe("today plan regression (Phase 3.0a)", () => {
  it("is unchanged for a fixed snapshot", async () => {
    expect(describePlan(await fixture())).toMatchInlineSnapshot(`
      [
        "30: total 30 done 25 avail 5 planned 0",
        "60: total 60 done 25 avail 35 planned 25
        review 数学/展開 10分 復習5問 [復習期限2日超過・第一志望で重要]
        learn 数学/因数分解 15分 基本問題5問 [今週 数学 -188分・第一志望で重要・現在学習中・弱点・1単元の前提]",
        "90: total 90 done 25 avail 65 planned 65
        review 数学/展開 10分 復習5問 [復習期限2日超過・第一志望で重要]
        learn 数学/因数分解 25分 基本問題5問 [今週 数学 -188分・第一志望で重要・現在学習中・弱点・1単元の前提]
        learn 物理/単位と次元 15分 導入・例題 [今週 物理 -48分・第一志望で重要・次の単元]
        learn 英語/時制 15分 演習 [第一志望で重要・現在学習中]",
        "120: total 120 done 25 avail 95 planned 85
        review 数学/展開 10分 復習5問 [復習期限2日超過・第一志望で重要]
        learn 数学/因数分解 45分 基本問題5問 [今週 数学 -188分・第一志望で重要・現在学習中・弱点・1単元の前提]
        learn 物理/単位と次元 15分 導入・例題 [今週 物理 -48分・第一志望で重要・次の単元]
        learn 英語/時制 15分 演習 [第一志望で重要・現在学習中]",
        "180: total 180 done 25 avail 155 planned 145
        review 数学/展開 10分 復習5問 [復習期限2日超過・第一志望で重要]
        learn 数学/因数分解 45分 基本問題5問 [今週 数学 -188分・第一志望で重要・現在学習中・弱点・1単元の前提]
        learn 物理/単位と次元 15分 導入・例題 [今週 物理 -48分・第一志望で重要・次の単元]
        learn 英語/時制 15分 演習 [第一志望で重要・現在学習中]
        learn 数学/方程式 30分 導入・例題 [第一志望で重要・次の単元]
        learn アルゴリズム/計算量 15分 導入・例題 [次の単元・2単元の前提]
        learn C/C++/変数・型 15分 導入・例題 [次の単元]",
      ]
    `);
  });

  it("does not depend on status history or on computing the forecast (Phase 3.0b)", async () => {
    const base = await fixture();
    const factor = base.topics.find((t) => t.name === "因数分解")!.id;
    const expand = base.topics.find((t) => t.name === "展開")!.id;
    const withLogs: StudySnapshot = {
      ...base,
      statusLogs: [
        {
          id: "l1",
          type: "status_change",
          at: T0,
          message: "",
          topicId: expand,
          meta: { from: 0, to: 2 },
        },
        {
          id: "l2",
          type: "status_change",
          at: T0 + DAY_MS,
          message: "",
          topicId: expand,
          meta: { from: 2, to: 3 },
        },
        {
          id: "l3",
          type: "status_change",
          at: NOW - 4 * DAY_MS,
          message: "",
          topicId: factor,
          meta: { from: 0, to: 1 },
        },
      ],
    };
    const expected = describePlan(base);
    expect(describePlan(withLogs)).toEqual(expected);

    const model = buildStudyModel(withLogs, NOW);
    const before = [30, 60, 120, 180].map((m) => model.buildPlan(m));
    const forecast = buildForecast(model);
    expect(forecast.subjects.length).toBeGreaterThan(0);
    expect([30, 60, 120, 180].map((m) => model.buildPlan(m))).toEqual(before);
  });
});
