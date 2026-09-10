"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import {
  CategorySplitChart,
  ExamScoreChart,
  MonthlyHoursChart,
  ProgressTrendChart,
  WeeklyHoursChart,
} from "@/components/analytics/charts";
import { ExamScoresPanel } from "@/components/analytics/exam-scores-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivity,
  useCategories,
  useExamScores,
  usePrimarySubject,
  useStudySessions,
  useTopics,
} from "@/hooks/use-data";
import { totalStudySeconds, weeklyStudyMinutes } from "@/lib/analytics";
import { formatMinutes } from "@/lib/utils";

export function AnalyticsScreen() {
  const subject = usePrimarySubject();
  const sessions = useStudySessions();
  const categories = useCategories();
  const topics = useTopics();
  const scores = useExamScores();
  const activity = useActivity(1000);
  const searchParams = useSearchParams();

  const subjectTopics = useMemo(() => {
    if (!subject || !categories || !topics) return [];
    const catIds = new Set(categories.filter((c) => c.subjectId === subject.id).map((c) => c.id));
    return topics.filter((t) => catIds.has(t.categoryId));
  }, [subject, categories, topics]);

  const loading =
    !subject ||
    sessions === undefined ||
    categories === undefined ||
    topics === undefined ||
    activity === undefined;

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const totalSec = totalStudySeconds(sessions);
  const thisWeekMin = weeklyStudyMinutes(sessions, 1)[0]?.minutes ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`${subject.name}の学習データ`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="累計学習時間" value={formatMinutes(totalSec / 60)} />
        <StatCard label="今週の学習時間" value={formatMinutes(thisWeekMin)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <WeeklyHoursChart sessions={sessions} />
        <MonthlyHoursChart sessions={sessions} />
        <CategorySplitChart
          sessions={sessions}
          categories={categories}
          topics={topics}
          subjectId={subject.id}
        />
        <ProgressTrendChart subjectTopics={subjectTopics} activityLogs={activity} />
      </div>

      <ExamScoreChart scores={scores ?? []} />
      <ExamScoresPanel defaultOpen={searchParams.get("add") === "exam"} />
    </div>
  );
}
