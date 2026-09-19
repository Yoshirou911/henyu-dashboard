"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavIcon } from "@/components/layout/nav-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOBILE_PRIMARY_NAV, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Phone bar: ホーム・今日・復習・科目 + その他 (spec §34 — today / review first). */
export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const primary = NAV_ITEMS.filter((n) => MOBILE_PRIMARY_NAV.includes(n.href));
  const rest = NAV_ITEMS.filter((n) => !MOBILE_PRIMARY_NAV.includes(n.href));
  const restActive = rest.some((n) => isActive(pathname, n.href));

  return (
    <nav
      className={cn(
        "border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t pb-[env(safe-area-inset-bottom)] backdrop-blur",
        className,
      )}
      aria-label="メインナビゲーション"
    >
      {primary.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors outline-none",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <NavIcon name={item.icon} className="size-5" />
            {item.href === "/" ? "ホーム" : item.label}
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium outline-none",
            restActive ? "text-primary" : "text-muted-foreground",
          )}
          aria-label="その他のページ"
        >
          <MoreHorizontal className="size-5" />
          その他
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="min-w-[12rem]">
          {rest.map((item) => (
            <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
              <NavIcon name={item.icon} className="size-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
