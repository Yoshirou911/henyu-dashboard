"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { useExamScores, useSettings } from "@/hooks/use-data";
import { dayKey } from "@/lib/date";
import type { ExamScore } from "@/lib/types";

interface FormState {
  examName: string;
  year: string;
  subject: string;
  score: string;
  maxScore: string;
  durationMin: string;
  date: string;
  note: string;
}

function emptyForm(examName: string): FormState {
  return {
    examName,
    year: String(new Date().getFullYear()),
    subject: "数学",
    score: "",
    maxScore: "120",
    durationMin: "",
    date: dayKey(),
    note: "",
  };
}

export function ExamScoresPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const repo = useRepository();
  const scores = useExamScores();
  const [open, setOpen] = useState(defaultOpen);

  const sorted = (scores ?? [])
    .slice()
    .sort((a, b) => b.year - a.year || b.date.localeCompare(a.date));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>過去問の得点</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> 追加
        </Button>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            まだ記録がありません。「追加」から入力してください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-2 font-medium">試験</th>
                  <th className="py-2 pr-2 font-medium">科目</th>
                  <th className="py-2 pr-2 text-right font-medium">得点</th>
                  <th className="py-2 pr-2 text-right font-medium">割合</th>
                  <th className="py-2 pr-2 text-right font-medium">時間</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id} className="border-border/60 border-b last:border-0">
                    <td className="py-2 pr-2">
                      {s.examName}
                      {s.year}
                    </td>
                    <td className="text-muted-foreground py-2 pr-2">{s.subject}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {s.score}/{s.maxScore}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0}%
                    </td>
                    <td className="text-muted-foreground py-2 pr-2 text-right tabular-nums">
                      {s.durationMin ? `${s.durationMin}分` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void repo.deleteExamScore(s.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="削除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>過去問の得点を追加</DialogTitle>
          </DialogHeader>
          <ExamForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ExamForm({ onDone }: { onDone: () => void }) {
  const repo = useRepository();
  const settings = useSettings();
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(settings?.examName?.replace(/\s.*/, "") || "電通大"),
  );

  const set = <K extends keyof FormState>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const score = Number.parseInt(form.score, 10);
    const maxScore = Number.parseInt(form.maxScore, 10);
    const year = Number.parseInt(form.year, 10);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
      toast({ title: "得点と満点を正しく入力してください", variant: "error" });
      return;
    }
    const payload: Omit<ExamScore, "id" | "createdAt"> = {
      examName: form.examName.trim() || "過去問",
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
      subject: form.subject.trim() || "数学",
      score,
      maxScore,
      date: form.date || dayKey(),
      durationMin: form.durationMin ? Number.parseInt(form.durationMin, 10) : undefined,
      note: form.note.trim() || undefined,
    };
    await repo.addExamScore(payload);
    toast({ title: "過去問の得点を記録しました", variant: "success" });
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ex-name">試験名</Label>
          <Input
            id="ex-name"
            value={form.examName}
            onChange={(e) => set("examName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-year">年度</Label>
          <Input
            id="ex-year"
            type="number"
            value={form.year}
            onChange={(e) => set("year", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-subject">科目</Label>
          <Input
            id="ex-subject"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-date">受験日</Label>
          <Input
            id="ex-date"
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-score">得点</Label>
          <Input
            id="ex-score"
            type="number"
            inputMode="numeric"
            value={form.score}
            onChange={(e) => set("score", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-max">満点</Label>
          <Input
            id="ex-max"
            type="number"
            inputMode="numeric"
            value={form.maxScore}
            onChange={(e) => set("maxScore", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ex-dur">所要時間（分・任意）</Label>
          <Input
            id="ex-dur"
            type="number"
            inputMode="numeric"
            value={form.durationMin}
            onChange={(e) => set("durationMin", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ex-note">メモ（任意）</Label>
        <Input
          id="ex-note"
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="間違えた分野など"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          キャンセル
        </Button>
        <Button type="submit">記録する</Button>
      </div>
    </form>
  );
}
