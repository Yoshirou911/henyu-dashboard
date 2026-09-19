"use client";

import { useMemo } from "react";
import { Meter, scoreColor } from "@/components/common/meter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildLearningDimensions,
  type SubjectDimensions,
  type UniversityDimensions,
} from "@/lib/learning-dimensions/buildLearningDimensions";
import type { EvidenceConfidence } from "@/lib/learning-dimensions/examReadiness";
import {
  DIMENSION_LABEL,
  EVIDENCE_CONFIDENCE_LABEL,
  READINESS_DISCLAIMER,
  coverageHint,
  explainExamReadiness,
  formatPercent,
  masteryHint,
  readinessHint,
} from "@/lib/learning-dimensions/format";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import { cn } from "@/lib/utils";

/* Phase 3.1 — 学習範囲 / 習熟度 / 本番準備度. Read-only; the planner never sees it. */

/** neutral colour: a low coverage / readiness is not a failure signal */
const NEUTRAL = "var(--primary)";

export function useLearningDimensions(model: StudyModel | undefined) {
  return useMemo(() => (model ? buildLearningDimensions(model) : undefined), [model]);
}

const CONFIDENCE_VARIANT = {
  low: "outline",
  medium: "secondary",
  high: "success",
} as const satisfies Record<EvidenceConfidence, string>;

function ConfidenceBadge({ confidence }: { confidence: EvidenceConfidence }) {
  return (
    <Badge variant={CONFIDENCE_VARIANT[confidence]} className="shrink-0 whitespace-nowrap">
      {DIMENSION_LABEL.confidence} {EVIDENCE_CONFIDENCE_LABEL[confidence]}
    </Badge>
  );
}

function Axis({
  label,
  sub,
  value,
  hint,
  color,
}: {
  label: string;
  sub: string;
  value: number;
  hint: string;
  color: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-[11px] font-medium">
        {label} <span className="hidden opacity-70 sm:inline">{sub}</span>
      </p>
      <p className="text-xl font-semibold tabular-nums">{formatPercent(value)}</p>
      <Meter value={value} showValue={false} color={color} label={label} />
      <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
    </div>
  );
}

/** 科目ページ「学力の3軸」 */
export function SubjectDimensionsCard({ dims }: { dims: SubjectDimensions }) {
  const why = explainExamReadiness({
    mastery: dims.mastery,
    readiness: dims.readiness,
    evaluationType: dims.evaluationType,
  });
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>学力の3軸</CardTitle>
          <CardDescription>
            進んだ範囲・身についた度合い・本番形式での証拠を分けて表示
          </CardDescription>
        </div>
        <ConfidenceBadge confidence={dims.examEvidenceConfidence} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <Axis
            label={DIMENSION_LABEL.coverage}
            sub="Coverage"
            value={dims.coverage}
            hint={coverageHint(dims.coverage)}
            color={NEUTRAL}
          />
          <Axis
            label={DIMENSION_LABEL.mastery}
            sub="Mastery"
            value={dims.mastery}
            hint={masteryHint()}
            color={scoreColor(dims.mastery)}
          />
          <Axis
            label={DIMENSION_LABEL.examReadiness}
            sub="Exam"
            value={dims.examReadiness}
            hint={readinessHint(dims.readiness, dims.evaluationType)}
            color={NEUTRAL}
          />
        </div>
        <details className="text-muted-foreground text-[11px]">
          <summary className="hover:text-foreground cursor-pointer select-none">
            本番準備度の根拠
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {why.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-1.5">{READINESS_DISCLAIMER}</p>
        </details>
      </CardContent>
    </Card>
  );
}

/** one compact line: 学習範囲 31% ・ 習熟度 22% ・ 本番準備度 8%（証拠 低） */
export function DimensionsLine({
  dims,
  showMastery = true,
  className,
}: {
  dims: Pick<
    UniversityDimensions,
    "coverage" | "mastery" | "examReadiness" | "examEvidenceConfidence"
  >;
  showMastery?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-[11px] tabular-nums", className)}>
      {DIMENSION_LABEL.coverage} {formatPercent(dims.coverage)}
      {showMastery ? ` ・ ${DIMENSION_LABEL.mastery} ${formatPercent(dims.mastery)}` : ""}
      {` ・ ${DIMENSION_LABEL.examReadiness} ${formatPercent(dims.examReadiness)}`}（
      {DIMENSION_LABEL.confidence} {EVIDENCE_CONFIDENCE_LABEL[dims.examEvidenceConfidence]}）
    </p>
  );
}
