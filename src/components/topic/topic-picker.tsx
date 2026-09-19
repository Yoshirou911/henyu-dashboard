"use client";

import { useMemo } from "react";
import { Select, type SelectOption } from "@/components/ui/select";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ID } from "@/lib/types";

const NONE = "__none__";

/** Two-step picker: subject → topic (grouped label "分野 / 単元"). */
export function TopicPicker({
  model,
  subjectId,
  topicId,
  onChange,
  allowNone = false,
  disabled,
}: {
  model: StudyModel;
  subjectId: ID | null;
  topicId: ID | null;
  onChange: (next: { subjectId: ID | null; topicId: ID | null }) => void;
  allowNone?: boolean;
  disabled?: boolean;
}) {
  const subjectOptions = useMemo<SelectOption[]>(
    () => model.subjects.map((s) => ({ value: s.id, label: s.name })),
    [model.subjects],
  );
  const topicOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = allowNone ? [{ value: NONE, label: "科目全体（単元なし）" }] : [];
    for (const m of model.topicMetrics.values()) {
      if (m.subject.id !== subjectId) continue;
      list.push({ value: m.topic.id, label: `${m.category.name} / ${m.topic.name}` });
    }
    return list;
  }, [model.topicMetrics, subjectId, allowNone]);

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
      <Select
        items={subjectOptions}
        value={subjectId ?? ""}
        placeholder="科目"
        aria-label="科目"
        disabled={disabled}
        onValueChange={(v) => onChange({ subjectId: v, topicId: null })}
      />
      <Select
        items={topicOptions}
        value={topicId ?? (allowNone ? NONE : "")}
        placeholder="単元"
        aria-label="単元"
        disabled={disabled || !subjectId}
        onValueChange={(v) => onChange({ subjectId, topicId: v === NONE ? null : v })}
      />
    </div>
  );
}
