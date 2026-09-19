import type { EvaluationType } from "@/lib/types";

/**
 * Review queue ordering (spec §14):
 *   1. 期限超過（日数が大きい順） 2. 習熟度が低い順 3. 復習失敗回数が多い順
 *   4. 第一志望での重要度が高い順 5. 前提単元（他の単元をブロック）を優先
 */
export interface ReviewQueueKey {
  overdueDays: number;
  mastery: number;
  failedCount: number;
  firstChoiceImportance: number;
  blocksCount: number;
}

export function compareReviewPriority(a: ReviewQueueKey, b: ReviewQueueKey): number {
  return (
    b.overdueDays - a.overdueDays ||
    a.mastery - b.mastery ||
    b.failedCount - a.failedCount ||
    b.firstChoiceImportance - a.firstChoiceImportance ||
    Number(b.blocksCount > 0) - Number(a.blocksCount > 0)
  );
}

/** Suggested amount for one review sitting: "5問" / "3問" / "20語". */
export function reviewAmount(opts: {
  evaluationType: EvaluationType;
  isVocab: boolean;
  overdueDays: number;
}): string {
  if (opts.isVocab) return "20語";
  if (opts.evaluationType === "problem") return opts.overdueDays >= 1 ? "5問" : "3問";
  if (opts.evaluationType === "interview") return "見直し";
  return "10分";
}

/** "昨日" / "2日前" / "今日" for a due date relative to today. */
export function dueLabel(overdueDays: number): string {
  if (overdueDays <= 0) return "今日";
  if (overdueDays === 1) return "昨日";
  return `${overdueDays}日前`;
}

export const VOCAB_PATTERN = /単語|語彙|vocab/i;
