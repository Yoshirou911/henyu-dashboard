"use client";

import { Flame, Play, Timer } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { useRepository } from "@/components/providers/repository-provider";
import { ReviewQueue } from "@/components/review/review-queue";
import { DailyGoalCard } from "@/components/today/daily-goal-card";
import { QuickTimer } from "@/components/today/quick-timer";
import { StatusSelect } from "@/components/topic/status-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { usePrimarySubject, useOrderedSubjectTopics, useStudySessions } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { studyStreakDays } from "@/lib/analytics";
import { DAY_MS, longDateLabel, dayKey, startOfDay } from "@/lib/date";
import { findUpcomingTopics } from "@/lib/progress";
import type { Status } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

function FocusTopics() {
  const repo = useRepository();
  const timer = useTimer();
  const subject = usePrimarySubject();
  const views = useOrderedSubjectTopics(subject?.id);

  if (!views) return <Skeleton className="h-48 w-full rounded-xl" />;

  const upcoming = findUpcomingTopics(
    views.map((v) => v.topic),
    4,
  );
  const viewByTopic = new Map(views.map((v) => [v.topic.id, v]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>今日やる単元</CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <EmptyState
            title="未着手の単元はありません"
            description="復習と過去問演習に進みましょう。"
          />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((topic) => (
              <li
                key={topic.id}
                className="border-border flex items-center gap-2 rounded-lg border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{topic.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {viewByTopic.get(topic.id)?.category.name}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${topic.name} を計測`}
                  onClick={() => {
                    timer.setTarget({
                      topicId: topic.id,
                      topicName: topic.name,
                      subjectId: subject?.id ?? null,
                    });
                    timer.start();
                    toast({ title: `「${topic.name}」の計測を開始しました` });
                  }}
                >
                  <Play />
                </Button>
                <StatusSelect
                  value={topic.status}
                  onChange={(s: Status) => repo.setTopicStatus(topic.id, s)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function TodayScreen() {
  const sessions = useStudySessions(startOfDay() - 40 * DAY_MS);
  const today = dayKey();

  const todaySec =
    sessions
      ?.filter((s) => s.startedAt >= startOfDay())
      .reduce((sum, s) => sum + s.durationSec, 0) ?? 0;
  const streak = sessions ? studyStreakDays(sessions) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="今日" description={longDateLabel(today)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="今日の学習時間" value={formatMinutes(todaySec / 60)} icon={Timer} />
        <StatCard label="連続学習日数" value={`${streak} 日`} icon={Flame} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <DailyGoalCard />
          <FocusTopics />
        </div>
        <div className="space-y-6">
          <QuickTimer />
          <Card>
            <CardHeader>
              <CardTitle>昨日までの復習候補</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewQueue limit={5} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
