import { EXAM_READINESS_CONFIG } from "@/lib/learning-dimensions/config";
import type {
  EvidenceConfidence,
  ExamReadinessResult,
} from "@/lib/learning-dimensions/examReadiness";
import type { EvaluationType } from "@/lib/types";

/*
 * Display strings for the learning dimensions. Readiness is a preparation
 * indicator from recorded evidence — never phrase it as a pass probability.
 * Never returns NaN / Infinity.
 */

export const DIMENSION_LABEL = {
  coverage: "学習範囲",
  mastery: "習熟度",
  examReadiness: "本番準備度",
  confidence: "証拠信頼度",
} as const;

export const EVIDENCE_CONFIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

/** 42.6 → "43%" ; non-finite → "—" */
export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

export function coverageHint(coverage: number): string {
  return `範囲の約${formatPercent(coverage)}を一度以上学習`;
}

export function masteryHint(): string {
  return "範囲全体の定着度（既存の習熟度）";
}

/** one-line description of what the readiness number rests on */
export function readinessHint(r: ExamReadinessResult, evaluationType: EvaluationType): string {
  if (r.evidence.examRecords === 0) {
    return evaluationType === "interview"
      ? "模擬面接の記録がまだないため、習熟度から見た目安"
      : "本番形式の証拠がまだないため、習熟度から見た目安";
  }
  if (r.confidence === "low") return "本番形式の証拠はまだ少ない";
  if (r.confidence === "medium") return "本番形式の記録を反映";
  return evaluationType === "interview" ? "複数回の模擬面接を反映" : "複数年度の過去問を反映";
}

const pct = (rate: number | null) => (rate === null ? "—" : formatPercent(rate * 100));

/**
 * Why the readiness is what it is, one short line per factor, e.g.
 * 「習熟度 68」「通常演習 42問（正答 81%）」「編入過去問は未実施」.
 */
export function explainExamReadiness(
  input: { mastery: number; readiness: ExamReadinessResult; evaluationType: EvaluationType },
  cfg = EXAM_READINESS_CONFIG,
): string[] {
  const { readiness: r, evaluationType } = input;
  const t = r.evidence.byTier;
  const lines: string[] = [
    `習熟度 ${Math.round(Number.isFinite(input.mastery) ? input.mastery : 0)}`,
  ];

  const practiceUnits = t.practice.units + t.advanced.units;
  if (evaluationType !== "interview") {
    const practiceRate =
      practiceUnits > 0
        ? ((t.practice.rate ?? 0) * t.practice.units + (t.advanced.rate ?? 0) * t.advanced.units) /
          practiceUnits
        : null;
    lines.push(
      practiceUnits > 0
        ? `通常演習 ${Math.round(practiceUnits)}問（正答 ${pct(practiceRate)}）`
        : "通常演習の記録なし",
    );
  }
  if (t.review.records > 0) {
    lines.push(
      (t.review.rate ?? 0) >= 0.8
        ? `復習は安定（${t.review.records}件）`
        : `復習で不安定な結果あり（${t.review.records}件・${pct(t.review.rate)}）`,
    );
  }
  if (evaluationType === "interview") {
    lines.push(
      t.mock.records > 0
        ? `模擬面接 ${t.mock.records}回（平均 ${pct(t.mock.rate)}）`
        : "模擬面接の記録なし",
    );
  } else {
    if (t.past_exam_level.records > 0) {
      lines.push(
        `過去問レベルの演習 ${Math.round(t.past_exam_level.units)}問（${pct(t.past_exam_level.rate)}）`,
      );
    }
    lines.push(
      t.mock.records > 0 ? `模試 ${t.mock.records}件（${pct(t.mock.rate)}）` : "模試の記録なし",
    );
    lines.push(
      t.past_exam.records > 0
        ? `編入過去問 ${t.past_exam.records}件・${r.evidence.years}年度分（得点率 ${pct(t.past_exam.rate)}）`
        : "編入過去問は未実施",
    );
  }
  if (r.mockPenalty > 0) {
    const pts = Math.round(r.mockPenalty);
    lines.push(`模試で失点した単元あり${pts >= 1 ? `（−${pts}）` : ""}`);
  }
  if (r.evidence.recentShare !== null && r.evidence.recentShare < cfg.confidence.highRecentShare) {
    lines.push("本番形式の証拠の多くが古い（31日以上前）");
  }
  if (r.examShare < 0.2) {
    lines.push(
      `本番形式の証拠が少ないため、習熟度の${Math.round(cfg.noExamEvidenceFactor * 100)}%を目安にしています`,
    );
  }
  return lines;
}

export const READINESS_DISCLAIMER =
  "本番準備度は合格の可能性ではなく、記録された学習証拠から見た本番問題への準備指標です。低くても実力がないという意味ではありません。";
