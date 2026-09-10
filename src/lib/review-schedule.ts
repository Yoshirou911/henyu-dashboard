import { REVIEW_INTERVALS_DAYS } from "@/lib/constants";
import { addDays, startOfDay } from "@/lib/date";
import type { Review, ReviewOutcome, Status } from "@/lib/types";

/**
 * Intentionally simple fixed-interval review scheduler (spec §12 — no full SRS).
 * At most one open review per topic at a time.
 */

export function intervalForStage(stage: number): number {
  const clamped = Math.min(Math.max(stage, 0), REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[clamped] ?? 1;
}

/** First review after a topic reaches 基本OK. */
export function firstReviewDueAt(basicOkAt: number): number {
  return startOfDay(addDays(basicOkAt, intervalForStage(0)));
}

export interface NextReviewPlan {
  /** create a follow-up review, or null when the topic has graduated the schedule */
  nextStage: number | null;
  nextDueAt: number | null;
  /** new topic status after applying the outcome (unchanged unless lowered) */
  nextStatus: Status;
  statusLowered: boolean;
}

export function planAfterReview(
  currentStage: number,
  currentStatus: Status,
  outcome: ReviewOutcome,
  options: { autoLowerOnFailed: boolean; now?: number },
): NextReviewPlan {
  const now = options.now ?? Date.now();

  if (outcome === "got") {
    const nextStage = currentStage + 1;
    if (nextStage >= REVIEW_INTERVALS_DAYS.length) {
      return { nextStage: null, nextDueAt: null, nextStatus: currentStatus, statusLowered: false };
    }
    return {
      nextStage,
      nextDueAt: startOfDay(addDays(now, intervalForStage(nextStage))),
      nextStatus: currentStatus,
      statusLowered: false,
    };
  }

  if (outcome === "shaky") {
    // repeat the same interval
    return {
      nextStage: currentStage,
      nextDueAt: startOfDay(addDays(now, intervalForStage(currentStage))),
      nextStatus: currentStatus,
      statusLowered: false,
    };
  }

  // failed
  const lowered = options.autoLowerOnFailed && currentStatus > 0;
  const nextStatus = (lowered ? currentStatus - 1 : currentStatus) as Status;
  return {
    nextStage: 0,
    nextDueAt: startOfDay(addDays(now, intervalForStage(0))),
    nextStatus,
    statusLowered: lowered,
  };
}

export function isDue(review: Review, now: number = Date.now()): boolean {
  return !review.completedAt && review.dueAt <= startOfDay(now) + 1;
}

export function isOpen(review: Review): boolean {
  return !review.completedAt;
}
