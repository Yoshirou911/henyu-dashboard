"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import type { RecordRequest } from "@/components/record/record-provider";
import { TopicPicker } from "@/components/topic/topic-picker";
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
import { toast } from "@/components/ui/toaster";
import { useStudyModel } from "@/hooks/use-study-model";
import { DIFFICULTY_META, EXERCISE_TYPE_META } from "@/lib/constants";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ExerciseDifficulty, ExerciseType, ID } from "@/lib/types";

const DIFFICULTIES = (Object.keys(DIFFICULTY_META) as ExerciseDifficulty[]).map((value) => ({
  value,
  label: DIFFICULTY_META[value],
}));
const TYPES = (Object.keys(EXERCISE_TYPE_META) as ExerciseType[]).map((value) => ({
  value,
  label: EXERCISE_TYPE_META[value],
}));

export function RecordDialog({
  request,
  onClose,
}: {
  request: RecordRequest | null;
  onClose: () => void;
}) {
  const model = useStudyModel();

  function close(cancelled: boolean) {
    if (cancelled) request?.onCancel?.();
    onClose();
  }

  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && close(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{request?.mode === "session" ? "学習を記録" : "問題演習を記録"}</DialogTitle>
          <DialogDescription>
            問題数は空欄でもOK。入力すると正答率・習熟度に反映されます。
          </DialogDescription>
        </DialogHeader>
        {request && model ? (
          <RecordForm model={model} request={request} onDone={() => close(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stepper({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`${label}を減らす`}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
          className="h-8 w-16 text-center tabular-nums"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`${label}を増やす`}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function RecordForm({
  model,
  request,
  onDone,
}: {
  model: StudyModel;
  request: RecordRequest;
  onDone: () => void;
}) {
  const repo = useRepository();
  const initialTopic = request.topicId ? model.topicMetrics.get(request.topicId) : undefined;
  const [target, setTarget] = useState<{ subjectId: ID | null; topicId: ID | null }>({
    subjectId: initialTopic?.subject.id ?? request.subjectId ?? model.activeSubjects[0]?.id ?? null,
    topicId: request.topicId ?? null,
  });
  const [minutes, setMinutes] = useState(request.minutes ? String(request.minutes) : "");
  const [attempted, setAttempted] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>(
    initialTopic && initialTopic.topic.status >= 2 ? "standard" : "basic",
  );
  const [type, setType] = useState<ExerciseType>("practice");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const evaluationType =
    target.topicId !== null
      ? model.topicMetrics.get(target.topicId)?.evaluationType
      : model.subjectById.get(target.subjectId ?? "")?.evaluationType;
  const countLabel = evaluationType === "interview" ? "評価（満点）" : "解いた問題数";
  const correctLabel = evaluationType === "interview" ? "評価（得点）" : "正解数";

  async function save() {
    const mins = Number.parseInt(minutes, 10) || 0;
    if (mins <= 0 && attempted <= 0) {
      toast({ title: "学習時間か問題数を入力してください", variant: "error" });
      return;
    }
    if (attempted > 0 && !target.topicId) {
      toast({ title: "問題数を記録するには単元を選んでください", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      await repo.recordStudy({
        topicId: target.topicId,
        subjectId: target.subjectId,
        minutes: mins,
        startedAt: request.startedAt,
        endedAt: request.endedAt,
        source: request.source ?? "manual",
        plannedMinutes: request.plannedMinutes,
        note: memo,
        exercise:
          attempted > 0
            ? {
                attemptedCount: attempted,
                correctCount: Math.min(correct, attempted),
                difficulty,
                type,
                memo,
              }
            : undefined,
      });
      toast({
        title: "記録しました",
        description: [
          mins > 0 ? `${mins}分` : null,
          attempted > 0 ? `${attempted}問中${Math.min(correct, attempted)}問正解` : null,
        ]
          .filter(Boolean)
          .join(" ・ "),
        variant: "success",
      });
      request.onSaved?.();
      onDone();
    } catch {
      toast({ title: "記録に失敗しました", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <TopicPicker
        model={model}
        subjectId={target.subjectId}
        topicId={target.topicId}
        allowNone
        onChange={setTarget}
      />

      <div className="space-y-1.5">
        <Label htmlFor="rec-min">
          学習時間（分）
          {request.plannedMinutes ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              予定 {request.plannedMinutes}分
            </span>
          ) : null}
        </Label>
        <Input
          id="rec-min"
          type="number"
          inputMode="numeric"
          min={0}
          value={minutes}
          placeholder={request.mode === "exercise" ? "任意" : ""}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-28"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stepper id="rec-att" label={countLabel} value={attempted} onChange={setAttempted} />
        <Stepper
          id="rec-cor"
          label={correctLabel}
          value={Math.min(correct, attempted)}
          onChange={(v) => setCorrect(Math.min(v, attempted))}
        />
      </div>
      <ChipGroup
        size="sm"
        aria-label="問題数のプリセット"
        value={attempted}
        onChange={(v) => {
          setAttempted(v);
          setCorrect((c) => Math.min(c, v));
        }}
        options={[3, 5, 10, 20].map((n) => ({ value: n, label: `${n}問` }))}
      />

      {attempted > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>難易度</Label>
            <ChipGroup
              aria-label="難易度"
              value={difficulty}
              onChange={setDifficulty}
              options={DIFFICULTIES}
            />
          </div>
          <div className="space-y-1.5">
            <Label>種類</Label>
            <ChipGroup aria-label="種類" value={type} onChange={setType} options={TYPES} />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="rec-memo">メモ（任意）</Label>
        <Input
          id="rec-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="間違えた理由など"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          キャンセル
        </Button>
        <Button type="submit" disabled={busy}>
          記録する
        </Button>
      </div>
    </form>
  );
}
