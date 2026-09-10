"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Palette pulled from CSS tokens so charts match light / dark automatically. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const AXIS_PROPS = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
} as const;

export function ChartFrame({
  title,
  description,
  height = 240,
  children,
  action,
}: {
  title: string;
  description?: string;
  height?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  format,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
  format?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border-border bg-popover rounded-lg border px-2.5 py-1.5 text-xs shadow-lg">
      {label !== undefined ? <p className="text-foreground mb-1 font-medium">{label}</p> : null}
      {payload.map((entry, i) => {
        const num = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
        return (
          <p key={i} className="text-muted-foreground flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: entry.color ?? "var(--chart-1)" }}
            />
            {entry.name ? <span>{entry.name}:</span> : null}
            <span className="text-foreground font-medium">
              {format ? format(num) : `${num}${unit}`}
            </span>
          </p>
        );
      })}
    </div>
  );
}
