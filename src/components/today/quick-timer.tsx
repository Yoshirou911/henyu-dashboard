"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { usePrimarySubject, useOrderedSubjectTopics } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { formatDuration } from "@/lib/utils";

const NO_TOPIC = "__none__";

export function QuickTimer() {
  const timer = useTimer();
  const subject = usePrimarySubject();
  const topicViews = useOrderedSubjectTopics(subject?.id);

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [{ value: NO_TOPIC, label: "全体（単元なし）" }];
    for (const v of topicViews ?? []) {
      list.push({ value: v.topic.id, label: `${v.category.name} / ${v.topic.name}` });
    }
    return list;
  }, [topicViews]);

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

  const lockTopic = timer.running || timer.elapsedSec > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>学習タイマー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          items={options}
          value={timer.target.topicId ?? NO_TOPIC}
          onValueChange={changeTopic}
          disabled={lockTopic}
          aria-label="学習する単元"
        />
        <div className="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-lg border py-5">
          <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums">
            {formatDuration(timer.elapsedSec)}
          </span>
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
      </CardContent>
    </Card>
  );
}
