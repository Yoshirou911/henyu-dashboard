import type { Metadata } from "next";
import { ExamCountdown } from "@/components/dashboard/exam-countdown";
import { NextUpCard } from "@/components/dashboard/next-up-card";
import { OverallProgress } from "@/components/dashboard/overall-progress";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DailyGoalCard } from "@/components/today/daily-goal-card";

export const metadata: Metadata = { title: "ダッシュボード" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <ExamCountdown />
      <QuickStats />
      <div className="grid gap-6 lg:grid-cols-2">
        <OverallProgress />
        <div className="space-y-6">
          <DailyGoalCard />
          <NextUpCard />
        </div>
      </div>
      <RecentActivity />
    </div>
  );
}
