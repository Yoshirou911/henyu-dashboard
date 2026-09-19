"use client";

import { ArrowRight, Check, Flag, Play, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Meter, RatePill } from "@/components/common/meter";
import { PlanList, useStartPlanItem } from "@/components/planner/plan-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { daysUntil, longDateLabel } from "@/lib/date";
import { PACE_META } from "@/lib/goals/monthlyProgress";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import { cn, formatMinutes } from "@/lib/utils";

/** 今日やること — the most important card (spec §25). */
export function TodayPlanCard({ model }: { model: StudyModel }) {
  const plan = useMemo(() => model.buildPlan(model.availableMinutesToday), [model]);
  const start = useStartPlanItem();
  const first = plan.items[0];
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>今日やること</CardTitle>
          <CardDescription className="tabular-nums">
            予定 {formatMinutes(plan.plannedMinutes)} / 使える時間{" "}
            {formatMinutes(plan.availableMinutes)}
          </CardDescription>
        </div>
        <Link href="/today" className="text-primary shrink-0 text-xs hover:underline">
          時間を変更 →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <PlanList plan={plan} limit={5} compact />
        {first ? (
          <Button className="w-full" onClick={() => start(first)}>
            <Play /> 学習開始：{first.topicName}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 要注意 — overdue reviews / weak topics / this week. */
export function AlertsCard({ model }: { model: StudyModel }) {
  const weeklyGoal = model.settings.weeklyStudyGoalMin;
  const items = [
    {
      href: "/review",
      label: "復習期限超過",
      value: `${model.overdueCount}件`,
      warn: model.overdueCount > 0,
      sub: `今日の復習 ${model.reviewQueue.length}件`,
    },
    {
      href: "/weakness",
      label: "弱点",
      value: `${model.weakList.length}件`,
      warn: model.weakList.length > 0,
      sub: model.improvingList.length > 0 ? `改善中 ${model.improvingList.length}件` : "—",
    },
    {
      href: "/analytics",
      label: "今週の学習時間",
      value: formatMinutes(model.weekMinutes),
      warn: weeklyGoal > 0 && model.weekMinutes < weeklyGoal * 0.5,
      sub: weeklyGoal > 0 ? `目標 ${formatMinutes(weeklyGoal)}` : "",
    },
    {
      href: "/today",
      label: "連続学習",
      value: `${model.streak}日`,
      warn: model.streak === 0,
      sub: `今日 ${formatMinutes(model.todayMinutes)}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          className={cn(
            "bg-card hover:border-primary/40 rounded-xl border p-3 transition-colors",
            i.warn ? "border-warning/40" : "border-border",
          )}
        >
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            {i.warn ? <TriangleAlert className="text-warning size-3" /> : null}
            {i.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{i.value}</p>
          <p className="text-muted-foreground truncate text-[11px]">{i.sub}</p>
        </Link>
      ))}
    </div>
  );
}

/** 弱点 TOP3 */
export function WeakTopCard({ model }: { model: StudyModel }) {
  const top = model.weakList.slice(0, 3);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>弱点 TOP3</CardTitle>
        <Link href="/weakness" className="text-primary text-xs hover:underline">
          すべて →
        </Link>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            いまのところ弱点候補はありません。問題演習を記録すると判定されます。
          </p>
        ) : (
          <ol className="space-y-2">
            {top.map((m, i) => (
              <li key={m.topic.id} className="flex items-center gap-2 text-sm">
                <span className="bg-warning/15 text-warning flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">{m.subject.name} / </span>
                  {m.topic.name}
                </span>
                <RatePill rate={m.accuracy.recent.rate ?? m.mastery.score / 100} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** 今月の目標 */
export function MonthlyGoalCard({ model }: { model: StudyModel }) {
  const m = model.monthly;
  const [y, mo] = m.month.split("-");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          今月の目標
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            {y}年{Number(mo)}月 ・ 残り{m.daysLeft}日
          </span>
        </CardTitle>
        <Link href="/goals" className="text-primary text-xs hover:underline">
          編集 →
        </Link>
      </CardHeader>
      <CardContent>
        {m.subjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            今月の目標はまだありません。
            <Link href="/goals" className="text-primary hover:underline">
              目標ページ
            </Link>
            から設定すると、進み具合を「前倒し〜大幅遅れ」で判定します。
          </p>
        ) : (
          <ul className="space-y-3">
            {m.subjects.map((s) => {
              const pace = PACE_META[s.pace];
              return (
                <li key={s.subjectId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{model.subjectById.get(s.subjectId)?.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">
                        {Math.round(s.progress * 100)}%
                      </span>
                      <Badge variant={pace.tone === "default" ? "secondary" : pace.tone}>
                        {pace.label}
                      </Badge>
                    </span>
                  </div>
                  <Progress value={s.progress * 100} className="h-1.5" />
                  <p className="text-muted-foreground truncate text-[11px]">
                    {s.goals.map((g) => g.goal.text).join(" ・ ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** 次のマイルストーン */
export function MilestoneCard({ model }: { model: StudyModel }) {
  const ms = model.nextMilestone;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Flag className="text-muted-foreground size-4" />
          次のマイルストーン
        </CardTitle>
        <Link href="/goals" className="text-primary text-xs hover:underline">
          一覧 →
        </Link>
      </CardHeader>
      <CardContent>
        {!ms ? (
          <p className="text-muted-foreground text-sm">
            長期目標（例：12月末 高校微積完成）を目標ページから登録できます。
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{ms.title}</p>
            <p className="text-muted-foreground text-xs">
              {longDateLabel(ms.date)} ・ あと{daysUntil(ms.date, new Date(model.now))}日
            </p>
            {ms.items.length > 0 ? (
              <ul className="text-muted-foreground list-inside list-disc text-xs">
                {ms.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 現在の単元と「次に進む条件」 (spec §11). */
export function FocusCard({ model }: { model: StudyModel }) {
  const f = model.focus;
  if (!f) return null;
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          現在の単元 ・ {f.subject.name} / {f.category.name}
        </CardDescription>
        <CardTitle className="text-base">{f.topic.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">習熟度 {f.mastery.score} / 100</p>
          <Meter value={f.mastery.score} showValue={false} label="習熟度" />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium">次に進む条件</p>
          <ul className="space-y-1">
            {f.ready.conditions.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-xs">
                {c.met ? (
                  <Check className="text-success size-3.5" aria-label="達成" />
                ) : (
                  <X className="text-destructive size-3.5" aria-label="未達" />
                )}
                <span>{c.label}</span>
                <span className="text-muted-foreground ml-auto tabular-nums">{c.detail}</span>
              </li>
            ))}
          </ul>
          {f.ready.overridden ? (
            <p className="text-muted-foreground mt-1 text-[11px]">手動で設定中</p>
          ) : null}
          {!f.ready.ready && f.ready.progress >= 0.5 ? (
            <p className="text-warning mt-1 text-xs font-medium">あと少し</p>
          ) : null}
        </div>
        {f.nextTopic ? (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              f.ready.ready ? "text-success font-medium" : "text-muted-foreground",
            )}
          >
            <ArrowRight className="size-3" /> 次：{f.nextTopic.name}
            {f.ready.ready ? "（進めます）" : ""}
          </p>
        ) : null}
        <Link
          href={`/roadmap?topic=${f.topic.id}`}
          className="text-primary inline-block text-xs hover:underline"
        >
          詳細・記録 →
        </Link>
      </CardContent>
    </Card>
  );
}
