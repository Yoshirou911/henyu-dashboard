import { DONE_THRESHOLD } from "@/lib/constants";
import type { Category, CategoryProgress, Subject, SubjectProgress, Topic } from "@/lib/types";
import { STATUS_SCORE } from "@/lib/types";
import { roundTo } from "@/lib/utils";

/** Weighted mean of topic status-scores. Returns 0 for an empty list. */
export function weightedPercent(topics: readonly Topic[]): number {
  if (topics.length === 0) return 0;
  let weighted = 0;
  let weightSum = 0;
  for (const t of topics) {
    const w = t.weight > 0 ? t.weight : 1;
    weighted += STATUS_SCORE[t.status] * w;
    weightSum += w;
  }
  if (weightSum === 0) return 0;
  return roundTo(weighted / weightSum, 1);
}

export function doneCount(topics: readonly Topic[]): number {
  return topics.filter((t) => t.status >= DONE_THRESHOLD).length;
}

export function buildCategoryProgress(
  category: Category,
  topics: readonly Topic[],
): CategoryProgress {
  const owned = topics
    .filter((t) => t.categoryId === category.id)
    .slice()
    .sort((a, b) => a.order - b.order);
  return {
    category,
    topics: owned,
    percent: weightedPercent(owned),
    topicCount: owned.length,
    doneCount: doneCount(owned),
  };
}

export function buildSubjectProgress(
  subject: Subject,
  categories: readonly Category[],
  topics: readonly Topic[],
): SubjectProgress {
  const cats = categories
    .filter((c) => c.subjectId === subject.id)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => buildCategoryProgress(c, topics));

  const subjectTopics = topics.filter((t) => cats.some((c) => c.category.id === t.categoryId));

  return {
    subject,
    categories: cats,
    percent: weightedPercent(subjectTopics),
    topicCount: subjectTopics.length,
    doneCount: doneCount(subjectTopics),
  };
}

/** Topic in `topics` list order that is the current "現在地" — first non-定着 topic. */
export function findCurrentTopic(orderedTopics: readonly Topic[]): Topic | undefined {
  return (
    orderedTopics.find((t) => t.status === 1) ??
    orderedTopics.find((t) => t.status > 0 && t.status < DONE_THRESHOLD) ??
    orderedTopics.find((t) => t.status === 0)
  );
}

/** The next few upcoming topics after the current position (spec §4 "次にやること"). */
export function findUpcomingTopics(orderedTopics: readonly Topic[], count = 3): Topic[] {
  const firstUnfinished = orderedTopics.findIndex((t) => t.status < DONE_THRESHOLD);
  if (firstUnfinished === -1) return [];
  return orderedTopics.slice(firstUnfinished, firstUnfinished + count);
}

export interface SubjectTopicView {
  topic: Topic;
  category: Category;
}

/** Flattened, roadmap-ordered topic list for a subject. */
export function orderedSubjectTopics(
  subject: Subject,
  categories: readonly Category[],
  topics: readonly Topic[],
): SubjectTopicView[] {
  const cats = categories
    .filter((c) => c.subjectId === subject.id)
    .slice()
    .sort((a, b) => a.order - b.order || a.track - b.track);
  const out: SubjectTopicView[] = [];
  for (const category of cats) {
    const owned = topics
      .filter((t) => t.categoryId === category.id)
      .slice()
      .sort((a, b) => a.order - b.order);
    for (const topic of owned) out.push({ topic, category });
  }
  return out;
}
