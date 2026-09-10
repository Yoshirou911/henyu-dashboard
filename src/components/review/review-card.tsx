"use client";

import { Clock } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { StatusBadge } from "@/components/topic/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { REVIEW_INTERVALS_DAYS, REVIEW_OUTCOME_META } from "@/lib/constants";
import { shortDateLabel, startOfDay } from "@/lib/date";
import type { Category, Review, ReviewOutcome, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewCardProps {
  review: Review;
  topic: Topic;
  category?: Category;
}

export function ReviewCard({ review, topic, category }: ReviewCardProps) {
  const repo = useRepository();
  const [busy, setBusy] = useState(false);

  const overdue = review.dueAt < startOfDay();
  const intervalDays = REVIEW_INTERVALS_DAYS[review.stage] ?? 1;

  async function complete(outcome: ReviewOutcome) {
    setBusy(true);
    try {
      await repo.completeReview(review.id, outcome);
      const meta = REVIEW_OUTCOME_META[outcome];
      toast({
        title: `「${topic.name}」の復習: ${meta.label}`,
        description:
          outcome === "got"
            ? "次の復習を予約しました。"
            : outcome === "failed"
              ? "最初の間隔でやり直します。"
              : "同じ間隔でもう一度確認します。",
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
          <p className="truncate text-sm font-medium">{topic.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {category?.name} ・ {intervalDays}日間隔（ステージ {review.stage + 1}）
          </p>
        </div>
        <StatusBadge status={topic.status} />
      </div>

      <p className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
        <Clock className="size-3" />
        {overdue ? "期限超過 ・ " : ""}
        期限 {shortDateLabel(review.dueAt)}
      </p>

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

      <button
        type="button"
        disabled={busy}
        onClick={() => void repo.snoozeReview(review.id, 1)}
        className="text-muted-foreground mt-2 text-[11px] underline-offset-2 hover:underline"
      >
        明日にずらす
      </button>
    </div>
  );
}
