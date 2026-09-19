"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_PROPS, ChartTooltip } from "@/components/analytics/chart-primitives";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { MockExamDialog } from "@/components/exams/mock-exam-dialog";
import { PastExamDialog } from "@/components/exams/past-exam-dialog";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudyModel } from "@/hooks/use-study-model";
import { PROBLEM_RESULT_META } from "@/lib/constants";
import { longDateLabel } from "@/lib/date";

type Tab = "past" | "mock";

export function ExamsScreen() {
  const repo = useRepository();
  const model = useStudyModel();
  const [tab, setTab] = useState<Tab>("past");
  const [dialog, setDialog] = useState<Tab | null>(null);

  const pastRows = useMemo(() => {
    if (!model) return [];
    const problems = model.snapshot.pastExamProblems;
    return model.snapshot.pastExams
      .slice()
      .sort((a, b) => b.year - a.year || b.date.localeCompare(a.date))
      .map((e) => ({
        exam: e,
        univ: e.universityId
          ? model.universities.find((u) => u.university.id === e.universityId)?.university.name
          : undefined,
        problems: problems.filter((p) => p.pastExamId === e.id).sort((a, b) => a.number - b.number),
      }));
  }, [model]);

  const chart = useMemo(
    () =>
      pastRows
        .slice()
        .reverse()
        .map((r) => ({
          label: `${(r.univ ?? r.exam.examLabel ?? "").replace("大学", "大")}${r.exam.year}`,
          percent: r.exam.maxScore > 0 ? Math.round((r.exam.score / r.exam.maxScore) * 100) : 0,
        })),
    [pastRows],
  );

  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="模試・過去問" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const mocks = model.snapshot.mockExams
    .slice()
    .sort((a, b) => b.examDate.localeCompare(a.examDate));

  return (
    <div className="space-y-6">
      <PageHeader
        title="模試・過去問"
        description="失点した単元は弱点判定と習熟度に反映されます。"
        actions={
          <Button size="sm" variant="outline" onClick={() => setDialog(tab)}>
            <Plus className="size-4" /> {tab === "past" ? "過去問を追加" : "模試を追加"}
          </Button>
        }
      />
      <ChipGroup
        aria-label="表示切替"
        value={tab}
        onChange={setTab}
        options={[
          { value: "past", label: `編入過去問 (${pastRows.length})` },
          { value: "mock", label: `模試 (${mocks.length})` },
        ]}
      />

      {tab === "past" ? (
        <>
          {chart.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>得点率の推移</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis dataKey="label" {...AXIS_PROPS} />
                      <YAxis {...AXIS_PROPS} width={44} domain={[0, 100]} unit="%" />
                      <Tooltip content={<ChartTooltip format={(v) => `${v}%`} />} />
                      <Line
                        type="monotone"
                        dataKey="percent"
                        name="得点率"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--chart-3)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {pastRows.length === 0 ? (
            <EmptyState
              title="過去問の記録はまだありません"
              description="大学・年度・得点と、大問ごとの単元と○△×を記録できます。"
              action={
                <Button size="sm" onClick={() => setDialog("past")}>
                  <Plus className="size-4" /> 過去問を追加
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {pastRows.map(({ exam, univ, problems }) => (
                <Card key={exam.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {univ ?? exam.examLabel ?? "大学未設定"} {exam.year}年度 ・ {exam.subject}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {longDateLabel(exam.date)}
                        {exam.durationMin ? ` ・ ${exam.durationMin}分` : ""}
                        {exam.memo ? ` ・ ${exam.memo}` : ""}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">
                          {exam.score}
                          <span className="text-muted-foreground text-sm"> / {exam.maxScore}</span>
                        </p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {exam.maxScore > 0 ? Math.round((exam.score / exam.maxScore) * 100) : 0}%
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="削除"
                        onClick={() => {
                          if (window.confirm("この過去問の記録を削除しますか？"))
                            void repo.deletePastExam(exam.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {problems.length > 0 ? (
                    <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                      {problems.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-12">第{p.number}問</span>
                          <span className="min-w-0 flex-1 truncate">
                            {p.topicId
                              ? (model.topicMetrics.get(p.topicId)?.topic.name ?? "—")
                              : "—"}
                          </span>
                          <span
                            className={
                              p.result === "correct"
                                ? "text-success"
                                : p.result === "partial"
                                  ? "text-warning"
                                  : "text-destructive"
                            }
                          >
                            {PROBLEM_RESULT_META[p.result].symbol}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : mocks.length === 0 ? (
        <EmptyState
          title="模試の記録はまだありません"
          action={
            <Button size="sm" onClick={() => setDialog("mock")}>
              <Plus className="size-4" /> 模試を追加
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-2 font-medium">模試</th>
                  <th className="py-2 pr-2 font-medium">科目</th>
                  <th className="py-2 pr-2 text-right font-medium">得点</th>
                  <th className="py-2 pr-2 text-right font-medium">偏差値</th>
                  <th className="py-2 pr-2 text-right font-medium">順位</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {mocks.map((m) => (
                  <tr key={m.id} className="border-border/60 border-b last:border-0">
                    <td className="py-2 pr-2">
                      <p>{m.examName}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {longDateLabel(m.examDate)}
                        {m.weakTopicIds?.length
                          ? ` ・ 失点: ${m.weakTopicIds
                              .map((id) => model.topicMetrics.get(id)?.topic.name)
                              .filter(Boolean)
                              .join("・")}`
                          : ""}
                      </p>
                    </td>
                    <td className="text-muted-foreground py-2 pr-2">{m.subject}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {m.score}/{m.maxScore}
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({m.maxScore > 0 ? Math.round((m.score / m.maxScore) * 100) : 0}%)
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{m.deviationValue ?? "—"}</td>
                    <td className="text-muted-foreground py-2 pr-2 text-right tabular-nums">
                      {m.rank ? `${m.rank}${m.participants ? `/${m.participants}` : ""}` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="削除"
                        onClick={() => void repo.deleteMockExam(m.id)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <PastExamDialog
        open={dialog === "past"}
        onOpenChange={(o) => !o && setDialog(null)}
        model={model}
      />
      <MockExamDialog
        open={dialog === "mock"}
        onOpenChange={(o) => !o && setDialog(null)}
        model={model}
      />
    </div>
  );
}
