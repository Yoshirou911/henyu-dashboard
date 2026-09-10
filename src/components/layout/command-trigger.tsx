"use client";

import { Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { openCommandPalette } from "@/components/command-palette/command-palette";

export function CommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className="border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs transition-colors outline-none focus-visible:ring-2"
      aria-label="コマンドパレットを開く"
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">検索 / コマンド</span>
      <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
    </button>
  );
}
