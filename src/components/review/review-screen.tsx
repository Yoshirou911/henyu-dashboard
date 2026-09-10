"use client";

import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { useRepository } from "@/components/providers/repository-provider";
import { ReviewQueue } from "@/components/review/review-queue";
import { WeaknessCard } from "@/components/weakness/weakness-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { REVIEW_OUTCOME_META } from "@/lib/constants";
import { relativeDayLabel, shortDateLabel, startOfDay } from "@/lib/date";
import { useCategories, useReviews, useSettings, useTopics } from "@/hooks/use-data";

export function ReviewScreen() {
  const repo = useRepository();
  const reviews = useReviews();
  const topics = useTopics();
  const categories = useCategories();
  const settings = useSettings();

  const topicById = new Map((topics ?? []).map((t) => [t.id, t]));
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));

  const upcoming = (reviews ?? [])
    .filter((r) => !r.completedAt && r.dueAt >= startOfDay() + 1 && topicById.has(r.topicId))
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, 12);

  const history = (reviews ?? [])
    .filter((r) => r.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <PageHeader
        title="復習"
        description="固定間隔（1・3・7・14・30日）で復習候補を提示します。"
      />

      {settings ? (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="auto-lower" className="text-sm">
                「できなかった」でステータスを自動的に下げる
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                オフの場合はステータスを維持し、最初の間隔でやり直します。
              </p>
            </div>
            <Switch
              id="auto-lower"
              checked={settings.autoLowerStatusOnFailedReview}
              onCheckedChange={(checked) =>
                repo.updateSettings({ autoLowerStatusOnFailedReview: checked })
              }
            />
          </div>
        </Card>
      ) : (
        <Skeleton className="h-20 w-full rounded-xl" />
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">期限が来ている復習</h2>
        <ReviewQueue />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="text-muted-foreground size-4" />
              今後の予定
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews === undefined ? (
              <Skeleton className="h-32 w-full" />
            ) : upcoming.length === 0 ? (
              <EmptyState title="予定されている復習はありません" />
            ) : (
              <ul className="space-y-2">
                {upcoming.map((r) => {
                  const topic = topicById.get(r.topicId);
                  if (!topic) return null;
                  return (
                    <li
                      key={r.id}
                      className="border-border flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{topic.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {catById.get(topic.categoryId)?.name}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {shortDateLabel(r.dueAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>復習履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {reviews === undefined ? (
              <Skeleton className="h-32 w-full" />
            ) : history.length === 0 ? (
              <EmptyState title="まだ復習の記録はありません" />
            ) : (
              <ul className="space-y-2">
                {history.map((r) => {
                  const topic = topicById.get(r.topicId);
                  const meta = r.outcome ? REVIEW_OUTCOME_META[r.outcome] : null;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{topic?.name ?? "（削除済み）"}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {meta ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              color: `var(--${meta.token})`,
                              backgroundColor: `color-mix(in oklch, var(--${meta.token}) 15%, transparent)`,
                            }}
                          >
                            {meta.label}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-xs">
                          {r.completedAt ? relativeDayLabel(r.completedAt) : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <WeaknessCard limit={6} />
    </div>
  );
}
