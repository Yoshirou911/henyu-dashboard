"use client";

import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ReviewCard } from "@/components/review/review-card";
import type { StudyModel } from "@/lib/model/buildStudyModel";

/** Prioritised due reviews (spec §14 order is applied in the model). */
export function ReviewQueue({ model, limit }: { model: StudyModel; limit?: number }) {
  const queue = model.reviewQueue;
  const shown = limit ? queue.slice(0, limit) : queue;

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="今日の復習はありません"
        description="単元を「基本OK」にすると、1・3・7・14・30日後に復習候補が並びます。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {shown.map((item) => (
        <ReviewCard key={item.review.id} item={item} />
      ))}
      {limit && queue.length > limit ? (
        <p className="text-muted-foreground text-center text-xs">
          ほか {queue.length - limit} 件（復習ページで確認）
        </p>
      ) : null}
    </div>
  );
}
