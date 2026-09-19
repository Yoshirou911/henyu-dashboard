"use client";

import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { useRepository } from "@/components/providers/repository-provider";
import { TopicPicker } from "@/components/topic/topic-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useStudyModel } from "@/hooks/use-study-model";
import { STATUS_LIST } from "@/lib/constants";
import { daysUntil, longDateLabel, monthKey } from "@/lib/date";
import { PACE_META, goalProgress, monthlySummary } from "@/lib/goals/monthlyProgress";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ID, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1));
}

export function GoalsScreen() {
  const model = useStudyModel();
  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="目標" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="目標"
        description="月間目標は経過日数と比べて「前倒し／予定通り／少し遅れ／大幅遅れ」を判定。単元を指定するとプランナーが優先します。"
      />
      <MonthlyGoals model={model} />
      <Milestones model={model} />
    </div>
  );
}

function MonthlyGoals({ model }: { model: StudyModel }) {
  const repo = useRepository();
  const [month, setMonth] = useState(model.monthly.month);
  const statusOf = (id: ID) => model.topicMetrics.get(id)?.topic.status;
  const summary = useMemo(
    () => monthlySummary(month, model.snapshot.monthlyGoals, statusOf, new Date(model.now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, model],
  );
  const [y, mo] = month.split("-");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>
            {y}年{Number(mo)}月の目標
          </CardTitle>
          <CardDescription>
            残り{summary.daysLeft}日 ・ 経過 {Math.round(summary.elapsed * 100)}%
            {summary.pace ? ` ・ 全体 ${Math.round(summary.progress * 100)}%` : ""}
          </CardDescription>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="前の月"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="次の月"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {summary.subjects.length === 0 ? (
          <p className="text-muted-foreground text-sm">この月の目標はまだありません。</p>
        ) : (
          summary.subjects.map((s) => {
            const pace = PACE_META[s.pace];
            return (
              <section key={s.subjectId} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {model.subjectById.get(s.subjectId)?.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round(s.progress * 100)}%
                    </span>
                    <Badge variant={pace.tone === "default" ? "secondary" : pace.tone}>
                      {pace.label}
                    </Badge>
                  </span>
                </div>
                <Progress value={s.progress * 100} className="h-1.5" />
                <ul className="space-y-1">
                  {s.goals.map(({ goal, progress }) => {
                    const measurable = Boolean(
                      goal.targetTopicId && goal.targetStatus !== undefined,
                    );
                    return (
                      <li key={goal.id} className="flex items-center gap-2 text-sm">
                        {measurable ? (
                          <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                            {Math.round(progress * 100)}%
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void repo.updateMonthlyGoal(goal.id, { done: !goal.done })
                            }
                            className={cn(
                              "ml-auto flex size-5 shrink-0 items-center justify-center rounded border",
                              goal.done
                                ? "border-success bg-success text-background"
                                : "border-border",
                            )}
                            aria-pressed={goal.done}
                            aria-label={goal.done ? "未達成に戻す" : "達成にする"}
                          >
                            {goal.done ? <Check className="size-3" /> : null}
                          </button>
                        )}
                        <span
                          className={cn(
                            "min-w-0 flex-1",
                            goal.done && !measurable && "text-muted-foreground line-through",
                          )}
                        >
                          {goal.text}
                          {measurable ? (
                            <span className="text-muted-foreground ml-1 text-[11px]">
                              （{model.topicMetrics.get(goal.targetTopicId as ID)?.topic.name}を
                              {STATUS_LIST[goal.targetStatus as Status]?.label}まで）
                            </span>
                          ) : null}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="目標を削除"
                          onClick={() => void repo.deleteMonthlyGoal(goal.id)}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
        <AddMonthlyGoal model={model} month={month} />
      </CardContent>
    </Card>
  );
}

function AddMonthlyGoal({ model, month }: { model: StudyModel; month: string }) {
  const repo = useRepository();
  const [text, setText] = useState("");
  const [target, setTarget] = useState<{ subjectId: ID | null; topicId: ID | null }>({
    subjectId: model.activeSubjects[0]?.id ?? null,
    topicId: null,
  });
  const [status, setStatus] = useState<string>("2");

  async function add() {
    if (!target.subjectId) return;
    const topicName = target.topicId
      ? model.topicMetrics.get(target.topicId)?.topic.name
      : undefined;
    const label = STATUS_LIST[Number(status) as Status]?.label;
    const finalText = text.trim() || (topicName ? `${topicName}を${label}` : "");
    if (!finalText) {
      toast({ title: "目標の内容か単元を入力してください", variant: "error" });
      return;
    }
    await repo.addMonthlyGoal({
      month,
      subjectId: target.subjectId,
      text: finalText,
      targetTopicId: target.topicId ?? undefined,
      targetStatus: target.topicId ? (Number(status) as Status) : undefined,
    });
    setText("");
    setTarget((t) => ({ ...t, topicId: null }));
  }

  return (
    <div className="border-border space-y-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium">目標を追加</p>
      <TopicPicker
        model={model}
        subjectId={target.subjectId}
        topicId={target.topicId}
        allowNone
        onChange={setTarget}
      />
      <div className="flex flex-wrap gap-2">
        {target.topicId ? (
          <Select
            items={STATUS_LIST.filter((s) => s.value > 0).map((s) => ({
              value: String(s.value),
              label: `${s.label}まで`,
            }))}
            value={status}
            onValueChange={setStatus}
            aria-label="目標ステータス"
            className="w-36"
          />
        ) : null}
        <Input
          placeholder={target.topicId ? "内容（空欄なら自動）" : "例: 毎日20分"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-40 flex-1"
        />
        <Button size="sm" onClick={() => void add()}>
          <Plus className="size-4" /> 追加
        </Button>
      </div>
      {target.topicId ? (
        <p className="text-muted-foreground text-[11px]">
          単元を指定した目標は、その単元のステータスから達成率を自動計算します （現在{" "}
          {Math.round(
            goalProgress(
              {
                id: "",
                month,
                subjectId: "",
                text: "",
                targetTopicId: target.topicId,
                targetStatus: Number(status) as Status,
                createdAt: 0,
                updatedAt: 0,
              },
              (id) => model.topicMetrics.get(id)?.topic.status,
            ) * 100,
          )}
          %）。
        </p>
      ) : null}
    </div>
  );
}

function Milestones({ model }: { model: StudyModel }) {
  const repo = useRepository();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState("");
  const list = model.snapshot.milestones.slice().sort((a, b) => a.date.localeCompare(b.date));

  async function add() {
    if (!date || !title.trim()) {
      toast({ title: "日付とタイトルを入力してください", variant: "error" });
      return;
    }
    await repo.addMilestone({
      date,
      title: title.trim(),
      items: items
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      done: false,
    });
    setDate("");
    setTitle("");
    setItems("");
  }

  async function addExamples() {
    const exam = model.examDate;
    const samples = [
      {
        date: "2026-12-31",
        title: "高校微積完成・線形代数基礎",
        items: ["高校微積完成", "大学微積開始", "線形代数基礎完成"],
      },
      {
        date: "2027-03-31",
        title: "電通大範囲一周",
        items: ["電通大数学範囲一周", "物理主要範囲一周"],
      },
      { date: "2027-04-30", title: "過去問開始", items: ["電通大過去問に着手"] },
      { date: exam, title: "電通大本番", items: [] },
    ];
    for (const s of samples) {
      if (!list.some((m) => m.title === s.title)) await repo.addMilestone({ ...s, done: false });
    }
    toast({ title: "サンプルのマイルストーンを追加しました" });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>マイルストーン</CardTitle>
        {list.length === 0 ? (
          <Button size="sm" variant="outline" onClick={() => void addExamples()}>
            例を追加
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            長期目標を日付付きで登録すると、ダッシュボードに次のマイルストーンが出ます。
          </p>
        ) : (
          <ol className="border-border relative space-y-3 border-l pl-4">
            {list.map((m) => {
              const days = daysUntil(m.date, new Date(model.now));
              return (
                <li key={m.id} className="relative">
                  <span
                    className={cn(
                      "border-background absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2",
                      m.done ? "bg-success" : days < 0 ? "bg-destructive" : "bg-primary",
                    )}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          m.done && "text-muted-foreground line-through",
                        )}
                      >
                        {m.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {longDateLabel(m.date)}
                        {!m.done
                          ? days >= 0
                            ? ` ・ あと${days}日`
                            : ` ・ ${-days}日超過`
                          : " ・ 達成"}
                      </p>
                      {m.items.length > 0 ? (
                        <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
                          {m.items.map((it) => (
                            <li key={it}>{it}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={m.done ? "未達成に戻す" : "達成にする"}
                        onClick={() => void repo.updateMilestone(m.id, { done: !m.done })}
                      >
                        <Check className={m.done ? "text-success" : ""} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="削除"
                        onClick={() => void repo.deleteMilestone(m.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="border-border grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-1">
            <Label htmlFor="ms-date" className="text-xs">
              日付
            </Label>
            <Input
              id="ms-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ms-title" className="text-xs">
              タイトル
            </Label>
            <Input
              id="ms-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 高校微積完成"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ms-items" className="text-xs">
              達成項目（1行に1つ・任意）
            </Label>
            <Textarea
              id="ms-items"
              rows={2}
              value={items}
              onChange={(e) => setItems(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={() => void add()}>
              <Plus className="size-4" /> マイルストーンを追加
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
