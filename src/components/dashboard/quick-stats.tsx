"use client";

import { Flame, ListChecks, Timer } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOpenReviews, useStudySessions } from "@/hooks/use-data";
import { studyStreakDays } from "@/lib/analytics";
import { DAY_MS, startOfDay } from "@/lib/date";
import { isDue } from "@/lib/review-schedule";
import { formatMinutes } from "@/lib/utils";

export function QuickStats() {
  const sessions = useStudySessions(startOfDay() - 40 * DAY_MS);
  const openReviews = useOpenReviews();

  if (sessions === undefined || openReviews === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
        <Skeleton className="h-[92px]" />
      </div>
    );
  }

  const todayStart = startOfDay();
  const todaySec = sessions
    .filter((s) => s.startedAt >= todayStart)
    .reduce((sum, s) => sum + s.durationSec, 0);
  const streak = studyStreakDays(sessions);
  const dueCount = openReviews.filter((r) => isDue(r)).length;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="今日の学習時間"
        value={formatMinutes(todaySec / 60)}
        icon={Timer}
        hint={todaySec === 0 ? "まだ記録がありません" : undefined}
      />
      <StatCard
        label="連続学習日数"
        value={`${streak} 日`}
        icon={Flame}
        hint={streak === 0 ? "今日から再開しましょう" : "継続中"}
      />
      <StatCard
        label="復習待ち"
        value={`${dueCount} 件`}
        icon={ListChecks}
        hint={dueCount > 0 ? "今日が期限の項目があります" : "追いついています"}
      />
    </div>
  );
}
