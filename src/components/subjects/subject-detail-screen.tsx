"use client";

import { ArrowLeft, ArrowRight, ClipboardPlus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Meter, scoreColor } from "@/components/common/meter";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { SubjectOutlookCard, useForecast } from "@/components/forecast/forecast-ui";
import { useRecorder } from "@/components/record/record-provider";
import { EVALUATION_LABEL } from "@/components/subjects/subjects-screen";
import { TopicTable } from "@/components/subjects/topic-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import type { TopicMetrics } from "@/lib/model/buildStudyModel";
import { formatMinutes } from "@/lib/utils";

export function SubjectDetailScreen({ subjectId }: { subjectId: string }) {
  const model = useStudyModel();
  const { openRecord } = useRecorder();
  const forecast = useForecast(model);

  const byCategory = useMemo(() => {
    const map = new Map<string, TopicMetrics[]>();
    if (!model) return map;
    for (const m of model.topicMetrics.values()) {
      if (m.subject.id !== subjectId) continue;
      const arr = map.get(m.category.id) ?? [];
      arr.push(m);
      map.set(m.category.id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.topic.order - b.topic.order);
    return map;
  }, [model, subjectId]);

  if (!model) return <Skeleton className="h-96 w-full rounded-xl" />;
  const summary = model.subjectSummaries.find((s) => s.subject.id === subjectId);
  if (!summary) {
    return (
      <EmptyState
        title="科目が見つかりません"
        action={
          <Link href="/subjects" className="text-primary text-sm hover:underline">
            科目一覧へ
          </Link>
        }
      />
    );
  }

  const weak = model.weakList.filter((m) => m.subject.id === subjectId).slice(0, 5);
  const outlook = forecast?.bySubject.get(subjectId);

  return (
    <div className="space-y-6">
      <Link
        href="/subjects"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="size-3" /> 科目一覧
      </Link>
      <PageHeader
        title={summary.subject.name}
        description={`${EVALUATION_LABEL[summary.evaluationType]} ・ ${summary.doneCount}/${summary.topicCount}単元が定着以上`}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => openRecord({ mode: "exercise", subjectId })}
          >
            <ClipboardPlus className="size-4" /> 記録
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="習熟度"
          value={
            <span style={{ color: scoreColor(summary.score) }}>{Math.round(summary.score)}%</span>
          }
          hint={`ステータス進捗 ${Math.round(summary.statusPercent)}%`}
        />
        <StatCard label="今週" value={formatMinutes(summary.weekMinutes)} />
        <StatCard label="弱点" value={`${summary.weakCount}件`} />
        <StatCard label="今日の復習" value={`${summary.dueReviewCount}件`} />
      </div>

      {outlook ? <SubjectOutlookCard forecast={outlook} /> : null}

      {summary.focus ? (
        <Card className="flex items-center gap-3 p-4">
          <ArrowRight className="text-primary size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">次に取り組む単元</p>
            <p className="truncate text-sm font-medium">
              {summary.focus.category.name} / {summary.focus.topic.name}
            </p>
          </div>
          <Link
            href={`/roadmap?topic=${summary.focus.topic.id}`}
            className="text-primary shrink-0 text-xs hover:underline"
          >
            詳細 →
          </Link>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>分野別</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {summary.categories.map((c) => (
              <section key={c.category.id} id={`cat-${c.category.id}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{c.category.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    習熟度 {Math.round(c.score)}% ・ {c.doneCount}/{c.topicCount}
                  </span>
                </div>
                <Meter value={c.score} showValue={false} label={`${c.category.name}の習熟度`} />
                <TopicTable metrics={byCategory.get(c.category.id) ?? []} />
              </section>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>この科目の弱点</CardTitle>
          </CardHeader>
          <CardContent>
            {weak.length === 0 ? (
              <p className="text-muted-foreground text-sm">弱点候補はありません。</p>
            ) : (
              <ul className="space-y-2">
                {weak.map((m) => (
                  <li key={m.topic.id} className="text-sm">
                    <Link
                      href={`/roadmap?topic=${m.topic.id}`}
                      className="hover:text-primary font-medium"
                    >
                      {m.topic.name}
                    </Link>
                    <p className="text-muted-foreground text-[11px]">
                      {m.weakness.reasons.join("・")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
