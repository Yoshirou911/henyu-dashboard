"use client";

import { MoreVertical, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Meter, scoreColor } from "@/components/common/meter";
import { PageHeader } from "@/components/common/page-header";
import {
  DimensionsLine,
  useLearningDimensions,
} from "@/components/learning-dimensions/dimensions-ui";
import { useRepository } from "@/components/providers/repository-provider";
import { UniversityDialog } from "@/components/universities/university-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useStudyModel } from "@/hooks/use-study-model";
import { PRIORITY_META } from "@/lib/constants";
import { daysUntil, longDateLabel } from "@/lib/date";
import type { UniversitySummary } from "@/lib/model/buildStudyModel";

export function UniversitiesScreen() {
  const repo = useRepository();
  const model = useStudyModel();
  const dimensions = useLearningDimensions(model);
  const [editing, setEditing] = useState<UniversitySummary | "new" | null>(null);

  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="志望校" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  const primaryId = model.primaryUniversity?.university.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="志望校"
        description="準備度 = 各大学の必要科目の習熟度を、その大学の配点の重みで平均したもの。学習範囲・本番準備度も同じ重みで集計（合格の可能性ではありません）。"
        actions={
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> 追加
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {model.universities.map((u) => {
          const isPrimary = u.university.id === primaryId;
          const days = u.university.examDate
            ? daysUntil(u.university.examDate, new Date(model.now))
            : null;
          return (
            <Card key={u.university.id} className={isPrimary ? "border-primary/40 p-4" : "p-4"}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={isPrimary ? "default" : "secondary"}>
                      {isPrimary ? <Star className="size-3" /> : null}
                      {PRIORITY_META[u.university.priority].label}
                    </Badge>
                    <span className="font-medium">{u.university.name}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {u.university.faculty} {u.university.departmentOrCourse}
                  </p>
                </div>
                <div className="flex items-start gap-1">
                  <span
                    className="text-2xl font-semibold tabular-nums"
                    style={{ color: scoreColor(u.readiness.score) }}
                  >
                    {Math.round(u.readiness.score)}
                    <span className="text-muted-foreground text-sm">%</span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1 outline-none"
                      aria-label={`${u.university.name} の操作`}
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setEditing(u)}>
                        編集・必要科目
                      </DropdownMenuItem>
                      {!isPrimary ? (
                        <DropdownMenuItem
                          onClick={() => {
                            void repo.updateSettings({
                              primaryUniversityId: u.university.id,
                              ...(u.university.examDate ? { examDate: u.university.examDate } : {}),
                            });
                            toast({ title: `${u.university.name}を第一志望にしました` });
                          }}
                        >
                          第一志望にする
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onClick={() =>
                          void repo.updateUniversity(u.university.id, { archived: true })
                        }
                      >
                        アーカイブ
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive data-[highlighted]:text-destructive"
                        onClick={() => {
                          if (window.confirm(`${u.university.name}を削除しますか？`)) {
                            void repo.deleteUniversity(u.university.id);
                          }
                        }}
                      >
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ul className="mt-3 space-y-1.5">
                {u.readiness.breakdown.map((b) => (
                  <li
                    key={b.subjectId}
                    className="grid grid-cols-[6rem_1fr] items-center gap-2 text-xs"
                  >
                    <span className="truncate">
                      {model.subjectById.get(b.subjectId)?.name}
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        {Math.round(b.share * 100)}%{b.required ? "" : "・任意"}
                      </span>
                    </span>
                    <Meter value={b.score} label="習熟度" />
                  </li>
                ))}
                {u.readiness.breakdown.length === 0 ? (
                  <li className="text-muted-foreground text-xs">必要科目が未設定です。</li>
                ) : null}
              </ul>

              {dimensions?.byUniversity.get(u.university.id) && u.readiness.breakdown.length > 0 ? (
                <DimensionsLine
                  dims={dimensions.byUniversity.get(u.university.id)!}
                  className="mt-2"
                />
              ) : null}

              <dl className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                {u.university.examDate ? (
                  <div>
                    試験 {longDateLabel(u.university.examDate)}
                    {days !== null && days >= 0 ? `（あと${days}日）` : ""}
                  </div>
                ) : (
                  <div>試験日 未設定</div>
                )}
                {u.university.applicationDeadline ? (
                  <div>出願締切 {longDateLabel(u.university.applicationDeadline)}</div>
                ) : null}
                {u.university.resultDate ? (
                  <div>発表 {longDateLabel(u.university.resultDate)}</div>
                ) : null}
              </dl>
              {u.university.notes ? (
                <p className="text-muted-foreground mt-1 text-[11px]">{u.university.notes}</p>
              ) : null}
            </Card>
          );
        })}
      </div>

      <UniversityDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        summary={editing && editing !== "new" ? editing : undefined}
        model={model}
      />
    </div>
  );
}
