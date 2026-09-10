"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/topic/status-badge";
import { STATUS_LIST } from "@/lib/constants";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusSelectProps {
  value: Status;
  onChange: (status: Status) => void | Promise<void>;
  align?: "start" | "center" | "end";
  className?: string;
  disabled?: boolean;
}

/** One-tap status changer (spec §5) used across the roadmap, today and detail views. */
export function StatusSelect({
  value,
  onChange,
  align = "end",
  className,
  disabled,
}: StatusSelectProps) {
  const [pending, setPending] = useState(false);

  async function pick(next: Status) {
    if (next === value) return;
    setPending(true);
    try {
      await onChange(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || pending}
        className={cn(
          "border-border hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1 rounded-md border bg-transparent px-1.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 disabled:opacity-60",
          className,
        )}
        aria-label={`ステータスを変更（現在: ${STATUS_LIST[value]?.label ?? value}）`}
      >
        <StatusBadge status={value} className="border-0" />
        <ChevronDown className="text-muted-foreground size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[15rem]">
        {STATUS_LIST.map((meta) => (
          <DropdownMenuItem
            key={meta.value}
            onClick={() => void pick(meta.value)}
            className="items-start"
          >
            <span className="mt-0.5 flex w-4 justify-center">
              {meta.value === value ? <Check className="text-primary size-3.5" /> : null}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <StatusBadge status={meta.value} />
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[11px]">
                {meta.description}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
