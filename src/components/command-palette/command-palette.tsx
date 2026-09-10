"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ArrowRight, CalendarCheck, Download, FileText, Play, Search, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { NavIcon } from "@/components/layout/nav-icon";
import { StatusDot } from "@/components/topic/status-badge";
import { toast } from "@/components/ui/toaster";
import { usePrimarySubject, useOrderedSubjectTopics } from "@/hooks/use-data";
import { useTimer } from "@/hooks/use-timer";
import { NAV_ITEMS } from "@/lib/constants";
import { downloadBackup } from "@/lib/backup-io";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "henyu:open-command";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <BaseDialog.Root open={open} onOpenChange={setOpen}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "border-border bg-popover fixed top-[12vh] left-1/2 z-[90] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl outline-none",
            "transition-all data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <BaseDialog.Title className="sr-only">コマンドパレット</BaseDialog.Title>
          {/* mounted only while open → local state resets automatically */}
          <PaletteBody onClose={() => setOpen(false)} />
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const repo = useRepository();
  const timer = useTimer();
  const subject = usePrimarySubject();
  const topicViews = useOrderedSubjectTopics(subject?.id);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      ...NAV_ITEMS.map((n) => ({
        id: `nav:${n.href}`,
        group: "移動",
        label: n.label,
        keywords: n.href,
        icon: <NavIcon name={n.icon} className="size-4" />,
        run: () => go(n.href),
      })),
      {
        id: "action:goal",
        group: "アクション",
        label: "今日の目標を設定",
        icon: <CalendarCheck className="size-4" />,
        run: () => go("/today"),
      },
      {
        id: "action:timer-toggle",
        group: "アクション",
        label: timer.running ? "タイマーを一時停止" : "タイマーを開始",
        icon: timer.running ? <Square className="size-4" /> : <Play className="size-4" />,
        run: () => {
          if (timer.running) timer.pause();
          else timer.start();
          onClose();
        },
      },
      {
        id: "action:timer-stop",
        group: "アクション",
        label: "タイマーを終了して記録",
        icon: <Square className="size-4" />,
        run: async () => {
          await timer.stop();
          onClose();
        },
      },
      {
        id: "action:exam",
        group: "アクション",
        label: "過去問の得点を追加",
        icon: <FileText className="size-4" />,
        run: () => go("/analytics?add=exam"),
      },
      {
        id: "action:export",
        group: "アクション",
        label: "バックアップをエクスポート",
        icon: <Download className="size-4" />,
        run: async () => {
          const file = await repo.exportBackup();
          downloadBackup(file);
          toast({ title: "バックアップを書き出しました", variant: "success" });
          onClose();
        },
      },
    ];

    for (const v of topicViews ?? []) {
      base.push({
        id: `topic:${v.topic.id}`,
        group: "単元へ移動",
        label: v.topic.name,
        hint: v.category.name,
        keywords: `${v.category.name} ${v.topic.name}`,
        icon: <StatusDot status={v.topic.status} />,
        run: () => go(`/roadmap?topic=${v.topic.id}`),
      });
    }
    return base;
  }, [go, onClose, repo, timer, topicViews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 40);
    return items
      .filter((it) => `${it.label} ${it.hint ?? ""} ${it.keywords ?? ""}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [items, query]);

  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((it) => {
      const arr = map.get(it.group) ?? [];
      arr.push(it);
      map.set(it.group, arr);
    });
    return [...map.entries()];
  }, [filtered]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void filtered[activeIndex]?.run();
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div onKeyDown={onKeyDown}>
      <div className="border-border flex items-center gap-2 border-b px-3">
        <Search className="text-muted-foreground size-4" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="単元名で検索、またはコマンドを入力…"
          className="placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none"
          aria-label="コマンド検索"
        />
      </div>
      <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            一致する項目がありません
          </p>
        ) : (
          grouped.map(([group, groupItems]) => (
            <div key={group} className="mb-1">
              <p className="text-muted-foreground px-2 py-1 text-[11px] font-medium tracking-wide uppercase">
                {group}
              </p>
              {groupItems.map((it) => {
                const index = filtered.indexOf(it);
                return (
                  <button
                    key={it.id}
                    type="button"
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => void it.run()}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors outline-none",
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/90",
                    )}
                  >
                    <span className="text-muted-foreground flex size-4 items-center justify-center">
                      {it.icon}
                    </span>
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint ? (
                      <span className="text-muted-foreground truncate text-xs">{it.hint}</span>
                    ) : null}
                    <ArrowRight className="text-muted-foreground size-3.5 shrink-0 opacity-0" />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
