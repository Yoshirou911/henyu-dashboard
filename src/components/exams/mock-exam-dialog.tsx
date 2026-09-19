"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { TopicPicker } from "@/components/topic/topic-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { dayKey } from "@/lib/date";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ID } from "@/lib/types";

const num = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

export function MockExamDialog({
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>模試の結果を追加</DialogTitle>
          <DialogDescription>失点した単元を選ぶと弱点判定に反映されます。</DialogDescription>
        </DialogHeader>
        <MockForm model={model} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MockForm({ model, onDone }: { model: StudyModel; onDone: () => void }) {
  const repo = useRepository();
  const [f, setF] = useState({
    examName: "",
    examDate: dayKey(),
    subject: "",
    subjectId: model.activeSubjects[0]?.id ?? "",
    score: "",
    maxScore: "200",
    deviationValue: "",
    rank: "",
    participants: "",
    memo: "",
  });
  const [weak, setWeak] = useState<ID[]>([]);
  const [picker, setPicker] = useState<{ subjectId: ID | null; topicId: ID | null }>({
    subjectId: f.subjectId || null,
    topicId: null,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    const score = num(f.score);
    const max = num(f.maxScore);
    if (!f.examName.trim() || score === undefined || !max) {
      toast({ title: "模試名・得点・満点を入力してください", variant: "error" });
      return;
    }
    await repo.addMockExam({
      examName: f.examName.trim(),
      examDate: f.examDate || dayKey(),
      subject: f.subject.trim() || model.subjectById.get(f.subjectId)?.name || "",
      subjectId: f.subjectId || undefined,
      score,
      maxScore: max,
      deviationValue: num(f.deviationValue),
      rank: num(f.rank),
      participants: num(f.participants),
      memo: f.memo.trim() || undefined,
      weakTopicIds: weak.length > 0 ? weak : undefined,
    });
    toast({ title: "模試を記録しました", variant: "success" });
    onDone();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="m-name">模試名</Label>
          <Input
            id="m-name"
            placeholder="河合 第3回全統記述"
            value={f.examName}
            onChange={(e) => set("examName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-date">実施日</Label>
          <Input
            id="m-date"
            type="date"
            value={f.examDate}
            onChange={(e) => set("examDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>科目</Label>
          <Select
            items={model.subjects.map((s) => ({ value: s.id, label: s.name }))}
            value={f.subjectId}
            onValueChange={(v) => {
              set("subjectId", v);
              setPicker({ subjectId: v, topicId: null });
            }}
            aria-label="科目"
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="m-subj">科目名（成績表の表記・任意）</Label>
          <Input
            id="m-subj"
            placeholder="数学II BC"
            value={f.subject}
            onChange={(e) => set("subject", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-score">得点</Label>
          <Input
            id="m-score"
            type="number"
            inputMode="decimal"
            value={f.score}
            onChange={(e) => set("score", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-max">満点</Label>
          <Input
            id="m-max"
            type="number"
            inputMode="decimal"
            value={f.maxScore}
            onChange={(e) => set("maxScore", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-dev">偏差値</Label>
          <Input
            id="m-dev"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={f.deviationValue}
            onChange={(e) => set("deviationValue", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-rank">順位</Label>
            <Input
              id="m-rank"
              type="number"
              inputMode="numeric"
              value={f.rank}
              onChange={(e) => set("rank", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-part">受験者数</Label>
            <Input
              id="m-part"
              type="number"
              inputMode="numeric"
              value={f.participants}
              onChange={(e) => set("participants", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>失点した単元</Label>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TopicPicker
              model={model}
              subjectId={picker.subjectId}
              topicId={picker.topicId}
              onChange={setPicker}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!picker.topicId}
            onClick={() => {
              if (picker.topicId && !weak.includes(picker.topicId))
                setWeak((w) => [...w, picker.topicId as ID]);
            }}
          >
            追加
          </Button>
        </div>
        {weak.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {weak.map((id) => (
              <span
                key={id}
                className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
              >
                {model.topicMetrics.get(id)?.topic.name}
                <button
                  type="button"
                  aria-label="外す"
                  onClick={() => setWeak((w) => w.filter((x) => x !== id))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="m-memo">メモ</Label>
        <Input id="m-memo" value={f.memo} onChange={(e) => set("memo", e.target.value)} />
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
