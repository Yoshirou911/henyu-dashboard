"use client";

import { useMemo } from "react";
import { useRepository } from "@/components/providers/repository-provider";
import { useDayClock } from "@/hooks/use-day-clock";
import { useLive } from "@/hooks/use-live";
import { buildStudyModel, type StudyModel } from "@/lib/model/buildStudyModel";

/**
 * The single derived view-model every Phase 2 screen reads from. The raw
 * snapshot is live-queried (any write re-renders), and all metrics — mastery,
 * weakness, readiness, priorities, today's plan — are recomputed in memory.
 */
export function useStudyModel(): StudyModel | undefined {
  const repo = useRepository();
  const snapshot = useLive(() => repo.getSnapshot(), []);
  // fixed within a day, rolls over at midnight (long-lived PWA sessions)
  const now = useDayClock();
  return useMemo(() => (snapshot ? buildStudyModel(snapshot, now) : undefined), [snapshot, now]);
}
