import { STATUS_META } from "@/lib/constants";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: Status;
  className?: string;
  /** dot-only compact form */
  dotOnly?: boolean;
}

export function StatusBadge({ status, className, dotOnly }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const color = `var(--${meta.token})`;

  if (dotOnly) {
    return (
      <span
        className={cn("inline-block size-2 rounded-full", className)}
        style={{ backgroundColor: color }}
        aria-label={meta.label}
        title={meta.label}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {meta.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <StatusBadge status={status} dotOnly className={className} />;
}
