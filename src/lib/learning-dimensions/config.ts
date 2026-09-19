import type { EvaluationType, Status } from "@/lib/types";

/**
 * Learning dimensions (Phase 3.1): 学習範囲 (coverage) / 習熟度 (mastery) /
 * 本番準備度 (exam readiness). Display only — the planner never reads them.
 * Every value is a starting guess to be tuned on real data.
 */

export const COVERAGE_CONFIG = {
  /** how much of a topic counts as "studied at least once", by status */
  statusCoverageFactor: { 0: 0, 1: 0.5, 2: 1, 3: 1, 4: 1 } as Record<Status, number>,
};

export type CoverageConfig = typeof COVERAGE_CONFIG;

/**
 * Evidence tiers, weakest first. `practice` / `advanced` / `review` already
 * move the existing mastery score, so they only count towards the displayed
 * evidence strength; the exam-level tiers are what lift or lower readiness.
 */
export type EvidenceTier =
  | "practice" // 基本・標準の通常演習
  | "advanced" // 発展問題
  | "review" // 復習（記録・復習カード）
  | "past_exam_level" // 過去問レベルの問題（通常演習として記録）
  | "mock" // 模試・模擬面接
  | "past_exam"; // 編入過去問

export const EXAM_READINESS_CONFIG = {
  /** evidence strength per problem-equivalent, by tier */
  evidenceWeights: {
    practice: 0.2,
    advanced: 0.4,
    review: 0.5,
    past_exam_level: 0.6,
    mock: 0.8,
    past_exam: 1,
  } as Record<EvidenceTier, number>,
  /** tiers that count as exam-format evidence, by evaluation type */
  examTiers: {
    problem: ["past_exam_level", "mock", "past_exam"],
    language: ["past_exam_level", "mock", "past_exam"],
    // 面接: only mock interviews resemble the real thing
    interview: ["mock"],
  } as Record<EvaluationType, EvidenceTier[]>,
  /** the tier that can make confidence "high" */
  strongestTier: { problem: "past_exam", language: "past_exam", interview: "mock" } as Record<
    EvaluationType,
    EvidenceTier
  >,
  /** readiness without exam-format evidence = mastery × this */
  noExamEvidenceFactor: 0.5,
  /** exam-format strength that fully replaces the mastery baseline */
  fullExamStrength: 12,
  /** one record (one paper / one result set) can move at most this share */
  maxSharePerRecord: 0.35,
  /** problem-equivalents: one 過去問の大問, a result set is capped, an interview record */
  pastExamProblemUnits: 3,
  maxUnitsPerResult: 10,
  interviewRecordUnits: 4,
  /** subject level: whole papers (過去問・模試の総得点) */
  paperUnits: 10,
  fullPaperStrength: 30,
  maxSharePerPaper: 0.3,
  /** whole-paper totals never fully replace the per-topic evidence */
  maxPaperShare: 0.7,
  /** 模試で失点した単元 — negative evidence only, points off readiness */
  mockWeakPenalty: 5,
  mockWeakCap: 15,
  /** age of the evidence → weight; older than the last bucket uses `older` */
  recency: {
    buckets: [
      { maxDays: 30, factor: 1 },
      { maxDays: 90, factor: 0.6 },
    ],
    older: 0.3,
  },
  /** evidence confidence (低 / 中 / 高) */
  confidence: {
    /** exam-format records needed for 中 */
    mediumRecords: 2,
    /** strongest-tier records (e.g. past papers) and distinct years needed for 高 */
    highStrongRecords: 3,
    highYears: 2,
    /** share of the exam evidence weight that must be recent (recency-adjusted / raw) */
    highRecentShare: 0.5,
  },
};

export type ExamReadinessConfig = typeof EXAM_READINESS_CONFIG;
