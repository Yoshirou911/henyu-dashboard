"use client";

import { CalendarClock, Pencil } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-data";
import { daysUntil, longDateLabel } from "@/lib/date";

export function ExamCountdown() {
  const settings = useSettings();

  if (!settings) {
    return <Skeleton className="h-[132px] w-full rounded-xl" />;
  }

  const days = daysUntil(settings.examDate);
  const past = days < 0;

  return (
    <Card className="relative overflow-hidden p-5">
      <div
        className="bg-primary/10 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <CalendarClock className="size-3.5" />
            {settings.examName}
          </p>
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {past ? (
              <>
                <span className="text-muted-foreground">試験日から</span> {Math.abs(days)}{" "}
                <span className="text-muted-foreground text-lg font-medium">日経過</span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">あと</span>{" "}
                <span className="text-primary tabular-nums">{days}</span>{" "}
                <span className="text-muted-foreground text-lg font-medium">日</span>
              </>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            試験日: {longDateLabel(settings.examDate)}
          </p>
        </div>
        <Link
          href="/settings"
          className="border-border text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 rounded-md border p-1.5 transition-colors"
          aria-label="試験日を変更"
        >
          <Pencil className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
