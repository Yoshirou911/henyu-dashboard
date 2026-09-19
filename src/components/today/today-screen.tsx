"use client";

import { Flame, Timer } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { AvailableTimePicker } from "@/components/planner/available-time-picker";
import { PlanList } from "@/components/planner/plan-list";
import { ReviewQueue } from "@/components/review/review-queue";
import { TimerPanel } from "@/components/timer/timer-panel";
import { DailyGoalCard } from "@/components/today/daily-goal-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import { longDateLabel } from "@/lib/date";
import { formatMinutes } from "@/lib/utils";

export function TodayScreen() {
  const model = useStudyModel();
  const minutes = model?.availableMinutesToday ?? 0;
  const plan = useMemo(() => model?.buildPlan(minutes), [model, minutes]);

  if (!model || !plan) {
    return (
      <div className="space-y-6">
        <PageHeader title="今日" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="今日" description={longDateLabel(model.today)} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="今日の学習時間" value={formatMinutes(model.todayMinutes)} icon={Timer} />
        <StatCard label="連続学習日数" value={`${model.streak} 日`} icon={Flame} />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>今日の推奨学習</CardTitle>
            <CardDescription className="tabular-nums">
              目標 {formatMinutes(plan.availableMinutes)} ・ 予定{" "}
              {formatMinutes(plan.plannedMinutes)}
            </CardDescription>
          </div>
          <AvailableTimePicker key={minutes} date={model.today} value={minutes} />
        </CardHeader>
        <CardContent>
          <PlanList plan={plan} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>学習タイマー</CardTitle>
            </CardHeader>
            <CardContent>
              <TimerPanel />
            </CardContent>
          </Card>
          <DailyGoalCard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              今日の復習 {model.reviewQueue.length}件
              {model.overdueCount > 0 ? (
                <span className="text-destructive ml-2 text-xs font-medium">
                  期限超過 {model.overdueCount}件
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewQueue model={model} limit={5} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
