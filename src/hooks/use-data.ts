"use client";

import { useRepository } from "@/components/providers/repository-provider";
import { useLive } from "@/hooks/use-live";
import { buildSubjectProgress, orderedSubjectTopics } from "@/lib/progress";
import type { ID, Subject } from "@/lib/types";

export function useSettings() {
  const repo = useRepository();
  return useLive(() => repo.getSettings(), []);
}

export function useSubjects() {
  const repo = useRepository();
  return useLive(() => repo.listSubjects(), []);
}

export function useCategories(subjectId?: ID) {
  const repo = useRepository();
  return useLive(() => repo.listCategories(subjectId), [subjectId]);
}

export function useTopics() {
  const repo = useRepository();
  return useLive(() => repo.listTopics(), []);
}

export function useStudySessions(sinceMs?: number) {
  const repo = useRepository();
  return useLive(() => repo.listStudySessions(sinceMs), [sinceMs]);
}

export function useReviews() {
  const repo = useRepository();
  return useLive(() => repo.listReviews(), []);
}

export function useOpenReviews() {
  const repo = useRepository();
  return useLive(() => repo.listOpenReviews(), []);
}

export function useDailyGoal(date: string) {
  const repo = useRepository();
  return useLive(() => repo.getDailyGoal(date), [date]);
}

export function useDailyGoals(sinceDate?: string) {
  const repo = useRepository();
  return useLive(() => repo.listDailyGoals(sinceDate), [sinceDate]);
}

export function useActivity(limit = 40) {
  const repo = useRepository();
  return useLive(() => repo.listActivity(limit), [limit]);
}

/** The subject the dashboard focuses on (spec §4) — primary from settings, else first. */
export function usePrimarySubject(): Subject | undefined {
  const subjects = useSubjects();
  const settings = useSettings();
  if (!subjects || subjects.length === 0) return undefined;
  const primary = subjects.find((s) => s.id === settings?.primarySubjectId);
  return primary ?? subjects[0];
}

/** Fully-derived progress view-model for a subject; recomputed on any topic change. */
export function useSubjectProgress(subjectId?: ID) {
  const repo = useRepository();
  return useLive(async () => {
    if (!subjectId) return undefined;
    const [subjects, categories, topics] = await Promise.all([
      repo.listSubjects(),
      repo.listCategories(),
      repo.listTopics(),
    ]);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return undefined;
    return buildSubjectProgress(subject, categories, topics);
  }, [subjectId]);
}

export function useOrderedSubjectTopics(subjectId?: ID) {
  const repo = useRepository();
  return useLive(async () => {
    if (!subjectId) return undefined;
    const [subjects, categories, topics] = await Promise.all([
      repo.listSubjects(),
      repo.listCategories(),
      repo.listTopics(),
    ]);
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return undefined;
    return orderedSubjectTopics(subject, categories, topics);
  }, [subjectId]);
}
