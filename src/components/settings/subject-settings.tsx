"use client";

import {
  Archive,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { EVALUATION_LABEL } from "@/components/subjects/subjects-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import { PLAN_CONFIG } from "@/lib/planner/buildTodayPlan";
import type { EvaluationType, ID } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVAL_OPTIONS = (Object.keys(EVALUATION_LABEL) as EvaluationType[]).map((value) => ({
  value,
  label: EVALUATION_LABEL[value],
}));

/** 科目配分 (spec §18): long-term time shares the planner balances against. */
export function AllocationSettings({ model }: { model: StudyModel }) {
  const repo = useRepository();
  const current = model.settings.subjectAllocation ?? {};
  const [draft, setDraft] = useState<Record<ID, string>>(() =>
    Object.fromEntries(model.activeSubjects.map((s) => [s.id, String(current[s.id] ?? 0)])),
  );
  const total = model.activeSubjects.reduce(
    (s, x) => s + (Number.parseFloat(draft[x.id] ?? "0") || 0),
    0,
  );
  const actual = new Map(model.allocation.map((a) => [a.subjectId, a]));

  async function save() {
    const next: Record<ID, number> = { ...current };
    for (const s of model.activeSubjects)
      next[s.id] = Math.max(0, Number.parseFloat(draft[s.id] ?? "0") || 0);
    await repo.updateSettings({ subjectAllocation: next });
    toast({ title: "科目配分を保存しました", variant: "success" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>科目配分</CardTitle>
        <CardDescription>
          今の時期の学習時間の比率。今日の推奨学習は、短期の優先度とこの配分の両方を見て組まれます（合計は自動で正規化）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {model.activeSubjects.map((s) => {
            const a = actual.get(s.id);
            const share =
              total > 0 ? ((Number.parseFloat(draft[s.id] ?? "0") || 0) / total) * 100 : 0;
            return (
              <li key={s.id} className="grid grid-cols-[6rem_5rem_1fr] items-center gap-3 text-sm">
                <span className="truncate">{s.name}</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft[s.id] ?? "0"}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                  className="h-8 text-xs"
                  aria-label={`${s.name}の配分`}
                />
                <span className="text-muted-foreground text-xs tabular-nums">
                  目標 {Math.round(share)}% ・ 直近7日 {Math.round((a?.actualShare ?? 0) * 100)}%
                  {a &&
                  a.targetShare > 0 &&
                  a.deficitMinutes >= PLAN_CONFIG.deficitNoticeMinutes ? (
                    <span className="text-warning ml-1">不足 {Math.round(a.deficitMinutes)}分</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs tabular-nums">合計 {total}</span>
          <Button size="sm" onClick={() => void save()}>
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** 科目の追加・並び替え・非表示・アーカイブ・テンプレート (spec §30/§31). */
export function SubjectManager({ model }: { model: StudyModel }) {
  const repo = useRepository();
  const all = model.snapshot.subjects.slice().sort((a, b) => a.order - b.order);
  const live = all.filter((s) => !s.archived);
  const archived = all.filter((s) => s.archived);
  const [name, setName] = useState("");
  const [evalType, setEvalType] = useState<EvaluationType>("problem");

  async function move(id: ID, dir: -1 | 1) {
    const ids = live.map((s) => s.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    await repo.reorderSubjects([...ids, ...archived.map((s) => s.id)]);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>科目</CardTitle>
          <CardDescription>
            非表示はプランナー・ダッシュボードから除外。アーカイブは一覧からも隠します。
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const { addedSubjects } = await repo.ensureExamTemplate();
            toast({
              title:
                addedSubjects.length > 0
                  ? `追加しました: ${addedSubjects.join("・")}`
                  : "すべての受験科目が登録済みです",
            });
          }}
        >
          <Sparkles className="size-4" /> 受験科目テンプレート追加
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-border divide-y">
          {live.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="上へ"
                  disabled={i === 0}
                  onClick={() => void move(s.id, -1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="下へ"
                  disabled={i === live.length - 1}
                  onClick={() => void move(s.id, 1)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <Input
                key={`${s.id}-${s.name}`}
                defaultValue={s.name}
                aria-label="科目名"
                className={cn("h-8 w-32 text-sm", s.hidden && "text-muted-foreground")}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.name) void repo.updateSubject(s.id, { name: v });
                }}
              />
              <Select
                items={EVAL_OPTIONS}
                value={s.evaluationType ?? "problem"}
                onValueChange={(v) =>
                  void repo.updateSubject(s.id, { evaluationType: v as EvaluationType })
                }
                aria-label="評価タイプ"
                className="h-8 w-32 text-xs"
              />
              <div className="ml-auto flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={s.hidden ? "表示する" : "非表示にする"}
                  onClick={() => void repo.updateSubject(s.id, { hidden: !s.hidden })}
                >
                  {s.hidden ? <EyeOff /> : <Eye />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="アーカイブ"
                  onClick={() => void repo.updateSubject(s.id, { archived: true })}
                >
                  <Archive />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form
          className="border-border flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await repo.addSubject(name.trim(), `custom-${Date.now().toString(36)}`, evalType);
            setName("");
            toast({ title: "科目を追加しました。ロードマップで分野と単元を追加できます。" });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新しい科目（例: 確率統計）"
            className="h-8 min-w-40 flex-1"
            aria-label="新しい科目名"
          />
          <ChipGroup
            size="sm"
            aria-label="評価タイプ"
            value={evalType}
            onChange={setEvalType}
            options={EVAL_OPTIONS}
          />
          <Button size="sm" type="submit">
            <Plus className="size-4" /> 追加
          </Button>
        </form>

        {archived.length > 0 ? (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">アーカイブ済み</p>
            {archived.map((s) => (
              <div
                key={s.id}
                className="text-muted-foreground flex items-center justify-between text-sm"
              >
                {s.name}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void repo.updateSubject(s.id, { archived: false })}
                  >
                    <RotateCcw className="size-3.5" /> 戻す
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      if (window.confirm(`「${s.name}」と全単元・記録を完全に削除しますか？`)) {
                        void repo.deleteSubject(s.id);
                      }
                    }}
                  >
                    完全に削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
