import type { ID, Topic, UniversityRequirement } from "@/lib/types";

/**
 * Subject score = topic-weight-weighted mean of masteryScore (0–100).
 * Archived topics are ignored.
 */
export function subjectScore(
  topics: readonly Pick<Topic, "id" | "weight" | "archived">[],
  masteryById: ReadonlyMap<ID, number>,
): number {
  let sum = 0;
  let weights = 0;
  for (const t of topics) {
    if (t.archived) continue;
    const w = t.weight > 0 ? t.weight : 1;
    sum += (masteryById.get(t.id) ?? 0) * w;
    weights += w;
  }
  return weights > 0 ? Math.round((sum / weights) * 10) / 10 : 0;
}

export interface ReadinessBreakdown {
  subjectId: ID;
  required: boolean;
  importance: number;
  /** normalised share of the readiness score, 0–1 */
  share: number;
  score: number;
}

export interface ReadinessResult {
  score: number;
  breakdown: ReadinessBreakdown[];
}

/**
 * University readiness (spec §5): only the subjects this university asks for,
 * weighted by the (user-editable) requirement weights. Studying a subject the
 * university does not require cannot move this number.
 */
export function universityReadiness(
  requirements: readonly UniversityRequirement[],
  subjectScores: ReadonlyMap<ID, number>,
): ReadinessResult {
  const usable = requirements.filter((r) => subjectScores.has(r.subjectId) && r.weight > 0);
  const total = usable.reduce((s, r) => s + r.weight, 0);
  if (total === 0) return { score: 0, breakdown: [] };
  const breakdown = usable
    .map((r) => ({
      subjectId: r.subjectId,
      required: r.required,
      importance: r.importance,
      share: r.weight / total,
      score: subjectScores.get(r.subjectId) ?? 0,
    }))
    .sort((a, b) => b.share - a.share);
  const score = breakdown.reduce((s, b) => s + b.share * b.score, 0);
  return { score: Math.round(score * 10) / 10, breakdown };
}
