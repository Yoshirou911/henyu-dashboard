"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { PROBLEM_RESULT_META } from "@/lib/constants";
import { dayKey } from "@/lib/date";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ProblemResult } from "@/lib/types";

const RESULTS = (Object.keys(PROBLEM_RESULT_META) as ProblemResult[]).map((value) => ({
  value,
  label: PROBLEM_RESULT_META[value].symbol,
}));
const NO_TOPIC = "__none__";

interface Row {
  key: number;
  topicId: string;
  result: ProblemResult;
  score: string;
  maxScore: string;
  memo: string;
}

export function PastExamDialog({
  open,
  onOpenChange,
  model,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  model: StudyModel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>過去問の結果を追加</DialogTitle>
          <DialogDescription>
            大問ごとに単元と ○△× を付けると、失点単元が弱点・習熟度に反映されます。
          </DialogDescription>
        </DialogHeader>
        <PastExamForm model={model} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PastExamForm({ model, onDone }: { model: StudyModel; onDone: () => void }) {
  const repo = useRepository();
  const math = model.subjects.find((s) => s.slug === "math") ?? model.subjects[0];
  const [f, setF] = useState({
    universityId: model.primaryUniversity?.university.id ?? "",
    year: String(new Date(model.now).getFullYear() - 1),
    subjectId: math?.id ?? "",
    score: "",
    maxScore: "120",
    durationMin: "120",
    date: dayKey(),
    memo: "",
  });
  const [rows, setRows] = useState<Row[]>([
    { key: 1, topicId: NO_TOPIC, result: "correct", score: "", maxScore: "", memo: "" },
  ]);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const topicOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [{ value: NO_TOPIC, label: "単元を選択…" }];
    for (const m of model.topicMetrics.values()) {
      if (f.subjectId && m.subject.id !== f.subjectId) continue;
      list.push({ value: m.topic.id, label: `${m.category.name} / ${m.topic.name}` });
    }
    return list;
  }, [model.topicMetrics, f.subjectId]);

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    const score = Number.parseFloat(f.score);
    const max = Number.parseFloat(f.maxScore);
    const year = Number.parseInt(f.year, 10);
    if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0 || !Number.isFinite(year)) {
      toast({ title: "年度・得点・満点を入力してください", variant: "error" });
      return;
    }
    const subject = model.subjectById.get(f.subjectId);
    await repo.addPastExam(
      {
        universityId: f.universityId || null,
        year,
        subject: subject?.name ?? "",
        subjectId: subject?.id,
        score,
        maxScore: max,
        durationMin: Number.parseInt(f.durationMin, 10) || undefined,
        date: f.date || dayKey(),
        memo: f.memo.trim() || undefined,
      },
      rows.map((r, i) => ({
        number: i + 1,
        topicId: r.topicId === NO_TOPIC ? undefined : r.topicId,
        result: r.result,
        score: r.score ? Number.parseFloat(r.score) : undefined,
        maxScore: r.maxScore ? Number.parseFloat(r.maxScore) : undefined,
        memo: r.memo.trim() || undefined,
      })),
    );
    toast({ title: "過去問を記録しました", variant: "success" });
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 space-y-1.5">
          <Label>大学</Label>
          <Select
            items={model.universities.map((u) => ({
              value: u.university.id,
              label: u.university.name,
            }))}
            value={f.universityId}
            onValueChange={(v) => set("universityId", v)}
            aria-label="大学"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-year">年度</Label>
          <Input
            id="p-year"
            type="number"
            value={f.year}
            onChange={(e) => set("year", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>科目</Label>
          <Select
            items={model.subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={f.subjectId}
            onValueChange={(v) => set("subjectId", v)}
            aria-label="科目"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-score">得点</Label>
          <Input
            id="p-score"
            type="number"
            inputMode="decimal"
            value={f.score}
            onChange={(e) => set("score", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-max">満点</Label>
          <Input
            id="p-max"
            type="number"
            inputMode="decimal"
            value={f.maxScore}
            onChange={(e) => set("maxScore", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-dur">時間（分）</Label>
          <Input
            id="p-dur"
            type="number"
            inputMode="numeric"
            value={f.durationMin}
            onChange={(e) => set("durationMin", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-date">解いた日</Label>
          <Input
            id="p-date"
            type="date"
            value={f.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">大問ごとの結果</p>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="border-border flex flex-wrap items-center gap-2 rounded-lg border p-2"
          >
            <span className="text-muted-foreground w-12 text-xs">第{i + 1}問</span>
            <Select
              items={topicOptions}
              value={r.topicId}
              onValueChange={(v) => updateRow(r.key, { topicId: v })}
              aria-label={`第${i + 1}問の単元`}
              className="min-w-40 flex-1"
            />
            <ChipGroup
              aria-label={`第${i + 1}問の結果`}
              value={r.result}
              onChange={(v) => updateRow(r.key, { result: v })}
              options={RESULTS}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="点"
              value={r.score}
              onChange={(e) => updateRow(r.key, { score: e.target.value })}
              className="h-8 w-16 text-xs"
              aria-label={`第${i + 1}問の得点`}
            />
            <Input
              placeholder="メモ"
              value={r.memo}
              onChange={(e) => updateRow(r.key, { memo: e.target.value })}
              className="h-8 min-w-24 flex-1 text-xs"
              aria-label={`第${i + 1}問のメモ`}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="この行を削除"
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              {
                key: Math.max(...rs.map((x) => x.key)) + 1,
                topicId: NO_TOPIC,
                result: "correct",
                score: "",
                maxScore: "",
                memo: "",
              },
            ])
          }
        >
          <Plus className="size-4" /> 大問を追加
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="p-memo">メモ</Label>
        <Input id="p-memo" value={f.memo} onChange={(e) => set("memo", e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          キャンセル
        </Button>
        <Button onClick={() => void save()}>記録する</Button>
      </div>
    </div>
  );
}
