"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandTrigger } from "@/components/layout/command-trigger";
import { NavIcon } from "@/components/layout/nav-icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TimerChip } from "@/components/layout/timer-chip";
import { NAV_ITEMS } from "@/lib/constants";

export function TopBar() {
  const pathname = usePathname();
  const current =
    NAV_ITEMS.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))
      ?.label ?? "";

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:px-8">
      <Link href="/" className="flex items-center gap-2 lg:hidden">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <NavIcon name="git-branch" className="size-4" />
        </span>
      </Link>
      <span className="text-muted-foreground hidden text-sm font-medium lg:block">{current}</span>

      <div className="ml-auto flex items-center gap-2">
        <CommandTrigger />
        <TimerChip />
        <ThemeToggle />
      </div>
    </header>
  );
}
