"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icon";
import { useSettings } from "@/hooks/use-data";
import { NAV_ITEMS } from "@/lib/constants";
import { daysUntil } from "@/lib/date";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const settings = useSettings();
  const days = settings ? daysUntil(settings.examDate) : null;

  return (
    <aside
      className={cn(
        "border-border bg-card/40 sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r px-3 py-4",
        className,
      )}
    >
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <NavIcon name="git-branch" className="size-4" />
        </span>
        <span className="text-sm leading-tight font-semibold">
          編入対策
          <span className="text-muted-foreground block text-xs font-normal">
            学習ダッシュボード
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <NavIcon name={item.icon} className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {days !== null ? (
        <div className="border-border bg-background/60 mt-4 rounded-lg border p-3">
          <p className="text-muted-foreground text-[11px]">試験まで</p>
          <p className="text-lg font-semibold tabular-nums">
            {days >= 0 ? `あと ${days} 日` : `${Math.abs(days)} 日経過`}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
