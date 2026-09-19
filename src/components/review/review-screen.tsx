"use client";

import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useRepository } from "@/components/providers/repository-provider";
import { ReviewQueue } from "@/components/review/review-queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useStudyModel } from "@/hooks/use-study-model";
import { REVIEW_OUTCOME_META } from "@/lib/constants";
import { relativeDayLabel, shortDateLabel } from "@/lib/date";

export function ReviewScreen() {
  const repo = useRepository();
  const model = useStudyModel();

  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="復習" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const history = model.snapshot.reviews
    .filter((r) => r.completedAt)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    .slice(0, 15);
  const topicName = (id: string) => model.topicMetrics.get(id)?.topic.name ?? "（削除済み）";

  return (
    <div className="space-y-6">
      <PageHeader
        title="復習"
        description="基本OKになった日から 1・3・7・14・30日後。期限超過 → 習熟度 → 失敗回数 → 第一志望の重要度 → 前提単元 の順。"
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">今日の復習 {model.reviewQueue.length}件</h2>
          {model.overdueCount > 0 ? (
            <span className="text-destructive text-xs font-medium">
              期限超過 {model.overdueCount}件
            </span>
          ) : null}
        </div>
        <ReviewQueue model={model} />
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
            {model.upcomingReviews.length === 0 ? (
              <EmptyState title="予定されている復習はありません" />
            ) : (
              <ul className="space-y-2">
                {model.upcomingReviews.slice(0, 12).map((item) => (
                  <li
                    key={item.review.id}
                    className="border-border flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{item.metrics.subject.name} / </span>
                      {item.metrics.topic.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {shortDateLabel(item.review.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>復習履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState title="まだ復習の記録はありません" />
            ) : (
              <ul className="space-y-2">
                {history.map((r) => {
                  const meta = r.outcome ? REVIEW_OUTCOME_META[r.outcome] : null;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{topicName(r.topicId)}</span>
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

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-lower" className="text-sm">
              「できなかった」でステータスを自動的に下げる
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              オフの場合はステータスを維持し、1日後からやり直します。
            </p>
          </div>
          <Switch
            id="auto-lower"
            checked={model.settings.autoLowerStatusOnFailedReview}
            onCheckedChange={(checked) =>
              repo.updateSettings({ autoLowerStatusOnFailedReview: checked })
            }
          />
        </div>
      </Card>
    </div>
  );
}
