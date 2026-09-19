import type { TopicAccuracy } from "@/lib/mastery/accuracy";
import type { EvaluationType, Status } from "@/lib/types";

/**
 * masteryScore (0–100) — rule based, spec §10.
 *
 *   score = base(status) + Σ corrections, clamped to 0..100
 *
 * All coefficients live in MASTERY_CONFIG so they can be tuned without
 * touching the algorithm (pass a partial override as the 2nd argument).
 */
export const MASTERY_CONFIG = {
  base: { 0: 0, 1: 20, 2: 50, 3: 75, 4: 100 } as Record<Status, number>,
  /** accuracy we'd expect at each status; being above/below moves the score */
  expectedAccuracy: { 0: 0.4, 1: 0.5, 2: 0.7, 3: 0.8, 4: 0.85 } as Record<Status, number>,
  /** don't trust accuracy with fewer problems than this */
  minAttemptsForAccuracy: 5,
  /** points per 100% deviation from the expected accuracy, per evaluation type */
  accuracyGain: { problem: 40, language: 25, interview: 0 } as Record<EvaluationType, number>,
  accuracyCap: 20,
  /** 基本OK以上なのに基本問題が 60% 未満 */
  basicLowThreshold: 0.6,
  basicLowPenalty: 8,
  reviewFailedPenalty: 5,
  reviewFailedCap: 15,
  reviewGotBonus: 2,
  reviewGotCap: 6,
  /** forgetting decay for learned topics (status ≥ 2), longest first */
  decay: [
    { days: 30, penalty: 10 },
    { days: 14, penalty: 5 },
  ],
  continuityMinDays: 3,
  continuityBonus: 3,
  hardMinAttempts: 3,
  hardThreshold: 0.7,
  hardBonus: 5,
  pastExamWrongPenalty: 5,
  pastExamPartialPenalty: 2,
  pastExamCorrectBonus: 3,
  pastExamCap: 10,
  mockWeakPenalty: 4,
  mockCap: 8,
  /** language: steady volume (e.g. vocab minutes) is evidence on its own */
  languageVolumeMinutes7d: 60,
  languageVolumeBonus: 5,
  /** interview: share of the score taken from mock-interview completeness */
  interviewMockBlend: 0.5,
};

export type MasteryConfig = typeof MASTERY_CONFIG;

export interface MasteryInput {
  status: Status;
  evaluationType: EvaluationType;
  accuracy: TopicAccuracy;
  reviewOutcomes: { got: number; shaky: number; failed: number };
  daysSinceStudied: number | null;
  pastExam: { correct: number; partial: number; wrong: number };
  /** number of mock exams that flagged this topic as a weak point */
  mockWeakCount: number;
  studyMinutes7d: number;
}

export interface MasteryAdjustment {
  label: string;
  value: number;
}

export interface MasteryResult {
  score: number;
  base: number;
  adjustments: MasteryAdjustment[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function calculateMastery(
  input: MasteryInput,
  override: Partial<MasteryConfig> = {},
): MasteryResult {
  const cfg: MasteryConfig = { ...MASTERY_CONFIG, ...override };
  const base = cfg.base[input.status];
  const adj: MasteryAdjustment[] = [];
  const push = (label: string, value: number) => {
    if (value !== 0) adj.push({ label, value: Math.round(value * 10) / 10 });
  };

  const { accuracy } = input;
  const recent = accuracy.recent;

  // 1. recent accuracy vs. what the status implies
  const gain = cfg.accuracyGain[input.evaluationType];
  if (gain > 0 && recent.rate !== null && recent.attempted >= cfg.minAttemptsForAccuracy) {
    const delta = (recent.rate - cfg.expectedAccuracy[input.status]) * gain;
    push("直近正答率", clamp(delta, -cfg.accuracyCap, cfg.accuracyCap));
  }

  // 2. basic problems failing while the status claims 基本OK+
  if (
    input.evaluationType === "problem" &&
    input.status >= 2 &&
    accuracy.basic.rate !== null &&
    accuracy.basic.attempted >= cfg.minAttemptsForAccuracy &&
    accuracy.basic.rate < cfg.basicLowThreshold
  ) {
    push("基本問題が不安定", -cfg.basicLowPenalty);
  }

  // 3. review outcomes
  push(
    "復習できなかった",
    -Math.min(cfg.reviewFailedCap, input.reviewOutcomes.failed * cfg.reviewFailedPenalty),
  );
  push("復習できた", Math.min(cfg.reviewGotCap, input.reviewOutcomes.got * cfg.reviewGotBonus));

  // 4. forgetting decay
  if (input.status >= 2 && input.daysSinceStudied !== null) {
    const hit = cfg.decay.find((d) => (input.daysSinceStudied as number) >= d.days);
    if (hit) push(`${hit.days}日以上未学習`, -hit.penalty);
  }

  // 5. continuity
  if (accuracy.activeDays14 >= cfg.continuityMinDays) push("継続学習", cfg.continuityBonus);

  // 6. difficulty — success on advanced / past-exam material
  const hard = [accuracy.advanced, accuracy.pastExam].find(
    (s) => s.attempted >= cfg.hardMinAttempts && (s.rate ?? 0) >= cfg.hardThreshold,
  );
  if (hard) push("発展・過去問で得点", cfg.hardBonus);

  // 7. past exam problems tied to this topic
  const pe = input.pastExam;
  const peValue =
    pe.correct * cfg.pastExamCorrectBonus -
    pe.wrong * cfg.pastExamWrongPenalty -
    pe.partial * cfg.pastExamPartialPenalty;
  push("過去問の結果", clamp(peValue, -cfg.pastExamCap, cfg.pastExamCap));

  // 8. mock exams
  push("模試で失点", -Math.min(cfg.mockCap, input.mockWeakCount * cfg.mockWeakPenalty));

  // 9. evaluation-type specifics
  if (
    input.evaluationType === "language" &&
    input.status >= 1 &&
    input.studyMinutes7d >= cfg.languageVolumeMinutes7d
  ) {
    push("学習量（7日）", cfg.languageVolumeBonus);
  }

  let score = base + adj.reduce((s, a) => s + a.value, 0);

  if (input.evaluationType === "interview" && accuracy.mock.rate !== null) {
    // mock-interview completeness (評価/満点) blends into the checklist status
    const blended =
      (1 - cfg.interviewMockBlend) * score + cfg.interviewMockBlend * accuracy.mock.rate * 100;
    push("模擬面接の完成度", blended - score);
    score = blended;
  }

  return { score: Math.round(clamp(score, 0, 100)), base, adjustments: adj };
}
