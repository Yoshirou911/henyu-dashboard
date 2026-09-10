"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrimarySubject, useSubjectProgress } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

export function OverallProgress() {
  const subject = usePrimarySubject();
  const progress = useSubjectProgress(subject?.id);

  if (!subject || !progress) {
    return <Skeleton className="h-[360px] w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>総合進捗</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-5">
          <ProgressRing value={progress.percent} size={128} strokeWidth={11}>
            <span className="text-2xl font-semibold tabular-nums">
              {Math.round(progress.percent)}
              <span className="text-muted-foreground text-sm">%</span>
            </span>
          </ProgressRing>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{subject.name}</p>
            <p className="text-muted-foreground text-sm">
              {progress.doneCount} / {progress.topicCount} 単元が定着以上
            </p>
            <Link
              href="/roadmap"
              className="text-primary inline-block text-xs font-medium hover:underline"
            >
              ロードマップを開く →
            </Link>
          </div>
        </div>

        <div className="space-y-2.5">
          {progress.categories.map((cat) => (
            <Link
              key={cat.category.id}
              href={`/roadmap#${cat.category.id}`}
              className="group block space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/90 group-hover:text-foreground font-medium">
                  {cat.category.name}
                  {cat.category.track === 1 ? (
                    <span className="text-muted-foreground ml-1.5 text-[10px]">並行</span>
                  ) : null}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(cat.percent)}%
                </span>
              </div>
              <Progress
                value={cat.percent}
                className="h-1.5"
                indicatorClassName={cn(cat.percent >= 100 && "bg-success")}
              />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
