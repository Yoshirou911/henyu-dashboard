"use client";

import { ArrowDown } from "lucide-react";
import { Fragment } from "react";
import { Progress } from "@/components/ui/progress";
import type { CategoryProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

function scrollToCategory(id: string) {
  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function FlowNode({ item }: { item: CategoryProgress }) {
  const done = item.percent >= 100;
  const untouched = item.percent === 0;
  return (
    <button
      type="button"
      onClick={() => scrollToCategory(item.category.id)}
      className={cn(
        "hover:border-primary/60 w-full rounded-lg border p-3 text-left transition-colors",
        done && "border-success/50 bg-success/5",
        untouched && "border-border border-dashed bg-transparent",
        !done && !untouched && "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{item.category.name}</span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {Math.round(item.percent)}%
        </span>
      </div>
      <Progress
        value={item.percent}
        className="mt-2 h-1"
        indicatorClassName={cn(done && "bg-success")}
      />
      <p className="text-muted-foreground mt-1.5 text-[11px]">
        {item.doneCount}/{item.topicCount} 単元が定着以上
      </p>
    </button>
  );
}

export function RoadmapFlow({ categories }: { categories: CategoryProgress[] }) {
  const main = categories.filter((c) => c.category.track !== 1);
  const parallel = categories.filter((c) => c.category.track === 1);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
      <div className="space-y-2">
        {main.map((item, i) => (
          <Fragment key={item.category.id}>
            {i > 0 ? (
              <div className="flex justify-center py-0.5" aria-hidden>
                <ArrowDown className="text-muted-foreground size-3.5" />
              </div>
            ) : null}
            <FlowNode item={item} />
          </Fragment>
        ))}
      </div>

      {parallel.length > 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">並行ルート</p>
          {parallel.map((item) => (
            <FlowNode key={item.category.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
