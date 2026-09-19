"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { RecordDialog } from "@/components/record/record-dialog";
import type { ID, StudySource } from "@/lib/types";

export interface RecordRequest {
  /** session = coming from the timer (minutes prefilled); exercise = quick result entry */
  mode: "session" | "exercise";
  topicId?: ID | null;
  subjectId?: ID | null;
  minutes?: number;
  plannedMinutes?: number;
  startedAt?: number;
  endedAt?: number;
  source?: StudySource;
  onSaved?: () => void;
  onCancel?: () => void;
}

interface RecorderValue {
  openRecord: (req: RecordRequest) => void;
}

const RecorderContext = createContext<RecorderValue | null>(null);

/** Hosts the single quick-record dialog used by the timer, planner, topic rows, etc. */
export function RecordProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<RecordRequest | null>(null);
  const openRecord = useCallback((req: RecordRequest) => setRequest(req), []);
  const value = useMemo(() => ({ openRecord }), [openRecord]);

  return (
    <RecorderContext.Provider value={value}>
      {children}
      <RecordDialog request={request} onClose={() => setRequest(null)} />
    </RecorderContext.Provider>
  );
}

export function useRecorder(): RecorderValue {
  const ctx = useContext(RecorderContext);
  if (!ctx) throw new Error("useRecorder must be used within <RecordProvider>");
  return ctx;
}
