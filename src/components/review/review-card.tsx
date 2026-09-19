"use client";

import { Flame, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Meter } from "@/components/common/meter";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { REVIEW_INTERVALS_DAYS, REVIEW_OUTCOME_META } from "@/lib/constants";
import type { ReviewQueueItem } from "@/lib/model/buildStudyModel";
import type { ReviewOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReviewCard({ item }: { item: ReviewQueueItem }) {
  const repo = useRepository();
  const [busy, setBusy] = useState(false);
  const [showCounts, setShowCounts] = useState(false);
  const [attempted, setAttempted] = useState("");
  const [correct, setCorrect] = useState("");
  const m = item.metrics;
  const interval = REVIEW_INTERVALS_DAYS[item.review.stage] ?? 1;
  const overdue = item.overdueDays > 0;

  async function complete(outcome: ReviewOutcome) {
    setBusy(true);
    try {
      const a = Number.parseInt(attempted, 10) || 0;
      const c = Math.min(a, Number.parseInt(correct, 10) || 0);
      await repo.completeReview(
        item.review.id,
        outcome,
        a > 0 ? { attemptedCount: a, correctCount: c } : undefined,
      );
      toast({
        title: `${m.topic.name}：${REVIEW_OUTCOME_META[outcome].label}`,
        description:
          outcome === "got"
            ? "次の復習を予約しました"
            : outcome === "failed"
              ? "1日後からやり直します"
              : "同じ間隔でもう一度",
        variant: outcome === "got" ? "success" : outcome === "failed" ? "error" : "default",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        overdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {item.overdueDays >= 2 ? (
              <Flame className="text-destructive size-3.5 shrink-0" />
            ) : overdue ? (
              <TriangleAlert className="text-warning size-3.5 shrink-0" />
            ) : null}
            <span className="truncate">
              <span className="text-muted-foreground">{m.subject.name} / </span>
              {m.topic.name}
            </span>
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            予定：{item.dueLabel} ・ {item.amount} ・ {interval}日間隔
            {m.reviewCounts.failed > 0 ? ` ・ 失敗×${m.reviewCounts.failed}` : ""}
          </p>
        </div>
        <div className="w-24 shrink-0">
          <Meter value={m.mastery.score} label="習熟度" />
        </div>
      </div>

      {showCounts ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="問題数"
            value={attempted}
            onChange={(e) => setAttempted(e.target.value)}
            className="h-7 w-20 text-xs"
            aria-label="解いた問題数"
          />
          <span className="text-muted-foreground">問中</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="正解"
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            className="h-7 w-20 text-xs"
            aria-label="正解数"
          />
          <span className="text-muted-foreground">問正解</span>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void complete("got")}
          className="bg-success/15 text-success hover:bg-success/25"
        >
          できた
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void complete("shaky")}
        >
          怪しい
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void complete("failed")}
          className="bg-destructive/10 text-destructive hover:bg-destructive/20"
        >
          できなかった
        </Button>
      </div>
      <div className="text-muted-foreground mt-2 flex gap-3 text-[11px]">
        {!showCounts ? (
          <button type="button" className="hover:underline" onClick={() => setShowCounts(true)}>
            問題数も記録する
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          className="hover:underline"
          onClick={() => void repo.snoozeReview(item.review.id, 1)}
        >
          明日にずらす
        </button>
      </div>
    </div>
  );
}
