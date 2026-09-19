"use client";

import { ClipboardPlus, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useRecorder } from "@/components/record/record-provider";
import { TopicPicker } from "@/components/topic/topic-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration } from "@/lib/utils";

/** Topic selection + clock + controls. Shared by the top-bar dialog and the Today page. */
export function TimerPanel({ onRecordOpen }: { onRecordOpen?: () => void }) {
  const model = useStudyModel();
  const timer = useTimer();
  const { openRecord } = useRecorder();

  if (!model) return <Skeleton className="h-48 w-full rounded-lg" />;

  const locked = timer.running || timer.elapsedSec > 0;
  const topicMetrics = timer.target.topicId
    ? model.topicMetrics.get(timer.target.topicId)
    : undefined;
  const subjectId = topicMetrics?.subject.id ?? timer.target.subjectId ?? null;
  const planned = timer.target.plannedMinutes ?? null;
  const progress = planned ? Math.min(1, timer.elapsedSec / (planned * 60)) : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <TopicPicker
          model={model}
          subjectId={subjectId}
          topicId={timer.target.topicId}
          allowNone
          disabled={locked}
          onChange={({ subjectId: sid, topicId }) =>
            timer.setTarget({
              subjectId: sid,
              topicId,
              topicName: topicId ? (model.topicMetrics.get(topicId)?.topic.name ?? null) : null,
              plannedMinutes: null,
            })
          }
        />
        {locked ? (
          <p className="text-muted-foreground text-xs">計測中は単元を変更できません。</p>
        ) : null}
      </div>

      <div className="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-lg border py-5">
        <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
          {formatDuration(timer.elapsedSec)}
        </span>
        {planned ? (
          <div className="w-48 space-y-1">
            <div className="bg-muted h-1 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-[width]"
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground text-center text-[11px]">予定 {planned}分</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {timer.running ? (
            <Button variant="secondary" onClick={timer.pause}>
              <Pause /> 一時停止
            </Button>
          ) : (
            <Button onClick={() => timer.start()}>
              <Play /> {timer.elapsedSec > 0 ? "再開" : "学習開始"}
            </Button>
          )}
          <Button variant="outline" onClick={timer.finish} disabled={!timer.hasSession}>
            <Square /> 終了して記録
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={timer.reset}
            disabled={!timer.hasSession}
            aria-label="リセット"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => {
          onRecordOpen?.();
          openRecord({
            mode: "exercise",
            topicId: timer.target.topicId,
            subjectId,
          });
        }}
      >
        <ClipboardPlus /> タイマーを使わずに記録する
      </Button>
    </div>
  );
}
