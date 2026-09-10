import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-muted/60 animate-pulse rounded-md", className)} aria-hidden {...props} />
  );
}
