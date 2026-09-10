"use client";

import { Check, Pencil, Target } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { useDailyGoal } from "@/hooks/use-data";
import { dayKey } from "@/lib/date";
import type { DailyGoal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DailyGoalCard({ date = dayKey() }: { date?: string }) {
  const goal = useDailyGoal(date);

  return (
    <Card className={cn(goal?.done && "border-success/40 bg-success/5")}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Target className="text-primary size-4" />
          今日の目標
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goal === undefined ? (
          <div className="bg-muted/60 h-9 animate-pulse rounded-md" />
        ) : (
          <GoalBody key={goal?.id ?? "empty"} date={date} goal={goal} />
        )}
      </CardContent>
    </Card>
  );
}

function GoalBody({ date, goal }: { date: string; goal: DailyGoal | undefined }) {
  const repo = useRepository();
  const [draft, setDraft] = useState(goal?.text ?? "");
  const [editing, setEditing] = useState(!goal?.text);

  async function save() {
    const text = draft.trim();
    if (!text) {
      toast({ title: "目標を入力してください", variant: "error" });
      return;
    }
    await repo.setDailyGoal(date, text);
    setEditing(false);
  }

  async function toggleDone() {
    if (!goal?.text) return;
    await repo.setDailyGoalDone(date, !goal.done);
    if (!goal.done) toast({ title: "今日の目標を達成しました 🎉", variant: "success" });
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex gap-2"
      >
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例: 関数の基礎を「基本OK」まで"
        />
        <Button type="submit">保存</Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void toggleDone()}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
          goal?.done
            ? "border-success bg-success text-success-foreground"
            : "border-border text-muted-foreground hover:border-primary hover:text-primary",
        )}
        aria-pressed={goal?.done}
        aria-label={goal?.done ? "未完了に戻す" : "達成にする"}
      >
        <Check className="size-4" />
      </button>
      <p
        className={cn(
          "flex-1 text-sm font-medium",
          goal?.done && "text-muted-foreground line-through",
        )}
      >
        {goal?.text}
      </p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="目標を編集"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
