"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  FileText,
  Plus,
  Repeat,
  Sparkles,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivity } from "@/hooks/use-data";
import { DAY_MS, relativeDayLabel } from "@/lib/date";
import type { ActivityType } from "@/lib/types";

const ICONS: Record<ActivityType, LucideIcon> = {
  status_change: TrendingUp,
  study_logged: Timer,
  review_done: Repeat,
  goal_completed: CheckCircle2,
  exam_added: FileText,
  topic_added: Plus,
  seed: Sparkles,
  exercise_logged: ClipboardCheck,
  mock_added: GraduationCap,
};

function timeLabel(at: number) {
  const d = new Date(at);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function RecentActivity({ days = 7, limit = 30 }: { days?: number; limit?: number }) {
  const activity = useActivity(limit);
  const [mountedAt] = useState(() => Date.now());

  if (activity === undefined) {
    return <Skeleton className="h-[280px] w-full rounded-xl" />;
  }

  const cutoff = mountedAt - days * DAY_MS;
  const recent = activity.filter((a) => a.at >= cutoff);

  const groups: { label: string; items: typeof recent }[] = [];
  for (const item of recent) {
    const label = relativeDayLabel(item.at);
    const last = groups.at(-1);
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>最近の進捗</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="この7日間の記録はまだありません"
            description="ステータスの変更や学習の記録がここに時系列で表示されます。"
          />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-muted-foreground mb-2 text-xs font-medium">{group.label}</p>
                <ul className="space-y-2.5">
                  {group.items.map((item) => {
                    const Icon = ICONS[item.type];
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <span className="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                          <Icon className="size-3" />
                        </span>
                        <p className="flex-1 text-sm leading-tight">{item.message}</p>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {timeLabel(item.at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
