"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildForecast, type SubjectForecast } from "@/lib/forecast/buildForecast";
import { FORECAST_CONFIG } from "@/lib/forecast/config";
import {
  CONFIDENCE_LABEL,
  RISK_META,
  SPEED_SOURCE_LABEL,
  dashboardStatus,
  formatDayKey,
  formatEta,
  formatHours,
  formatMargin,
  formatPerWeek,
  pickDashboardSubjects,
} from "@/lib/forecast/format";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import { cn } from "@/lib/utils";

/* Phase 3.0b — pace forecast display. Read-only; the planner never sees it. */

const TONE_VARIANT = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
  muted: "outline",
} as const;

export function useForecast(model: StudyModel | undefined) {
  return useMemo(() => (model ? buildForecast(model) : undefined), [model]);
}

function RiskBadge({ forecast }: { forecast: SubjectForecast }) {
  const meta = RISK_META[forecast.risk.level];
  return (
    <Badge variant={TONE_VARIANT[meta.tone]} className="shrink-0 whitespace-nowrap">
      {meta.label}
      {forecast.provisional && forecast.risk.level !== "insufficient" ? "（暫定）" : ""}
    </Badge>
  );
}

function Item({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="text-sm font-medium break-words tabular-nums">{value}</dd>
      {hint ? <dd className="text-muted-foreground truncate text-[11px]">{hint}</dd> : null}
    </div>
  );
}

/** 科目ページの「学習見通し」 */
export function SubjectOutlookCard({ forecast }: { forecast: SubjectForecast }) {
  const f = forecast;
  const done = f.risk.level === "done";
  const planPace = f.pace.source === "plan";
  const heavy = f.categories
    .filter((c) => c.remainingMinutes > 0)
    .sort((a, b) => b.remainingMinutes - a.remainingMinutes)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{f.subjectName}の見通し</CardTitle>
          <CardDescription>
            {!f.provisional
              ? "記録された学習時間と進み方からの予測"
              : planPace
                ? "暫定予測：記録が少ないため、初期値と計画ペースで計算しています"
                : "暫定予測：この科目の実績がまだ少ないため、精度は低めです"}
          </CardDescription>
        </div>
        <RiskBadge forecast={f} />
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Item
            label="完了目標"
            value={formatDayKey(f.required.completionTarget)}
            hint={`試験の${FORECAST_CONFIG.examPrepReserveDays}日前`}
          />
          <Item label={f.provisional ? "予想到達（暫定）" : "予想到達"} value={formatEta(f)} />
          <Item label="先行 / 遅延" value={done ? "—" : formatMargin(f.marginDays)} />
          <Item
            label="推定残り"
            value={formatHours(f.remainingMinutes)}
            hint={`${f.openTopicCount}単元`}
          />
          <Item
            label="必要ペース"
            value={
              f.required.minutesPerWeek === null
                ? "期限超過"
                : formatPerWeek(f.required.minutesPerWeek)
            }
          />
          <Item
            label="最近のペース"
            value={planPace ? "記録不足" : formatPerWeek(f.pace.minutesPerWeek)}
            hint={
              planPace
                ? `計画 ${formatPerWeek(f.plannedMinutesPerWeek)}`
                : `直近${f.pace.days}日の平均`
            }
          />
          <Item label="信頼度" value={CONFIDENCE_LABEL[f.confidence]} />
          <Item
            label="1単元の目安"
            value={formatHours(f.speed.topicMinutes)}
            hint={SPEED_SOURCE_LABEL[f.speed.source]}
          />
        </dl>
        <div className="text-muted-foreground space-y-1 text-[11px]">
          <p>
            {f.speed.samples > 0
              ? `基本OKまで 中央値 ${formatHours(f.speed.medianMinutesToBasic)}（実績 ${f.speed.samples}単元）`
              : "学習速度は初期値です。単元を選んで記録し、基本OKにすると実績に置き換わります。"}
          </p>
          {heavy.length > 0 ? (
            <p>
              残りが多い分野：
              {heavy.map((c) => `${c.name} ${formatHours(c.remainingMinutes)}`).join("・")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Dashboard「受験ペース」— 第一志望で重要な科目だけ、最大4件 */
export function PaceCard({ model }: { model: StudyModel }) {
  const forecast = useForecast(model);
  if (!forecast) return null;
  const rows = pickDashboardSubjects(
    forecast.subjects,
    model.primaryUniversity?.requirements ?? [],
  );
  if (rows.length === 0) return null;
  const allPlan = rows.every((r) => r.pace.source === "plan" && r.risk.level !== "done");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>受験ペース</CardTitle>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          完了目標 {formatDayKey(forecast.completionTarget)}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1.5">
          {rows.map((f) => {
            const status = dashboardStatus(f);
            const tone =
              status.label === RISK_META.insufficient.label
                ? "muted"
                : RISK_META[f.risk.level].tone;
            return (
              <li key={f.subjectId}>
                <Link
                  href={`/subjects/${f.subjectId}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-sm"
                >
                  <span className="font-medium">{f.subjectName}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {status.detail ? (
                      <span className="text-muted-foreground tabular-nums">{status.detail}</span>
                    ) : null}
                    <span
                      className={cn(
                        tone === "ok" && "text-success",
                        tone === "warn" && "text-warning",
                        tone === "bad" && "text-destructive",
                        tone === "muted" && "text-muted-foreground",
                      )}
                    >
                      {status.label}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {allPlan ? (
          <p className="text-muted-foreground text-[11px]">
            {FORECAST_CONFIG.minTrackedDaysForPace}日以上記録すると、実際のペースで判定します。
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
