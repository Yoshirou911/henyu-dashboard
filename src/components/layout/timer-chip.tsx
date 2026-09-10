"use client";

import { Timer } from "lucide-react";
import { useState } from "react";
import { StudyTimerDialog } from "@/components/timer/study-timer-dialog";
import { useTimer } from "@/hooks/use-timer";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";

export function TimerChip() {
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const active = timer.running || timer.elapsedSec > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "focus-visible:ring-ring inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
          active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
        aria-label="学習タイマーを開く"
      >
        <span className="relative flex size-2">
          {timer.running ? (
            <span className="bg-primary/60 absolute inline-flex size-full animate-ping rounded-full" />
          ) : null}
          <Timer className={cn("size-3.5", active ? "text-primary" : "")} />
        </span>
        {active ? (
          <span className="font-mono tabular-nums">{formatDuration(timer.elapsedSec)}</span>
        ) : (
          <span className="hidden sm:inline">タイマー</span>
        )}
      </button>
      <StudyTimerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
