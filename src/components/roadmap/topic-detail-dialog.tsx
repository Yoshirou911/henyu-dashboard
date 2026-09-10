"use client";

import { Clock, History, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { StatusSelect } from "@/components/topic/status-select";
import { Button } from "@/components/ui/button";
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
import { useCategories, useReviews, useStudySessions, useTopics } from "@/hooks/use-data";
import { REVIEW_INTERVALS_DAYS } from "@/lib/constants";
import { relativeDayLabel, shortDateLabel } from "@/lib/date";
import type { ID, Review, Status, StudySession, Topic } from "@/lib/types";
import { formatMinutes } from "@/lib/utils";

interface Props {
  topicId: ID | null;
  onClose: () => void;
}

export function TopicDetailDialog({ topicId, onClose }: Props) {
  const topics = useTopics();
  const categories = useCategories();
  const sessions = useStudySessions();
  const reviews = useReviews();

  const topic = topics?.find((t) => t.id === topicId);
  const category = categories?.find((c) => c.id === topic?.categoryId);

  return (
    <Dialog open={Boolean(topicId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>単元の詳細</DialogTitle>
          <DialogDescription>{category?.name ?? " "}</DialogDescription>
        </DialogHeader>
        {topic ? (
          <TopicDetailBody
            topic={topic}
            sessions={sessions ?? []}
            reviews={reviews ?? []}
            onClose={onClose}
          />
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">
            単元が見つかりませんでした。
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TopicDetailBody({
  topic,
  sessions,
  reviews,
  onClose,
}: {
  topic: Topic;
  sessions: StudySession[];
  reviews: Review[];
  onClose: () => void;
}) {
  const repo = useRepository();
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description ?? "");
  const [note, setNote] = useState(topic.note ?? "");
  const [weight, setWeight] = useState(String(topic.weight));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const totalSec = sessions
    .filter((s) => s.topicId === topic.id)
    .reduce((sum, s) => sum + s.durationSec, 0);
  const openReview = reviews.find((r) => r.topicId === topic.id && !r.completedAt);
  const doneReviews = reviews.filter((r) => r.topicId === topic.id && r.completedAt);

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

  async function remove() {
    await repo.deleteTopic(topic.id);
    toast({ title: `「${topic.name}」を削除しました` });
    onClose();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">ステータス</span>
        <StatusSelect
          value={topic.status}
          onChange={(s: Status) => repo.setTopicStatus(topic.id, s)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border-border rounded-lg border p-2">
          <Clock className="text-muted-foreground mx-auto size-3.5" />
          <p className="mt-1 text-sm font-semibold tabular-nums">{formatMinutes(totalSec / 60)}</p>
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
            {openReview ? shortDateLabel(openReview.dueAt) : "—"}
          </p>
          <p className="text-muted-foreground text-[10px]">次の復習</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="td-name">名前</Label>
        <Input id="td-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="td-desc">説明（任意）</Label>
        <Textarea
          id="td-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="この単元で身につけること"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="td-note">メモ（任意）</Label>
        <Textarea
          id="td-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="つまずいた点、参考ページなど"
        />
      </div>
      <div className="space-y-2">
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
        <p className="text-muted-foreground text-[11px]">
          進捗率の加重に使われます。重要な単元ほど大きく（例: 積分 = 3）。
        </p>
      </div>

      {doneReviews.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          復習履歴: {doneReviews.length} 回 / 全 {REVIEW_INTERVALS_DAYS.length} ステージ
        </p>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-destructive text-xs">削除しますか？</span>
            <Button size="sm" variant="destructive" onClick={() => void remove()}>
              削除する
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" /> 削除
          </Button>
        )}
        <Button size="sm" onClick={() => void persistAndClose()}>
          保存して閉じる
        </Button>
      </div>
    </>
  );
}
