"use client";

import { ChevronRight, MoreVertical, Plus } from "lucide-react";
import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { AddItemDialog } from "@/components/roadmap/add-item-dialog";
import { TopicRow } from "@/components/roadmap/topic-row";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { weightedPercent } from "@/lib/progress";
import type { Category, Topic } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategorySectionProps {
  category: Category;
  topics: Topic[];
  index: number;
  count: number;
  onMoveCategory: (id: string, dir: -1 | 1) => void;
  onOpenTopic: (id: string) => void;
}

export function CategorySection({
  category,
  topics,
  index,
  count,
  onMoveCategory,
  onOpenTopic,
}: CategorySectionProps) {
  const repo = useRepository();
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const percent = weightedPercent(topics);
  const done = topics.filter((t) => t.status >= 3).length;

  async function moveTopic(id: string, dir: -1 | 1) {
    const ids = topics.map((t) => t.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    await repo.reorderTopics(category.id, ids);
  }

  return (
    <section
      id={`cat-${category.id}`}
      className="border-border bg-card scroll-mt-20 rounded-xl border"
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronRight
            className={cn(
              "text-muted-foreground size-4 shrink-0 transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="truncate text-sm font-semibold">{category.name}</span>
          {category.track === 1 ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
              並行ルート
            </span>
          ) : null}
          <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
            {done}/{topics.length} ・ {Math.round(percent)}%
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring rounded-md p-1 outline-none focus-visible:ring-2"
            aria-label={`${category.name} の操作`}
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> 単元を追加
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>名前を変更</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveCategory(category.id, -1)}
              disabled={index === 0}
            >
              上へ移動
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onMoveCategory(category.id, 1)}
              disabled={index === count - 1}
            >
              下へ移動
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                repo
                  .updateCategory(category.id, { track: category.track === 1 ? 0 : 1 })
                  .catch(() => undefined)
              }
            >
              {category.track === 1 ? "メインルートにする" : "並行ルートにする"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive data-[highlighted]:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              分野を削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3">
        <Progress value={percent} className="h-1" />
      </div>

      {open ? (
        <div className="space-y-0.5 p-2">
          {topics.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">単元がありません。</p>
          ) : (
            topics.map((topic, i) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                index={i}
                count={topics.length}
                onOpen={onOpenTopic}
                onMove={(id, dir) => void moveTopic(id, dir)}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-muted-foreground hover:bg-accent/50 hover:text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
          >
            <Plus className="size-3.5" /> 単元を追加
          </button>
        </div>
      ) : null}

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="単元を追加"
        description={`「${category.name}」に新しい単元を追加します。`}
        placeholder="例: ロピタルの定理"
        onSubmit={async (value) => {
          await repo.addTopic(category.id, value);
          toast({ title: `「${value}」を追加しました`, variant: "success" });
        }}
      />
      <AddItemDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="分野名を変更"
        placeholder="分野名"
        initialValue={category.name}
        onSubmit={async (value) => {
          await repo.updateCategory(category.id, { name: value });
        }}
      />
      <AddItemDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="分野を削除しますか？"
        description={`「${category.name}」と、含まれる ${topics.length} 単元・その復習予定が削除されます。取り消せません。`}
        placeholder={`確認のため「${category.name}」と入力`}
        onSubmit={async (value) => {
          if (value !== category.name) {
            toast({ title: "入力が一致しません", variant: "error" });
            return;
          }
          await repo.deleteCategory(category.id);
          toast({ title: "分野を削除しました" });
        }}
      />
    </section>
  );
}
