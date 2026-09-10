import { Progress as BaseProgress } from "@base-ui/react/progress";
import { clamp } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  indicatorClassName?: string;
  /** aria label for screen readers */
  label?: string;
}

/** Linear progress bar with an accessible role from Base UI. */
export function Progress({ value, className, indicatorClassName, label }: ProgressProps) {
  const pct = clamp(Math.round(value), 0, 100);
  return (
    <BaseProgress.Root value={pct} aria-label={label} className={cn("w-full", className)}>
      <BaseProgress.Track className="bg-muted relative h-2 w-full overflow-hidden rounded-full">
        <BaseProgress.Indicator
          className={cn(
            "bg-primary h-full rounded-full transition-[width] duration-500 ease-out",
            indicatorClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  children?: React.ReactNode;
}

/** Circular progress used for the headline subject progress (spec §4). */
export function ProgressRing({
  value,
  size = 160,
  strokeWidth = 12,
  className,
  trackClassName,
  indicatorClassName,
  children,
}: ProgressRingProps) {
  const pct = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`進捗 ${Math.round(pct)}パーセント`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-muted", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "stroke-primary transition-[stroke-dashoffset] duration-700 ease-out",
            indicatorClassName,
          )}
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      ) : null}
    </div>
  );
}
