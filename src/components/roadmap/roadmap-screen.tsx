"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { useRepository } from "@/components/providers/repository-provider";
import { AddItemDialog } from "@/components/roadmap/add-item-dialog";
import { CategorySection } from "@/components/roadmap/category-section";
import { RoadmapFlow } from "@/components/roadmap/roadmap-flow";
import { TopicDetailDialog } from "@/components/roadmap/topic-detail-dialog";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { useCategories, usePrimarySubject, useSubjectProgress, useTopics } from "@/hooks/use-data";
import { useStudyModel } from "@/hooks/use-study-model";

export function RoadmapScreen() {
  const repo = useRepository();
  const model = useStudyModel();
  const primary = usePrimarySubject();
  const searchParams = useSearchParams();

  // `undefined` = follow the ?topic= URL param; anything else = user override
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [subjectPick, setSubjectPick] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);

  const selectedTopic = override === undefined ? searchParams.get("topic") : override;
  const paramTopic = searchParams.get("topic");
  const subjectId =
    subjectPick ??
    searchParams.get("subject") ??
    (paramTopic ? model?.topicMetrics.get(paramTopic)?.subject.id : undefined) ??
    primary?.id;
  const subject = model?.subjects.find((s) => s.id === subjectId) ?? primary;
  const progress = useSubjectProgress(subject?.id);
  const categories = useCategories(subject?.id);
  const topics = useTopics();

  const orderedCategories = useMemo(
    () => (categories ?? []).slice().sort((a, b) => a.order - b.order),
    [categories],
  );

  const topicsByCategory = useMemo(() => {
    const map = new Map<string, typeof topics>();
    for (const t of topics ?? []) {
      if (t.archived) continue;
      const arr = map.get(t.categoryId) ?? [];
      arr.push(t);
      map.set(t.categoryId, arr);
    }
    for (const arr of map.values()) arr?.sort((a, b) => a.order - b.order);
    return map;
  }, [topics]);

  async function moveCategory(id: string, dir: -1 | 1) {
    const ids = orderedCategories.map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    if (subject) await repo.reorderCategories(subject.id, ids);
  }

  const loading = !subject || !progress || categories === undefined || topics === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ロードマップ"
        description={subject ? `${subject.name}の全体像と単元ごとの進捗` : undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => setAddCatOpen(true)}>
            <Plus className="size-4" /> 分野を追加
          </Button>
        }
      />

      {model && model.subjects.length > 1 ? (
        <ChipGroup
          aria-label="科目"
          value={subject?.id ?? ""}
          onChange={(v) => setSubjectPick(v)}
          options={model.subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <RoadmapFlow categories={progress.categories} />

          <div className="space-y-3">
            {orderedCategories.map((category, i) => (
              <CategorySection
                key={category.id}
                category={category}
                topics={topicsByCategory.get(category.id) ?? []}
                index={i}
                count={orderedCategories.length}
                onMoveCategory={(id, dir) => void moveCategory(id, dir)}
                onOpenTopic={(id) => setOverride(id)}
              />
            ))}
          </div>
        </>
      )}

      <TopicDetailDialog topicId={selectedTopic} onClose={() => setOverride(null)} />

      <AddItemDialog
        open={addCatOpen}
        onOpenChange={setAddCatOpen}
        title="分野を追加"
        description="ロードマップの末尾に新しい分野を追加します。"
        placeholder="例: 複素関数"
        onSubmit={async (value) => {
          if (!subject) return;
          await repo.addCategory(subject.id, value);
          toast({ title: `「${value}」を追加しました`, variant: "success" });
        }}
      />
    </div>
  );
}
