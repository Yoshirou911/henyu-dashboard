"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { PRIORITY_META } from "@/lib/constants";
import type { StudyModel, UniversitySummary } from "@/lib/model/buildStudyModel";
import type { UniversityPriority } from "@/lib/types";

const PRIORITIES = (Object.keys(PRIORITY_META) as UniversityPriority[]).map((value) => ({
  value,
  label: PRIORITY_META[value].label,
}));

/** Create (summary undefined) or edit a university and its subject requirements. */
export function UniversityDialog({
  open,
  onOpenChange,
  summary,
  model,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: UniversitySummary;
  model: StudyModel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{summary ? "志望校を編集" : "志望校を追加"}</DialogTitle>
          <DialogDescription>
            必要科目の重み（配点）で準備度を計算します。制度変更があればいつでも編集できます。
          </DialogDescription>
        </DialogHeader>
        <UniversityForm summary={summary} model={model} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UniversityForm({
  summary,
  model,
  onDone,
}: {
  summary?: UniversitySummary;
  model: StudyModel;
  onDone: () => void;
}) {
  const repo = useRepository();
  const u = summary?.university;
  const [form, setForm] = useState({
    name: u?.name ?? "",
    faculty: u?.faculty ?? "",
    departmentOrCourse: u?.departmentOrCourse ?? "",
    priority: (u?.priority ?? "candidate") as UniversityPriority,
    examDate: u?.examDate ?? "",
    applicationDeadline: u?.applicationDeadline ?? "",
    resultDate: u?.resultDate ?? "",
    notes: u?.notes ?? "",
  });
  const [addSubject, setAddSubject] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // requirements live in the DB; read fresh from the model so edits show instantly
  const reqs = u ? model.snapshot.requirements.filter((r) => r.universityId === u.id) : [];
  const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
  const unusedSubjects = model.subjects.filter((s) => !reqs.some((r) => r.subjectId === s.id));

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "大学名を入力してください", variant: "error" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      faculty: form.faculty.trim(),
      departmentOrCourse: form.departmentOrCourse.trim(),
      priority: form.priority,
      examDate: form.examDate || undefined,
      applicationDeadline: form.applicationDeadline || undefined,
      resultDate: form.resultDate || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (u) await repo.updateUniversity(u.id, payload);
    else await repo.addUniversity(payload);
    toast({ title: "保存しました", variant: "success" });
    onDone();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="u-name">大学名</Label>
          <Input id="u-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-fac">学部・学域</Label>
          <Input id="u-fac" value={form.faculty} onChange={(e) => set("faculty", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-dept">学科・コース</Label>
          <Input
            id="u-dept"
            value={form.departmentOrCourse}
            onChange={(e) => set("departmentOrCourse", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>志望順位</Label>
          <ChipGroup
            aria-label="志望順位"
            value={form.priority}
            onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={PRIORITIES}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-exam">試験日</Label>
          <Input
            id="u-exam"
            type="date"
            value={form.examDate}
            onChange={(e) => set("examDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-dead">出願締切</Label>
          <Input
            id="u-dead"
            type="date"
            value={form.applicationDeadline}
            onChange={(e) => set("applicationDeadline", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-res">合格発表</Label>
          <Input
            id="u-res"
            type="date"
            value={form.resultDate}
            onChange={(e) => set("resultDate", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="u-notes">メモ</Label>
          <Input id="u-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>

      {u ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">必要科目と配点の重み</p>
          {reqs.length === 0 ? (
            <p className="text-muted-foreground text-xs">必要科目が未設定です。</p>
          ) : (
            <ul className="space-y-2">
              {reqs.map((r) => (
                <li key={r.id} className="border-border rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-20 text-sm font-medium">
                      {model.subjectById.get(r.subjectId)?.name ?? "（削除済み）"}
                    </span>
                    <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Switch
                        checked={r.required}
                        onCheckedChange={(checked) =>
                          void repo.upsertRequirement({ ...r, required: checked })
                        }
                        aria-label="必須"
                      />
                      必須
                    </label>
                    <label className="text-muted-foreground flex items-center gap-1 text-xs">
                      重み
                      <Input
                        key={`${r.id}-${r.weight}`}
                        type="number"
                        min={0}
                        defaultValue={r.weight}
                        className="h-7 w-16 text-xs"
                        aria-label="重み"
                        onBlur={(e) => {
                          const w = Number.parseFloat(e.target.value);
                          if (Number.isFinite(w) && w >= 0 && w !== r.weight) {
                            void repo.upsertRequirement({ ...r, weight: w });
                          }
                        }}
                      />
                      <span className="tabular-nums">
                        ({totalWeight > 0 ? Math.round((r.weight / totalWeight) * 100) : 0}%)
                      </span>
                    </label>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="ml-auto"
                      aria-label="この科目を外す"
                      onClick={() => void repo.deleteRequirement(r.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                    重要度
                    <ChipGroup
                      size="sm"
                      aria-label="重要度"
                      value={r.importance}
                      onChange={(v) => void repo.upsertRequirement({ ...r, importance: v })}
                      options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {unusedSubjects.length > 0 ? (
            <div className="flex items-center gap-2">
              <Select
                items={unusedSubjects.map((s) => ({ value: s.id, label: s.name }))}
                value={addSubject}
                onValueChange={setAddSubject}
                placeholder="科目を追加…"
                aria-label="追加する科目"
                className="max-w-48"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!addSubject}
                onClick={() => {
                  void repo.upsertRequirement({
                    universityId: u.id,
                    subjectId: addSubject,
                    required: true,
                    importance: 3,
                    weight: 10,
                  });
                  setAddSubject("");
                }}
              >
                <Plus className="size-4" /> 追加
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">保存後に必要科目と重みを設定できます。</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          閉じる
        </Button>
        <Button onClick={() => void save()}>保存</Button>
      </div>
    </div>
  );
}
