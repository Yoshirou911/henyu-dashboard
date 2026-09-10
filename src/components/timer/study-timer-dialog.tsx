"use client";

import { Pause, Play, Plus, RotateCcw, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { usePrimarySubject, useOrderedSubjectTopics } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration } from "@/lib/utils";

const NO_TOPIC = "__none__";

export function StudyTimerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const repo = useRepository();
  const timer = useTimer();
  const subject = usePrimarySubject();
  const topicViews = useOrderedSubjectTopics(subject?.id);

  const [manualMinutes, setManualMinutes] = useState("25");

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [{ value: NO_TOPIC, label: "全体（単元なし）" }];
    for (const v of topicViews ?? []) {
      list.push({ value: v.topic.id, label: `${v.category.name} / ${v.topic.name}` });
    }
    return list;
  }, [topicViews]);

  const selected = timer.target.topicId ?? NO_TOPIC;

  function changeTopic(value: string) {
    if (value === NO_TOPIC) {
      timer.setTarget({ topicId: null, topicName: null, subjectId: subject?.id ?? null });
      return;
    }
    const view = (topicViews ?? []).find((v) => v.topic.id === value);
    timer.setTarget({
      topicId: value,
      topicName: view?.topic.name ?? null,
      subjectId: subject?.id ?? null,
    });
  }

  async function addManual() {
    const minutes = Number.parseInt(manualMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast({ title: "時間を正しく入力してください", variant: "error" });
      return;
    }
    const endedAt = Date.now();
    await repo.logStudySession({
      topicId: timer.target.topicId,
      subjectId: timer.target.subjectId ?? subject?.id ?? null,
      startedAt: endedAt - minutes * 60_000,
      endedAt,
      durationSec: minutes * 60,
      source: "manual",
    });
    toast({
      title: "学習時間を追加しました",
      description: `${timer.target.topicName ?? "全体"} ・ ${minutes}分`,
      variant: "success",
    });
  }

  const lockTopic = timer.running || timer.elapsedSec > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>学習タイマー</DialogTitle>
          <DialogDescription>
            単元を選んでスタート。停止すると学習時間へ自動で加算されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="timer-topic">対象の単元</Label>
          <Select
            id="timer-topic"
            items={options}
            value={selected}
            onValueChange={changeTopic}
            disabled={lockTopic}
            aria-label="学習する単元"
          />
          {lockTopic ? (
            <p className="text-muted-foreground text-xs">
              計測中は単元を変更できません。リセットすると変更できます。
            </p>
          ) : null}
        </div>

        <div className="border-border bg-muted/30 flex flex-col items-center gap-4 rounded-lg border py-6">
          <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {formatDuration(timer.elapsedSec)}
          </span>
          <div className="flex items-center gap-2">
            {timer.running ? (
              <Button variant="secondary" onClick={timer.pause}>
                <Pause /> 一時停止
              </Button>
            ) : (
              <Button onClick={() => timer.start()}>
                <Play /> {timer.elapsedSec > 0 ? "再開" : "スタート"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void timer.stop()}
              disabled={!timer.hasSession}
            >
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

        <div className="space-y-2">
          <Label htmlFor="manual-min">手動で追加（分）</Label>
          <div className="flex gap-2">
            <Input
              id="manual-min"
              type="number"
              min={1}
              inputMode="numeric"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              className="w-28"
            />
            <Button variant="secondary" onClick={() => void addManual()}>
              <Plus /> 追加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
