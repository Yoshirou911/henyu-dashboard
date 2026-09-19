import {
  COVERAGE_CONFIG,
  EXAM_READINESS_CONFIG,
  type CoverageConfig,
  type ExamReadinessConfig,
} from "@/lib/learning-dimensions/config";
import {
  calculateAggregateExamReadiness,
  calculateTopicExamReadiness,
  collectPaperEvidence,
  collectTopicEvidence,
  dayKeyTime,
  type EvidenceConfidence,
  type EvidenceItem,
  type ExamReadinessResult,
} from "@/lib/learning-dimensions/examReadiness";
import type { StudyModel, TopicMetrics } from "@/lib/model/buildStudyModel";
import { subjectScore } from "@/lib/readiness/universityReadiness";
import type {
  EvaluationType,
  ID,
  PastExamProblem,
  Review,
  Status,
  Topic,
  UniversityRequirement,
} from "@/lib/types";

/*
 * Phase 3.1 — 学習範囲 / 習熟度 / 本番準備度, derived read-only from the study
 * model (same topic scope). Display only: the planner never reads these, and
 * nothing here is persisted.
 */

export interface LearningDimensions {
  /** 0–100: share of the range studied at least once (not a success rate) */
  coverage: number;
  /** 0–100: the existing mastery score, weighted over the range */
  mastery: number;
  /** 0–100: exam-format evidence on top of mastery (not a pass probability) */
  examReadiness: number;
  examEvidenceConfidence: EvidenceConfidence;
  /** how the readiness number was reached */
  readiness: ExamReadinessResult;
}

export interface TopicDimensions extends LearningDimensions {
  topicId: ID;
}

export interface CategoryDimensions extends LearningDimensions {
  categoryId: ID;
  name: string;
  topicCount: number;
}

export interface SubjectDimensions extends LearningDimensions {
  subjectId: ID;
  subjectName: string;
  evaluationType: EvaluationType;
  topicCount: number;
  categories: CategoryDimensions[];
}

export interface UniversityDimensionsBreakdown {
  subjectId: ID;
  required: boolean;
  /** normalised share, 0–1 (same weights as the existing readiness) */
  share: number;
  dimensions: SubjectDimensions;
}

export interface UniversityDimensions {
  universityId: ID;
  coverage: number;
  mastery: number;
  examReadiness: number;
  examEvidenceConfidence: EvidenceConfidence;
  breakdown: UniversityDimensionsBreakdown[];
}

export interface StudyDimensions {
  topics: Map<ID, TopicDimensions>;
  subjects: SubjectDimensions[];
  bySubject: Map<ID, SubjectDimensions>;
  universities: UniversityDimensions[];
  byUniversity: Map<ID, UniversityDimensions>;
  primary?: UniversityDimensions;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const weightOf = (t: Pick<Topic, "weight">) => (t.weight > 0 ? t.weight : 1);

/** one topic's coverage factor, 0–1 */
export function calculateTopicCoverage(
  status: Status,
  cfg: CoverageConfig = COVERAGE_CONFIG,
): number {
  return cfg.statusCoverageFactor[status] ?? 0;
}

/** Topic-weight-weighted coverage, 0–100 (0 for an empty list). */
export function calculateCoverage(
  topics: readonly Pick<Topic, "status" | "weight">[],
  cfg: CoverageConfig = COVERAGE_CONFIG,
): number {
  let sum = 0;
  let weights = 0;
  for (const t of topics) {
    const w = weightOf(t);
    sum += calculateTopicCoverage(t.status, cfg) * w;
    weights += w;
  }
  return weights > 0 ? round1((sum / weights) * 100) : 0;
}

/**
 * Mastery of a group = the existing weighted mean of topic mastery scores
 * (`subjectScore`, the same number the dashboard and university readiness use).
 */
export function calculateMasteryAggregate(metrics: readonly TopicMetrics[]): number {
  return subjectScore(
    metrics.map((m) => m.topic),
    new Map(metrics.map((m) => [m.topic.id, m.mastery.score])),
  );
}

function weightedMean(metrics: readonly TopicMetrics[], value: (id: ID) => number): number {
  let sum = 0;
  let weights = 0;
  for (const m of metrics) {
    const w = weightOf(m.topic);
    sum += value(m.topic.id) * w;
    weights += w;
  }
  return weights > 0 ? sum / weights : 0;
}

const LEVEL: Record<EvidenceConfidence, number> = { low: 0, medium: 1, high: 2 };

/** university confidence: share-weighted mean of the subjects' levels */
export function combineConfidence(
  parts: readonly { share: number; confidence: EvidenceConfidence }[],
): EvidenceConfidence {
  const total = parts.reduce((s, p) => s + p.share, 0);
  if (!(total > 0)) return "low";
  const v = parts.reduce((s, p) => s + p.share * LEVEL[p.confidence], 0) / total;
  return v >= 1.5 ? "high" : v >= 0.75 ? "medium" : "low";
}

/**
 * The three dimensions over the required subjects of one university, with
 * the same (normalised) weights as the existing readiness. Subjects the
 * university does not ask for cannot move these numbers.
 */
export function calculateUniversityDimensions(
  universityId: ID,
  requirements: readonly UniversityRequirement[],
  bySubject: ReadonlyMap<ID, SubjectDimensions>,
): UniversityDimensions {
  const usable = requirements.filter((r) => bySubject.has(r.subjectId) && r.weight > 0);
  const total = usable.reduce((s, r) => s + r.weight, 0);
  const breakdown = usable
    .map((r) => ({
      subjectId: r.subjectId,
      required: r.required,
      share: total > 0 ? r.weight / total : 0,
      dimensions: bySubject.get(r.subjectId) as SubjectDimensions,
    }))
    .sort((a, b) => b.share - a.share);
  const sum = (pick: (d: SubjectDimensions) => number) =>
    round1(breakdown.reduce((s, b) => s + b.share * pick(b.dimensions), 0));
  return {
    universityId,
    coverage: sum((d) => d.coverage),
    mastery: sum((d) => d.mastery),
    examReadiness: sum((d) => d.examReadiness),
    examEvidenceConfidence: combineConfidence(
      breakdown.map((b) => ({ share: b.share, confidence: b.dimensions.examEvidenceConfidence })),
    ),
    breakdown,
  };
}

function groupBy<T>(items: readonly T[], key: (t: T) => ID | undefined | null): Map<ID, T[]> {
  const out = new Map<ID, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const arr = out.get(k);
    if (arr) arr.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function buildLearningDimensions(
  model: Pick<
    StudyModel,
    "now" | "snapshot" | "subjectSummaries" | "topicMetrics" | "universities" | "primaryUniversity"
  >,
  cfg: { coverage?: CoverageConfig; exam?: ExamReadinessConfig } = {},
): StudyDimensions {
  const coverageCfg = cfg.coverage ?? COVERAGE_CONFIG;
  const examCfg = cfg.exam ?? EXAM_READINESS_CONFIG;
  const { now, snapshot } = model;

  const reviewsByTopic = groupBy<Review>(snapshot.reviews, (r) => r.topicId);
  const problemsByTopic = groupBy<PastExamProblem>(snapshot.pastExamProblems, (p) => p.topicId);
  const pastExamById = new Map(snapshot.pastExams.map((p) => [p.id, p]));
  const mockFlags = new Map<ID, number[]>();
  for (const m of snapshot.mockExams) {
    const at = dayKeyTime(m.examDate, m.createdAt);
    for (const id of new Set(m.weakTopicIds ?? [])) {
      const arr = mockFlags.get(id) ?? [];
      arr.push(at);
      mockFlags.set(id, arr);
    }
  }

  /* ---------------- topics ---------------- */
  const topics = new Map<ID, TopicDimensions>();
  const itemsOf = new Map<ID, EvidenceItem[]>();
  for (const m of model.topicMetrics.values()) {
    const items = collectTopicEvidence(
      {
        evaluationType: m.evaluationType,
        results: m.results,
        reviews: reviewsByTopic.get(m.topic.id) ?? [],
        problems: problemsByTopic.get(m.topic.id) ?? [],
        pastExamById,
        now,
      },
      examCfg,
    );
    itemsOf.set(m.topic.id, items);
    const readiness = calculateTopicExamReadiness(
      {
        mastery: m.mastery.score,
        evaluationType: m.evaluationType,
        items,
        mockFlaggedAt: mockFlags.get(m.topic.id) ?? [],
        now,
      },
      examCfg,
    );
    topics.set(m.topic.id, {
      topicId: m.topic.id,
      coverage: calculateTopicCoverage(m.topic.status, coverageCfg) * 100,
      mastery: m.mastery.score,
      examReadiness: readiness.score,
      examEvidenceConfidence: readiness.confidence,
      readiness,
    });
  }

  /** category / subject level from a set of topics (+ whole papers for subjects) */
  const aggregate = (
    metrics: readonly TopicMetrics[],
    evaluationType: EvaluationType,
    paperItems: readonly EvidenceItem[],
  ): LearningDimensions => {
    const of = (id: ID) => topics.get(id) as TopicDimensions;
    const readiness = calculateAggregateExamReadiness(
      {
        topicReadiness: weightedMean(metrics, (id) => of(id).examReadiness),
        topicBaseline: weightedMean(metrics, (id) => of(id).readiness.baseline),
        topicExamShare: weightedMean(metrics, (id) => of(id).readiness.examShare),
        evaluationType,
        topicItems: metrics.flatMap((m) => itemsOf.get(m.topic.id) ?? []),
        paperItems,
        mockPenalty: weightedMean(metrics, (id) => of(id).readiness.mockPenalty),
        now,
      },
      examCfg,
    );
    return {
      coverage: calculateCoverage(
        metrics.map((m) => m.topic),
        coverageCfg,
      ),
      mastery: calculateMasteryAggregate(metrics),
      examReadiness: readiness.score,
      examEvidenceConfidence: readiness.confidence,
      readiness,
    };
  };

  /* ---------------- categories / subjects ---------------- */
  const metricsByCategory = groupBy([...model.topicMetrics.values()], (m) => m.category.id);
  const subjects = model.subjectSummaries.map((summary): SubjectDimensions => {
    const evaluationType = summary.evaluationType;
    const categories = summary.categories.map((c): CategoryDimensions => {
      const metrics = metricsByCategory.get(c.category.id) ?? [];
      return {
        categoryId: c.category.id,
        name: c.category.name,
        topicCount: metrics.length,
        ...aggregate(metrics, evaluationType, []),
      };
    });
    const metrics = summary.categories.flatMap((c) => metricsByCategory.get(c.category.id) ?? []);
    const paperItems = collectPaperEvidence(
      {
        evaluationType,
        pastExams: snapshot.pastExams.filter((p) => p.subjectId === summary.subject.id),
        mockExams: snapshot.mockExams.filter((m) => m.subjectId === summary.subject.id),
        now,
      },
      examCfg,
    );
    return {
      subjectId: summary.subject.id,
      subjectName: summary.subject.name,
      evaluationType,
      topicCount: metrics.length,
      categories,
      ...aggregate(metrics, evaluationType, paperItems),
    };
  });
  const bySubject = new Map(subjects.map((s) => [s.subjectId, s]));

  /* ---------------- universities ---------------- */
  const universities = model.universities.map((u) =>
    calculateUniversityDimensions(u.university.id, u.requirements, bySubject),
  );
  const byUniversity = new Map(universities.map((u) => [u.universityId, u]));

  return {
    topics,
    subjects,
    bySubject,
    universities,
    byUniversity,
    primary: model.primaryUniversity
      ? byUniversity.get(model.primaryUniversity.university.id)
      : undefined,
  };
}
