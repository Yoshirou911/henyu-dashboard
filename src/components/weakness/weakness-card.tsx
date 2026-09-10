"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/topic/status-badge";
import { useCategories, useReviews, useTopics } from "@/hooks/use-data";
import { weaknessItems } from "@/lib/analytics";

export function WeaknessCard({ limit = 5 }: { limit?: number }) {
  const topics = useTopics();
  const categories = useCategories();
  const reviews = useReviews();

  if (topics === undefined || categories === undefined || reviews === undefined) {
    return <Skeleton className="h-56 w-full rounded-xl" />;
  }

  const items = weaknessItems(topics, categories, reviews, { limit });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="text-warning size-4" />
          苦手単元
        </CardTitle>
        <CardDescription>復習の結果と停滞期間から自動抽出しています。</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="いまのところ苦手候補はありません"
            description="復習で「できなかった」が増えたり、長期間ステータスが動かない単元がここに出ます。"
          />
        ) : (
          <ol className="space-y-2">
            {items.map((item, i) => (
              <li key={item.topic.id}>
                <Link
                  href={`/roadmap?topic=${item.topic.id}`}
                  className="border-border hover:border-primary/50 flex items-start gap-3 rounded-lg border p-2.5 transition-colors"
                >
                  <span className="bg-warning/15 text-warning mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{item.topic.name}</span>
                      <StatusBadge status={item.topic.status} />
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{item.categoryName}</p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {item.reasons.join(" ・ ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
