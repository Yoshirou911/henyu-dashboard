import { cn } from "@/lib/utils";

/** Colour ramp for 0–100 scores: red → amber → blue → green. */
export function scoreColor(score: number): string {
  if (score >= 75) return "var(--status-3)";
  if (score >= 50) return "var(--status-2)";
  if (score >= 25) return "var(--status-1)";
  return "var(--destructive)";
}

/** Compact horizontal meter with an optional numeric label. */
export function Meter({
  value,
  className,
  showValue = true,
  color,
  label,
}: {
  value: number;
  className?: string;
  showValue?: boolean;
  color?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${v}%`, backgroundColor: color ?? scoreColor(v) }}
        />
      </div>
      {showValue ? (
        <span className="text-muted-foreground w-8 shrink-0 text-right text-xs tabular-nums">
          {v}
        </span>
      ) : null}
    </div>
  );
}

/** "82%" pill coloured by value; "—" when unknown. */
export function RatePill({ rate, className }: { rate: number | null; className?: string }) {
  if (rate === null) {
    return <span className={cn("text-muted-foreground text-xs tabular-nums", className)}>—</span>;
  }
  const pct = Math.round(rate * 100);
  const color = scoreColor(pct);
  return (
    <span
      className={cn("rounded px-1.5 py-0.5 text-xs font-medium tabular-nums", className)}
      style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      {pct}%
    </span>
  );
}
