"use client";

import { useMemo, useState } from "react";
import {
  MonthlyHoursChart,
  ProgressTrendChart,
  SplitChart,
  WeeklyHoursChart,
} from "@/components/analytics/charts";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity } from "@/hooks/use-data";
import { useStudyModel } from "@/hooks/use-study-model";
import { categoryStudySplit, subjectStudySplit, totalStudySeconds } from "@/lib/analytics";
import { DAY_MS, startOfDay } from "@/lib/date";
import { formatMinutes } from "@/lib/utils";

export function AnalyticsScreen() {
  const model = useStudyModel();
  const activity = useActivity(2000);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const selected = subjectId ?? model?.settings.primarySubjectId ?? model?.subjects[0]?.id ?? "";

  const derived = useMemo(() => {
    if (!model) return null;
    const { snapshot } = model;
    const topicSubject = (topicId: string | null) =>
      topicId ? (model.topicMetrics.get(topicId)?.subject.id ?? null) : null;
    const subjectTopics = [...model.topicMetrics.values()]
      .filter((m) => m.subject.id === selected)
      .map((m) => m.topic);
    return {
      subjectSplit: subjectStudySplit(
        snapshot.sessions,
        model.subjects,
        (s) => s.subjectId ?? topicSubject(s.topicId),
        startOfDay(model.now) - 29 * DAY_MS,
      ),
      categorySplit: categoryStudySplit(
        snapshot.sessions,
        snapshot.categories,
        snapshot.topics,
        selected,
      ),
      subjectTopics,
    };
  }, [model, selected]);

  if (!model || !derived || activity === undefined) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const sessions = model.snapshot.sessions;
  const subjectName = model.subjectById.get(selected)?.name ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="学習時間・配分・進捗の推移" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="累計学習時間" value={formatMinutes(totalStudySeconds(sessions) / 60)} />
        <StatCard label="直近7日" value={formatMinutes(model.weekMinutes)} />
        <StatCard label="今日" value={formatMinutes(model.todayMinutes)} />
        <StatCard label="連続学習" value={`${model.streak}日`} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <WeeklyHoursChart sessions={sessions} />
        <MonthlyHoursChart sessions={sessions} />
        <SplitChart
          title="科目別学習時間"
          description="直近30日・編入学習全体"
          data={derived.subjectSplit}
        />
      </div>

      <div className="space-y-3">
        <ChipGroup
          aria-label="科目"
          value={selected}
          onChange={setSubjectId}
          options={model.subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <SplitChart
            title={`${subjectName}：分野別学習時間`}
            description="単元に紐づく学習時間の内訳"
            data={derived.categorySplit}
          />
          <ProgressTrendChart subjectTopics={derived.subjectTopics} activityLogs={activity} />
        </div>
      </div>
    </div>
  );
}
