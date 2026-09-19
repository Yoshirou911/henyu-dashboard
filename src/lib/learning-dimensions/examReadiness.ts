import { DAY_MS, parseDayKey, startOfDay } from "@/lib/date";
import {
  EXAM_READINESS_CONFIG,
  type EvidenceTier,
  type ExamReadinessConfig,
} from "@/lib/learning-dimensions/config";
import type {
  EvaluationType,
  ExerciseResult,
  MockExam,
  PastExam,
  PastExamProblem,
  Review,
} from "@/lib/types";

/*
 * Exam readiness (Phase 3.1) — pure functions, all inputs explicit, no clock
 * reads. Readiness is "how much stored evidence shows exam-format ability",
 * never a pass probability.
 *
 *   baseline    = mastery × noExamEvidenceFactor
 *   examShare   = min(1, examStrength / fullExamStrength, records × maxSharePerRecord)
 *   readiness   = (1 − examShare) × baseline + examShare × examPerformance − mockPenalty
 *
 * Categories / subjects take the topic-weighted mean; subjects then blend in
 * whole papers (過去問・模試の総得点) with paperShare ≤ maxPaperShare.
 */

export interface EvidenceItem {
  tier: EvidenceTier;
  /** 0–1 success rate of this piece of evidence */
  rate: number;
  /** problem-equivalents */
  units: number;
  at: number;
  /** identity of the record, for counting distinct records (one paper = one record) */
  recordKey: string;
  /** "<exam>:<year>" for past papers — distinct years */
  yearKey?: string;
}

export type EvidenceConfidence = "low" | "medium" | "high";

export interface TierSummary {
  records: number;
  units: number;
  /** unit-weighted success rate, null without evidence */
  rate: number | null;
}

export interface EvidenceSummary {
  /** Σ tier weight × recency × units over every tier (display / comparison) */
  strength: number;
  /** same, exam-format tiers only */
  examStrength: number;
  /** exam-format strength without the recency discount */
  examStrengthRaw: number;
  /** recency-weighted success rate on exam-format evidence, 0–1 */
  examPerformance: number | null;
  /** distinct exam-format records */
  examRecords: number;
  /** distinct records of the strongest tier (past papers / mock interviews) */
  strongRecords: number;
  /** distinct past-paper years */
  years: number;
  /** examStrength / examStrengthRaw (1 = all recent); null without exam evidence */
  recentShare: number | null;
  byTier: Record<EvidenceTier, TierSummary>;
}

export interface ExamReadinessResult {
  /** 0–100 */
  score: number;
  /** mastery × noExamEvidenceFactor — what readiness is without exam evidence */
  baseline: number;
  /** 0–1: how far the exam-format evidence replaced the baseline */
  examShare: number;
  /** 0–100, null without exam-format evidence */
  examPerformance: number | null;
  /** points taken off for topics a mock exam flagged */
  mockPenalty: number;
  confidence: EvidenceConfidence;
  evidence: EvidenceSummary;
}

const TIERS: EvidenceTier[] = [
  "practice",
  "advanced",
  "review",
  "past_exam_level",
  "mock",
  "past_exam",
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const rateOf = (correct: number, total: number) =>
  total > 0 && Number.isFinite(correct) ? clamp(correct / total, 0, 1) : null;

/** "YYYY-MM-DD" → local midnight, or the fallback for a malformed key */
export function dayKeyTime(key: string | undefined, fallback: number): number {
  const t = key && /^\d{4}-\d{1,2}-\d{1,2}$/.test(key) ? parseDayKey(key) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

/** weight of evidence by age: recent counts fully, older evidence less */
export function recencyFactor(
  at: number,
  now: number,
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): number {
  if (!Number.isFinite(at)) return cfg.recency.older;
  const days = Math.floor((startOfDay(now) - startOfDay(at)) / DAY_MS);
  for (const b of cfg.recency.buckets) if (days <= b.maxDays) return b.factor;
  return cfg.recency.older;
}

/** evidence tier of one recorded result set */
export function tierOfResult(r: Pick<ExerciseResult, "type" | "difficulty">): EvidenceTier {
  if (r.type === "past_exam") return "past_exam";
  if (r.type === "mock") return "mock";
  if (r.difficulty === "past_exam") return "past_exam_level";
  if (r.type === "review") return "review";
  if (r.difficulty === "advanced") return "advanced";
  return "practice";
}

const PROBLEM_RESULT_RATE = { correct: 1, partial: 0.5, wrong: 0 } as const;

/** a past-paper question's rate: its score when recorded, else correct / partial / wrong */
export function problemRate(p: Pick<PastExamProblem, "result" | "score" | "maxScore">): number {
  const scored =
    p.score !== undefined && p.maxScore !== undefined ? rateOf(p.score, p.maxScore) : null;
  return scored ?? PROBLEM_RESULT_RATE[p.result] ?? 0;
}

const yearKeyOf = (paper: Pick<PastExam, "universityId" | "examLabel" | "subject" | "year">) =>
  `${paper.universityId ?? paper.examLabel ?? paper.subject}:${paper.year}`;

/**
 * Evidence recorded against one topic: result sets, completed reviews and
 * tagged past-paper questions. Anything dated after `now` is ignored.
 */
export function collectTopicEvidence(
  input: {
    evaluationType: EvaluationType;
    results: readonly ExerciseResult[];
    reviews: readonly Review[];
    problems: readonly PastExamProblem[];
    pastExamById: ReadonlyMap<string, PastExam>;
    now: number;
  },
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  for (const r of input.results) {
    const rate = rateOf(r.correctCount, r.attemptedCount);
    if (rate === null || !(r.at <= input.now)) continue;
    const units =
      input.evaluationType === "interview"
        ? cfg.interviewRecordUnits
        : Math.min(cfg.maxUnitsPerResult, r.attemptedCount);
    items.push({ tier: tierOfResult(r), rate, units, at: r.at, recordKey: `er:${r.id}` });
  }
  for (const rv of input.reviews) {
    if (!rv.completedAt || !rv.outcome || rv.completedAt > input.now) continue;
    const rate = rv.outcome === "got" ? 1 : rv.outcome === "shaky" ? 0.5 : 0;
    items.push({ tier: "review", rate, units: 1, at: rv.completedAt, recordKey: `rv:${rv.id}` });
  }
  if (input.evaluationType !== "interview") {
    for (const p of input.problems) {
      const paper = input.pastExamById.get(p.pastExamId);
      if (!paper) continue;
      const at = dayKeyTime(paper.date, paper.createdAt);
      if (at > input.now) continue;
      items.push({
        tier: "past_exam",
        rate: problemRate(p),
        units: cfg.pastExamProblemUnits,
        at,
        recordKey: `pe:${paper.id}`,
        yearKey: yearKeyOf(paper),
      });
    }
  }
  return items;
}

/**
 * Whole-paper evidence for a subject: past-paper and mock-exam totals. A
 * total score is both positive and negative evidence — unlike a mock's
 * weak-topic list, which only says where points were lost.
 */
export function collectPaperEvidence(
  input: {
    evaluationType: EvaluationType;
    pastExams: readonly PastExam[];
    mockExams: readonly MockExam[];
    now: number;
  },
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): EvidenceItem[] {
  // 面接 has no paper to score; a stray record must not turn into math-style evidence
  if (input.evaluationType === "interview") return [];
  const items: EvidenceItem[] = [];
  for (const p of input.pastExams) {
    const rate = rateOf(p.score, p.maxScore);
    const at = dayKeyTime(p.date, p.createdAt);
    if (rate === null || at > input.now) continue;
    items.push({
      tier: "past_exam",
      rate,
      units: cfg.paperUnits,
      at,
      recordKey: `pe:${p.id}`,
      yearKey: yearKeyOf(p),
    });
  }
  for (const m of input.mockExams) {
    const rate = rateOf(m.score, m.maxScore);
    const at = dayKeyTime(m.examDate, m.createdAt);
    if (rate === null || at > input.now) continue;
    items.push({ tier: "mock", rate, units: cfg.paperUnits, at, recordKey: `mk:${m.id}` });
  }
  return items;
}

export function summarizeEvidence(
  items: readonly EvidenceItem[],
  evaluationType: EvaluationType,
  now: number,
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): EvidenceSummary {
  const examTiers = new Set(cfg.examTiers[evaluationType]);
  const strongest = cfg.strongestTier[evaluationType];
  const acc = new Map<EvidenceTier, { records: Set<string>; units: number; hits: number }>();
  let strength = 0;
  let examStrength = 0;
  let examStrengthRaw = 0;
  let examHits = 0;
  const examRecords = new Set<string>();
  const strongRecords = new Set<string>();
  const years = new Set<string>();

  for (const it of items) {
    const units = Math.max(0, finite(it.units));
    const rate = clamp(finite(it.rate), 0, 1);
    const tierWeight = cfg.evidenceWeights[it.tier] ?? 0;
    const w = tierWeight * recencyFactor(it.at, now, cfg) * units;
    strength += w;
    const t = acc.get(it.tier) ?? { records: new Set<string>(), units: 0, hits: 0 };
    t.records.add(it.recordKey);
    t.units += units;
    t.hits += units * rate;
    acc.set(it.tier, t);
    if (!examTiers.has(it.tier) || units === 0) continue;
    examStrength += w;
    examStrengthRaw += tierWeight * units;
    examHits += w * rate;
    examRecords.add(it.recordKey);
    if (it.tier === strongest) {
      strongRecords.add(it.recordKey);
      if (it.yearKey) years.add(it.yearKey);
    }
  }

  const byTier = Object.fromEntries(
    TIERS.map((tier) => {
      const t = acc.get(tier);
      return [
        tier,
        {
          records: t?.records.size ?? 0,
          units: t?.units ?? 0,
          rate: t && t.units > 0 ? t.hits / t.units : null,
        },
      ];
    }),
  ) as Record<EvidenceTier, TierSummary>;

  return {
    strength,
    examStrength,
    examStrengthRaw,
    examPerformance: examStrength > 0 ? examHits / examStrength : null,
    examRecords: examRecords.size,
    strongRecords: strongRecords.size,
    years: years.size,
    recentShare: examStrengthRaw > 0 ? examStrength / examStrengthRaw : null,
    byTier,
  };
}

/** how far exam-format evidence may replace the baseline (never all of it from one record) */
export function calculateExamShare(input: {
  strength: number;
  records: number;
  fullStrength: number;
  maxSharePerRecord: number;
}): number {
  if (!(input.strength > 0) || !(input.records > 0) || !(input.fullStrength > 0)) return 0;
  return clamp(
    Math.min(input.strength / input.fullStrength, input.records * input.maxSharePerRecord),
    0,
    1,
  );
}

/**
 * 低 / 中 / 高. 高 needs several recent records of the strongest tier
 * (past papers across years; mock interviews for 面接), so it can never be
 * reached without past papers.
 */
export function calculateExamEvidenceConfidence(
  summary: Pick<EvidenceSummary, "examRecords" | "strongRecords" | "years" | "recentShare">,
  evaluationType: EvaluationType,
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): EvidenceConfidence {
  const c = cfg.confidence;
  const yearsOk = evaluationType === "interview" || summary.years >= c.highYears;
  if (
    summary.strongRecords >= c.highStrongRecords &&
    yearsOk &&
    (summary.recentShare ?? 0) >= c.highRecentShare
  ) {
    return "high";
  }
  if (summary.examRecords >= c.mediumRecords) return "medium";
  return "low";
}

/** 模試で失点した単元: negative-only evidence — a missing flag is *not* a success */
export function calculateMockPenalty(
  flaggedAt: readonly number[],
  now: number,
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): number {
  const raw = flaggedAt
    .filter((at) => !(at > now))
    .reduce((s, at) => s + recencyFactor(at, now, cfg) * cfg.mockWeakPenalty, 0);
  return Math.min(cfg.mockWeakCap, raw);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Topic readiness: the topic's own evidence on top of its (existing) mastery score. */
export function calculateTopicExamReadiness(
  input: {
    mastery: number;
    evaluationType: EvaluationType;
    items: readonly EvidenceItem[];
    mockFlaggedAt: readonly number[];
    now: number;
  },
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): ExamReadinessResult {
  const evidence = summarizeEvidence(input.items, input.evaluationType, input.now, cfg);
  const baseline = clamp(finite(input.mastery), 0, 100) * cfg.noExamEvidenceFactor;
  const examShare = calculateExamShare({
    strength: evidence.examStrength,
    records: evidence.examRecords,
    fullStrength: cfg.fullExamStrength,
    maxSharePerRecord: cfg.maxSharePerRecord,
  });
  const perf = evidence.examPerformance === null ? null : evidence.examPerformance * 100;
  const mockPenalty = calculateMockPenalty(input.mockFlaggedAt, input.now, cfg);
  const blended = (1 - examShare) * baseline + examShare * (perf ?? 0);
  return {
    score: round1(clamp(blended - mockPenalty, 0, 100)),
    baseline: round1(baseline),
    examShare,
    examPerformance: perf === null ? null : round1(perf),
    mockPenalty: round1(mockPenalty),
    confidence: calculateExamEvidenceConfidence(evidence, input.evaluationType, cfg),
    evidence,
  };
}

/**
 * Subject / category readiness: the weighted topic readiness, with whole
 * papers (過去問・模試の総得点) blended on top at subject level. Confidence
 * looks at all of the subject's evidence together.
 */
export function calculateAggregateExamReadiness(
  input: {
    /** weighted mean of topic readiness */
    topicReadiness: number;
    /** weighted mean of topic baselines (mastery × factor) */
    topicBaseline: number;
    /** weighted mean of topic exam shares */
    topicExamShare: number;
    evaluationType: EvaluationType;
    /** every topic item in scope plus paper items */
    topicItems: readonly EvidenceItem[];
    paperItems: readonly EvidenceItem[];
    mockPenalty: number;
    now: number;
  },
  cfg: ExamReadinessConfig = EXAM_READINESS_CONFIG,
): ExamReadinessResult {
  const papers = summarizeEvidence(input.paperItems, input.evaluationType, input.now, cfg);
  const evidence = summarizeEvidence(
    [...input.topicItems, ...input.paperItems],
    input.evaluationType,
    input.now,
    cfg,
  );
  const paperShare = Math.min(
    cfg.maxPaperShare,
    calculateExamShare({
      strength: papers.examStrength,
      records: papers.examRecords,
      fullStrength: cfg.fullPaperStrength,
      maxSharePerRecord: cfg.maxSharePerPaper,
    }),
  );
  const paperPerf = papers.examPerformance === null ? null : papers.examPerformance * 100;
  const topic = clamp(finite(input.topicReadiness), 0, 100);
  const score = (1 - paperShare) * topic + paperShare * (paperPerf ?? 0);
  const topicShare = clamp(finite(input.topicExamShare), 0, 1);
  return {
    score: round1(clamp(score, 0, 100)),
    baseline: round1(clamp(finite(input.topicBaseline), 0, 100)),
    examShare: paperShare + (1 - paperShare) * topicShare,
    examPerformance:
      evidence.examPerformance === null ? null : round1(evidence.examPerformance * 100),
    mockPenalty: round1(input.mockPenalty),
    confidence: calculateExamEvidenceConfidence(evidence, input.evaluationType, cfg),
    evidence,
  };
}
