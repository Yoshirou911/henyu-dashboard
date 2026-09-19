"use client";

import { useState } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { AVAILABLE_MINUTE_PRESETS } from "@/lib/constants";

const CUSTOM = -1;

/** 今日使える時間 — saved per day so the plan survives reloads (spec §17). */
export function AvailableTimePicker({ date, value }: { date: string; value: number }) {
  const repo = useRepository();
  const isPreset = (AVAILABLE_MINUTE_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(String(value));

  const options = [
    ...AVAILABLE_MINUTE_PRESETS.map((m) => ({ value: m as number, label: `${m}分` })),
    { value: CUSTOM, label: "カスタム" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipGroup
        aria-label="今日使える時間"
        value={custom ? CUSTOM : value}
        options={options}
        onChange={(v) => {
          if (v === CUSTOM) {
            setCustom(true);
            return;
          }
          setCustom(false);
          setDraft(String(v));
          void repo.setAvailableMinutes(date, v);
        }}
      />
      {custom ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number.parseInt(draft, 10);
            if (Number.isFinite(n) && n > 0) void repo.setAvailableMinutes(date, Math.min(n, 720));
          }}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n > 0)
                void repo.setAvailableMinutes(date, Math.min(n, 720));
            }}
            className="h-7 w-20 text-xs"
            aria-label="カスタム分数"
          />
          <span className="text-muted-foreground text-xs">分</span>
        </form>
      ) : null}
    </div>
  );
}
