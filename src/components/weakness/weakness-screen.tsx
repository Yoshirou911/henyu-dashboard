"use client";

import { ClipboardPlus, TrendingUp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { RatePill } from "@/components/common/meter";
import { PageHeader } from "@/components/common/page-header";
import { useRecorder } from "@/components/record/record-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import { formatRate } from "@/lib/mastery/accuracy";

export function WeaknessScreen() {
  const model = useStudyModel();
  const { openRecord } = useRecorder();

  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="弱点" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="弱点"
        description="正答率・復習失敗・停滞・過去問/模試の失点・復習期限超過・第一志望での重要度から全科目横断で判定。"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="text-warning size-4" />
            現在の弱点 {model.weakList.length}件
          </CardTitle>
          <CardDescription>数値は直近正答率（未演習なら習熟度）</CardDescription>
        </CardHeader>
        <CardContent>
          {model.weakList.length === 0 ? (
            <EmptyState
              title="弱点候補はありません"
              description="問題演習や復習の結果を記録すると、苦手な単元がここに出ます。"
            />
          ) : (
            <ol className="space-y-2">
              {model.weakList.map((m, i) => (
                <li
                  key={m.topic.id}
                  className="border-border flex items-start gap-3 rounded-lg border p-3"
                >
                  <span className="bg-warning/15 text-warning mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/roadmap?topic=${m.topic.id}`}
                      className="hover:text-primary text-sm font-medium"
                    >
                      <span className="text-muted-foreground">{m.subject.name} / </span>
                      {m.topic.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {m.weakness.reasons.join("・")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      弱点スコア {m.weakness.score} ・ 習熟度 {m.mastery.score}
                    </p>
                  </div>
                  <RatePill rate={m.accuracy.recent.rate ?? m.mastery.score / 100} />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${m.topic.name} の結果を記録`}
                    onClick={() => openRecord({ mode: "exercise", topicId: m.topic.id })}
                  >
                    <ClipboardPlus />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="text-success size-4" />
            改善中
          </CardTitle>
          <CardDescription>直近の正答率が以前より15ポイント以上上がった単元</CardDescription>
        </CardHeader>
        <CardContent>
          {model.improvingList.length === 0 ? (
            <p className="text-muted-foreground text-sm">まだありません。</p>
          ) : (
            <ul className="space-y-1.5">
              {model.improvingList.map((m) => (
                <li key={m.topic.id} className="flex items-center gap-2 text-sm">
                  <span className="text-success">↑</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{m.subject.name} / </span>
                    {m.topic.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatRate(m.accuracy.earlier.rate)} → {formatRate(m.accuracy.recent.rate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
