"use client";

import {
  AlertsCard,
  FocusCard,
  MilestoneCard,
  MonthlyGoalCard,
  TodayPlanCard,
  WeakTopCard,
} from "@/components/dashboard/action-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  CountdownCard,
  OverallSubjectsCard,
  ReadinessCard,
} from "@/components/dashboard/strategy-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";

/**
 * 受験司令塔. Order follows spec §25: countdown → 第一志望準備度 → 今日やること →
 * 要注意 → 弱点 → 今月の目標 → 次のマイルストーン → 現在の単元.
 */
export function DashboardScreen() {
  const model = useStudyModel();

  if (!model) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl lg:col-span-3" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CountdownCard model={model} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ReadinessCard model={model} />
        </div>
        <div className="lg:col-span-3">
          <TodayPlanCard model={model} />
        </div>
      </div>
      <AlertsCard model={model} />
      <div className="grid gap-6 lg:grid-cols-3">
        <WeakTopCard model={model} />
        <MonthlyGoalCard model={model} />
        <FocusCard model={model} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <OverallSubjectsCard model={model} />
        <MilestoneCard model={model} />
      </div>
      <RecentActivity />
    </div>
  );
}
