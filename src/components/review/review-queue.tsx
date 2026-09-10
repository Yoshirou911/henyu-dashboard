"use client";

import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ReviewCard } from "@/components/review/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories, useOpenReviews, useTopics } from "@/hooks/use-data";
import { isDue } from "@/lib/review-schedule";

export function ReviewQueue({ limit }: { limit?: number }) {
  const reviews = useOpenReviews();
  const topics = useTopics();
  const categories = useCategories();

  if (reviews === undefined || topics === undefined || categories === undefined) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const topicById = new Map(topics.map((t) => [t.id, t]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  const due = reviews
    .filter((r) => isDue(r) && topicById.has(r.topicId))
    .sort((a, b) => a.dueAt - b.dueAt);
  const shown = limit ? due.slice(0, limit) : due;

  if (due.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="今日の復習はありません"
        description="単元を「基本OK」にすると、翌日から復習候補が並びます。"
      />
    );
  }

  return (
    <div className="space-y-3">
      {shown.map((review) => {
        const topic = topicById.get(review.topicId);
        if (!topic) return null;
        return (
          <ReviewCard
            key={review.id}
            review={review}
            topic={topic}
            category={catById.get(topic.categoryId)}
          />
        );
      })}
      {limit && due.length > limit ? (
        <p className="text-muted-foreground text-center text-xs">
          ほか {due.length - limit} 件（復習ページで確認）
        </p>
      ) : null}
    </div>
  );
}
