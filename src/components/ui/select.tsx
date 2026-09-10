"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  items: SelectOption[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  disabled?: boolean;
  id?: string;
}

/** shadcn-flavoured wrapper over Base UI Select for simple string-valued menus. */
export function Select({
  value,
  onValueChange,
  items,
  placeholder = "選択…",
  className,
  contentClassName,
  disabled,
  id,
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "border-input flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm shadow-sm transition-colors outline-none",
          "focus-visible:ring-ring focus-visible:ring-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          className,
        )}
      >
        <BaseSelect.Value placeholder={placeholder} className="truncate text-left" />
        <BaseSelect.Icon>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} className="z-50" alignItemWithTrigger={false}>
          <BaseSelect.Popup
            className={cn(
              "border-border bg-popover text-popover-foreground max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border p-1 text-sm shadow-lg outline-none",
              "transition-[transform,opacity] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
              contentClassName,
            )}
          >
            {items.map((item) => (
              <BaseSelect.Item
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 outline-none select-none",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:opacity-50",
                )}
              >
                <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>
                  <Check className="text-primary size-4" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
