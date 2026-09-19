"use client";

import { ArrowRight, EyeOff } from "lucide-react";
import Link from "next/link";
import { Meter, scoreColor } from "@/components/common/meter";
import { PageHeader } from "@/components/common/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import { formatMinutes } from "@/lib/utils";

export const EVALUATION_LABEL = {
  problem: "問題演習型",
  language: "語学型",
  interview: "面接型",
} as const;

export function SubjectsScreen() {
  const model = useStudyModel();
  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="科目" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="科目"
        description="習熟度は各単元の masteryScore の加重平均。科目の追加・非表示は設定から。"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.subjectSummaries.map((s) => (
          <Link key={s.subject.id} href={`/subjects/${s.subject.id}`} className="group">
            <Card className="group-hover:border-primary/40 h-full p-4 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    {s.subject.name}
                    {s.subject.hidden ? (
                      <EyeOff className="text-muted-foreground size-3.5" />
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {EVALUATION_LABEL[s.evaluationType]} ・ {s.doneCount}/{s.topicCount}
                    単元が定着以上
                  </p>
                </div>
                <span
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: scoreColor(s.score) }}
                >
                  {Math.round(s.score)}
                  <span className="text-muted-foreground text-sm">%</span>
                </span>
              </div>
              <Meter value={s.score} showValue={false} className="mt-3" label="習熟度" />
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <dt className="text-muted-foreground">今週</dt>
                  <dd className="font-medium tabular-nums">{formatMinutes(s.weekMinutes)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">弱点</dt>
                  <dd className="font-medium tabular-nums">{s.weakCount}件</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">復習</dt>
                  <dd className="font-medium tabular-nums">{s.dueReviewCount}件</dd>
                </div>
              </dl>
              {s.focus ? (
                <p className="text-muted-foreground mt-3 flex items-center gap-1 truncate text-xs">
                  <ArrowRight className="size-3 shrink-0" /> 次：{s.focus.topic.name}
                </p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
