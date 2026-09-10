"use client";

import { ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useRepository } from "@/components/providers/repository-provider";
import { StatusSelect } from "@/components/topic/status-select";
import { Tooltip } from "@/components/ui/tooltip";
import { relativeDayLabel } from "@/lib/date";
import type { Status, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopicRowProps {
  topic: Topic;
  index: number;
  count: number;
  onOpen: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

export function TopicRow({ topic, index, count, onOpen, onMove }: TopicRowProps) {
  const repo = useRepository();

  return (
    <div className="group hover:bg-accent/50 flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors">
      <div className="flex flex-col opacity-40 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove(topic.id, -1)}
          disabled={index === 0}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="上へ移動"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onMove(topic.id, 1)}
          disabled={index === count - 1}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="下へ移動"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen(topic.id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="truncate text-sm">{topic.name}</span>
        {topic.weight !== 1 ? (
          <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-medium">
            ×{topic.weight}
          </span>
        ) : null}
        {topic.note ? (
          <Tooltip content={topic.note}>
            <span className="text-muted-foreground">
              <StickyNote className="size-3" />
            </span>
          </Tooltip>
        ) : null}
      </button>

      <span
        className={cn(
          "text-muted-foreground hidden shrink-0 text-xs sm:block",
          !topic.lastStudiedAt && "opacity-0",
        )}
      >
        {topic.lastStudiedAt ? relativeDayLabel(topic.lastStudiedAt) : "—"}
      </span>

      <StatusSelect
        value={topic.status}
        onChange={(s: Status) => repo.setTopicStatus(topic.id, s)}
      />
    </div>
  );
}
