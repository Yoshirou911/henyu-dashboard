"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { createId } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastRecord extends Required<Omit<ToastInput, "durationMs">> {
  id: string;
}

let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

function remove(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  emit();
}

export function toast(input: ToastInput): string {
  const id = createId("toast");
  const record: ToastRecord = {
    id,
    title: input.title,
    description: input.description ?? "",
    variant: input.variant ?? "default",
  };
  toasts = [record, ...toasts].slice(0, 4);
  emit();
  timers.set(
    id,
    setTimeout(() => remove(id), input.durationMs ?? 3800),
  );
  return id;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return toasts;
}

const EMPTY: ToastRecord[] = [];

const ICONS = {
  default: Info,
  success: CheckCircle2,
  error: TriangleAlert,
} as const;

export function Toaster() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="通知"
    >
      {items.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "app-fade-in border-border bg-popover text-popover-foreground pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg",
            )}
            role="status"
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                t.variant === "success" && "text-success",
                t.variant === "error" && "text-destructive",
                t.variant === "default" && "text-muted-foreground",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description ? (
                <p className="text-muted-foreground mt-0.5 text-xs">{t.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
              aria-label="閉じる"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
