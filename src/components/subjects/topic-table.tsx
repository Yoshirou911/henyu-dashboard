"use client";

import { Check, ClipboardPlus, Lock } from "lucide-react";
import Link from "next/link";
import { Meter, RatePill } from "@/components/common/meter";
import { useRepository } from "@/components/providers/repository-provider";
import { useRecorder } from "@/components/record/record-provider";
import { StatusSelect } from "@/components/topic/status-select";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { TopicMetrics } from "@/lib/model/buildStudyModel";
import type { Status } from "@/lib/types";

/** Dense per-topic list: status · mastery · 直近正答率 · ready · quick record. */
export function TopicTable({ metrics }: { metrics: TopicMetrics[] }) {
  const repo = useRepository();
  const { openRecord } = useRecorder();

  return (
    <ul className="divide-border divide-y">
      {metrics.map((m) => (
        <li key={m.topic.id} className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/roadmap?topic=${m.topic.id}`}
              className="hover:text-primary flex items-center gap-1.5 text-sm"
            >
              <span className="truncate">{m.topic.name}</span>
              {m.ready.ready && m.topic.status < 3 ? (
                <Tooltip content="次へ進む条件を達成">
                  <Check className="text-success size-3.5 shrink-0" />
                </Tooltip>
              ) : null}
              {!m.depsMet ? (
                <Tooltip
                  content={`前提: ${[...m.lockedBy.map((c) => c.name), ...m.unmetDeps.map((d) => d.name)].join("・")}`}
                >
                  <Lock className="text-muted-foreground size-3 shrink-0" />
                </Tooltip>
              ) : null}
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <Meter value={m.mastery.score} className="max-w-40 flex-1" label="習熟度" />
            </div>
          </div>
          <RatePill rate={m.accuracy.recent.rate} className="hidden sm:inline" />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`${m.topic.name} の結果を記録`}
            onClick={() => openRecord({ mode: "exercise", topicId: m.topic.id })}
          >
            <ClipboardPlus />
          </Button>
          <StatusSelect
            value={m.topic.status}
            onChange={(s: Status) => repo.setTopicStatus(m.topic.id, s)}
          />
        </li>
      ))}
    </ul>
  );
}
