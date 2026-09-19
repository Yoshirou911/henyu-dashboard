"use client";

import { cn } from "@/lib/utils";

interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

/** Segmented single-choice control — faster than a select for 3–6 options on touch. */
export function ChipGroup<T extends string | number>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
  size = "default",
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly ChipOption<T>[];
  className?: string;
  "aria-label"?: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-visible:ring-ring rounded-md border font-medium transition-colors outline-none focus-visible:ring-2",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
              active
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
