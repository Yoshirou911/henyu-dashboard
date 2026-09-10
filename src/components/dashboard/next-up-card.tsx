"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRepository } from "@/components/providers/repository-provider";
import { StatusSelect } from "@/components/topic/status-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrimarySubject, useOrderedSubjectTopics } from "@/hooks/use-data";
import { findUpcomingTopics } from "@/lib/progress";
import type { Status } from "@/lib/types";
import { Fragment } from "react";

export function NextUpCard() {
  const repo = useRepository();
  const subject = usePrimarySubject();
  const views = useOrderedSubjectTopics(subject?.id);

  if (!subject || !views) {
    return <Skeleton className="h-[220px] w-full rounded-xl" />;
  }

  const orderedTopics = views.map((v) => v.topic);
  const upcoming = findUpcomingTopics(orderedTopics, 3);
  const viewByTopic = new Map(views.map((v) => [v.topic.id, v]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider">
            NEXT
          </span>
          次にやること
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <EmptyState
            title="すべての単元が定着以上です"
            description="過去問レベルへの引き上げや、復習に取り組みましょう。"
          />
        ) : (
          <ol className="space-y-1">
            {upcoming.map((topic, i) => {
              const view = viewByTopic.get(topic.id);
              return (
                <Fragment key={topic.id}>
                  {i > 0 ? (
                    <li className="flex justify-center py-0.5" aria-hidden>
                      <ArrowDown className="text-muted-foreground size-3" />
                    </li>
                  ) : null}
                  <li>
                    <div className="border-border flex items-center gap-3 rounded-lg border p-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/roadmap?topic=${topic.id}`}
                          className="hover:text-primary block truncate text-sm font-medium"
                        >
                          {topic.name}
                        </Link>
                        <p className="text-muted-foreground truncate text-xs">
                          {view?.category.name}
                        </p>
                      </div>
                      <StatusSelect
                        value={topic.status}
                        onChange={(s: Status) => repo.setTopicStatus(topic.id, s)}
                      />
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
        <Link
          href="/today"
          className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          今日ページで集中する <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
