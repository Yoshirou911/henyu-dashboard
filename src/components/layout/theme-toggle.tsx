"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRepository } from "@/components/providers/repository-provider";
import { useMounted } from "@/hooks/use-mounted";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "ダーク", icon: Moon },
  { value: "light", label: "ライト", icon: Sun },
  { value: "system", label: "システム", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const repo = useRepository();
  const mounted = useMounted();

  const current = (mounted ? (theme ?? "dark") : "dark") as ThemePreference;
  const Active = OPTIONS.find((o) => o.value === current)?.icon ?? Moon;

  async function choose(next: ThemePreference) {
    setTheme(next);
    try {
      await repo.updateSettings({ theme: next });
    } catch {
      /* non-critical */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="テーマを切り替え"
        className="border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-2"
      >
        <Active className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => void choose(o.value)}>
            <o.icon className="size-4" />
            <span className="flex-1">{o.label}</span>
            <span
              className={cn(
                "bg-primary size-1.5 rounded-full transition-opacity",
                current === o.value ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
