"use client";

import { ClipboardPlus, Play, Repeat } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { useRecorder } from "@/components/record/record-provider";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { useTimer } from "@/hooks/use-timer";
import type { PlanItem, TodayPlan } from "@/lib/planner/buildTodayPlan";
import { cn, formatMinutes } from "@/lib/utils";

export function useStartPlanItem() {
  const timer = useTimer();
  return (item: PlanItem) => {
    if (timer.hasSession && timer.target.topicId !== item.topicId) {
      toast({ title: "計測中のタイマーがあります", description: "先に終了して記録してください。" });
      return;
    }
    const target = {
      topicId: item.topicId,
      topicName: item.topicName,
      subjectId: item.subjectId,
      plannedMinutes: item.minutes,
    };
    timer.setTarget(target);
    timer.start(target);
    toast({
      title: `「${item.topicName}」を開始`,
      description: `予定 ${item.minutes}分・${item.task}`,
    });
  };
}

export function PlanList({
  plan,
  limit,
  compact = false,
}: {
  plan: TodayPlan;
  limit?: number;
  compact?: boolean;
}) {
  const start = useStartPlanItem();
  const { openRecord } = useRecorder();
  const items = limit ? plan.items.slice(0, limit) : plan.items;

  if (plan.items.length === 0) {
    return (
      <EmptyState
        title="今日の推奨学習はありません"
        description="単元のステータスを更新すると、ここに優先度順の学習が並びます。"
      />
    );
  }

  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${item.kind}:${item.topicId}`}
          className={cn(
            "border-border flex items-start gap-3 rounded-lg border p-3",
            item.kind === "review" && (item.overdueDays ?? 0) > 0 && "border-warning/40",
          )}
        >
          <span className="bg-muted mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
              <span className="text-muted-foreground">{item.subjectName} /</span>
              <span className="font-medium">{item.topicName}</span>
              {item.kind === "review" ? (
                <span className="bg-primary/10 text-primary inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-medium">
                  <Repeat className="size-2.5" /> 復習
                </span>
              ) : null}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.task} ・ {item.minutes}分
            </p>
            {item.reasons.length > 0 && !compact ? (
              <p className="text-muted-foreground mt-1 text-[11px]">
                理由：{item.reasons.slice(0, 3).join("・")}
              </p>
            ) : null}
            {item.reasons.length > 0 && compact ? (
              <p className="text-muted-foreground mt-1 truncate text-[11px]">{item.reasons[0]}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`${item.topicName} の結果を記録`}
              onClick={() => openRecord({ mode: "exercise", topicId: item.topicId })}
            >
              <ClipboardPlus />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={`${item.topicName} を開始`}
              onClick={() => start(item)}
            >
              <Play />
            </Button>
          </div>
        </li>
      ))}
      {limit && plan.items.length > limit ? (
        <li className="text-muted-foreground text-center text-xs">
          ほか {plan.items.length - limit} 件
        </li>
      ) : null}
      {plan.bufferMinutes > 0 && !limit ? (
        <li className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
          残り {formatMinutes(plan.bufferMinutes)} ・ 予備（復習・苦手の見直しに）
        </li>
      ) : null}
    </ol>
  );
}
