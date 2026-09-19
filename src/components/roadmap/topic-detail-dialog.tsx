"use client";

import {
  Archive,
  Check,
  ClipboardPlus,
  Clock,
  History,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Meter, RatePill } from "@/components/common/meter";
import { useRepository } from "@/components/providers/repository-provider";
import { useRecorder } from "@/components/record/record-provider";
import { StatusSelect } from "@/components/topic/status-select";
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
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { useStudyModel } from "@/hooks/use-study-model";
import { DIFFICULTY_META, EXERCISE_TYPE_META } from "@/lib/constants";
import { relativeDayLabel, shortDateLabel } from "@/lib/date";
import type { StudyModel, TopicMetrics } from "@/lib/model/buildStudyModel";
import type { ID, Status } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

interface Props {
  topicId: ID | null;
  onClose: () => void;
}

export function TopicDetailDialog({ topicId, onClose }: Props) {
  const model = useStudyModel();
  const metrics = topicId ? model?.topicMetrics.get(topicId) : undefined;
  // archived topics are not in the model; fall back to the raw row so they can be restored
  const raw = topicId ? model?.snapshot.topics.find((t) => t.id === topicId) : undefined;

  return (
    <Dialog open={Boolean(topicId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{metrics?.topic.name ?? raw?.name ?? "単元の詳細"}</DialogTitle>
          <DialogDescription>
            {metrics ? `${metrics.subject.name} / ${metrics.category.name}` : " "}
          </DialogDescription>
        </DialogHeader>
        {model && metrics ? (
          <TopicDetailBody key={metrics.topic.id} model={model} m={metrics} onClose={onClose} />
        ) : raw?.archived ? (
          <div className="space-y-3 py-4 text-sm">
            <p className="text-muted-foreground">この単元はアーカイブされています。</p>
            <ArchiveRestore topicId={raw.id} />
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            単元が見つかりませんでした。
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArchiveRestore({ topicId }: { topicId: ID }) {
  const repo = useRepository();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void repo.updateTopic(topicId, { archived: false })}
    >
      アーカイブを解除
    </Button>
  );
}

function AccuracyGrid({ m }: { m: TopicMetrics }) {
  const a = m.accuracy;
  const cells: [string, typeof a.total][] = [
    ["直近", a.recent],
    ["累計", a.total],
    ["基本", a.basic],
    ["標準", a.standard],
    ["発展", a.advanced],
    ["復習", a.review],
    ["過去問", a.pastExam],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {cells.map(([label, s]) => (
        <div key={label} className="border-border rounded-lg border p-1.5 text-center">
          <p className="text-muted-foreground text-[10px]">{label}</p>
          <RatePill rate={s.rate} />
          <p className="text-muted-foreground text-[10px] tabular-nums">{s.attempted}問</p>
        </div>
      ))}
    </div>
  );
}

function TopicDetailBody({
  model,
  m,
  onClose,
}: {
  model: StudyModel;
  m: TopicMetrics;
  onClose: () => void;
}) {
  const repo = useRepository();
  const { openRecord } = useRecorder();
  const topic = m.topic;
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description ?? "");
  const [note, setNote] = useState(topic.note ?? "");
  const [weight, setWeight] = useState(String(topic.weight));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [depPick, setDepPick] = useState<{ subjectId: ID | null; topicId: ID | null }>({
    subjectId: m.subject.id,
    topicId: null,
  });

  const deps = (topic.dependsOn ?? [])
    .map((id) => model.snapshot.topics.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const recentResults = m.results.slice(-5).reverse();

  async function persistAndClose() {
    const w = Number.parseFloat(weight);
    await repo.updateTopic(topic.id, {
      name: name.trim() || topic.name,
      description: description.trim() || undefined,
      note: note.trim() || undefined,
      weight: Number.isFinite(w) && w > 0 ? w : 1,
    });
    onClose();
  }

  const overrideValue =
    topic.readyOverride === undefined ? "auto" : topic.readyOverride ? "yes" : "no";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusSelect
          value={topic.status}
          onChange={(s: Status) => repo.setTopicStatus(topic.id, s)}
          align="start"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openRecord({ mode: "exercise", topicId: topic.id })}
        >
          <ClipboardPlus className="size-4" /> 問題演習を記録
        </Button>
      </div>

      {/* mastery */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">習熟度</p>
          <p className="text-lg font-semibold tabular-nums">
            {m.mastery.score}
            <span className="text-muted-foreground text-xs"> / 100</span>
          </p>
        </div>
        <Meter value={m.mastery.score} showValue={false} label="習熟度" />
        <p className="text-muted-foreground text-[11px]">
          ステータス基準 {m.mastery.base}
          {m.mastery.adjustments
            .map((a) => ` ・ ${a.label} ${a.value > 0 ? "+" : ""}${a.value}`)
            .join("")}
        </p>
        {m.weakness.score > 0 ? (
          <p className="text-warning text-[11px]">
            弱点スコア {m.weakness.score}：{m.weakness.reasons.join("・")}
          </p>
        ) : null}
      </section>

      {/* accuracy */}
      <section className="space-y-2">
        <p className="text-sm font-medium">正答率</p>
        <AccuracyGrid m={m} />
        {recentResults.length > 0 ? (
          <ul className="text-muted-foreground space-y-1 text-xs">
            {recentResults.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  {r.date} ・ {DIFFICULTY_META[r.difficulty]} ・ {EXERCISE_TYPE_META[r.type]}
                  {r.memo ? ` ・ ${r.memo}` : ""}
                </span>
                <span className="flex items-center gap-1 tabular-nums">
                  {r.correctCount}/{r.attemptedCount}
                  <button
                    type="button"
                    aria-label="この記録を削除"
                    className="hover:text-destructive rounded p-0.5"
                    onClick={() => void repo.deleteExerciseResult(r.id)}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">まだ問題演習の記録がありません。</p>
        )}
      </section>

      {/* ready for next */}
      <section className="space-y-2">
        <p className="text-sm font-medium">次に進む条件</p>
        <ul className="space-y-1">
          {m.ready.conditions.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-xs">
              {c.met ? (
                <Check className="text-success size-3.5" />
              ) : (
                <X className="text-destructive size-3.5" />
              )}
              <span>{c.label}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">{c.detail}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">判定</span>
          <ChipGroup
            size="sm"
            aria-label="次へ進む判定"
            value={overrideValue}
            onChange={(v) =>
              void repo.updateTopic(topic.id, {
                readyOverride: v === "auto" ? undefined : v === "yes",
              })
            }
            options={[
              { value: "auto", label: `自動（${m.ready.automatic ? "進める" : "まだ"}）` },
              { value: "yes", label: "進める" },
              { value: "no", label: "まだ" },
            ]}
          />
          {m.nextTopic ? (
            <span className="text-muted-foreground">→ 次：{m.nextTopic.name}</span>
          ) : null}
        </div>
      </section>

      {/* dependencies */}
      <section className="space-y-2">
        <p className="text-sm font-medium">前提単元</p>
        {deps.length === 0 ? (
          <p className="text-muted-foreground text-xs">前提単元は設定されていません。</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {deps.map((d) => (
              <span
                key={d.id}
                className="border-border inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
              >
                {d.status >= 2 ? <Check className="text-success size-3" /> : null}
                {d.name}
                <button
                  type="button"
                  aria-label={`${d.name} を前提から外す`}
                  onClick={() =>
                    void repo.updateTopic(topic.id, {
                      dependsOn: (topic.dependsOn ?? []).filter((x) => x !== d.id),
                    })
                  }
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TopicPicker
              model={model}
              subjectId={depPick.subjectId}
              topicId={depPick.topicId}
              onChange={setDepPick}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!depPick.topicId || depPick.topicId === topic.id}
            onClick={() => {
              if (!depPick.topicId) return;
              const next = Array.from(new Set([...(topic.dependsOn ?? []), depPick.topicId]));
              void repo.updateTopic(topic.id, { dependsOn: next });
              setDepPick((p) => ({ ...p, topicId: null }));
            }}
          >
            <Plus className="size-4" /> 追加
          </Button>
        </div>
        {m.dependents.length > 0 ? (
          <p className="text-muted-foreground text-[11px]">
            この単元が前提：{m.dependents.map((d) => d.name).join("・")}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border-border rounded-lg border p-2">
          <Clock className="text-muted-foreground mx-auto size-3.5" />
          <p className="mt-1 text-sm font-semibold tabular-nums">{formatMinutes(m.studyMinutes)}</p>
          <p className="text-muted-foreground text-[10px]">学習時間</p>
        </div>
        <div className="border-border rounded-lg border p-2">
          <History className="text-muted-foreground mx-auto size-3.5" />
          <p className="mt-1 text-sm font-semibold">
            {topic.lastStudiedAt ? relativeDayLabel(topic.lastStudiedAt) : "—"}
          </p>
          <p className="text-muted-foreground text-[10px]">最終学習</p>
        </div>
        <div className="border-border rounded-lg border p-2">
          <Repeat className="text-muted-foreground mx-auto size-3.5" />
          <p className="mt-1 text-sm font-semibold">
            {m.openReview ? shortDateLabel(m.openReview.dueAt) : "—"}
          </p>
          <p className="text-muted-foreground text-[10px]">次の復習</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="td-name">名前</Label>
          <Input id="td-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="td-weight">重要度 (weight)</Label>
          <Input
            id="td-weight"
            type="number"
            min={0.5}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="td-desc">説明（任意）</Label>
          <Textarea
            id="td-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="td-note">メモ（任意）</Label>
          <Textarea
            id="td-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="つまずいた点、参考ページなど"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-destructive max-w-56 text-xs">
              問題演習の記録と復習予定も消えます（学習時間は残ります）。残すならアーカイブを。削除しますか？
            </span>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await repo.deleteTopic(topic.id);
                toast({ title: `「${topic.name}」を削除しました` });
                onClose();
              }}
            >
              削除する
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await repo.updateTopic(topic.id, { archived: true });
                toast({ title: `「${topic.name}」をアーカイブしました` });
                onClose();
              }}
            >
              <Archive className="size-3.5" /> アーカイブ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" /> 削除
            </Button>
          </div>
        )}
        <Button size="sm" onClick={() => void persistAndClose()}>
          保存して閉じる
        </Button>
      </div>
    </div>
  );
}
