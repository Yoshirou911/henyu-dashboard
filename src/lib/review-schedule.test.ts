import { describe, expect, it } from "vitest";
import { startOfDay } from "@/lib/date";
import { firstReviewDueAt, intervalForStage, planAfterReview } from "@/lib/review-schedule";

describe("intervalForStage", () => {
  it("follows the 1/3/7/14/30 schedule and clamps out-of-range stages", () => {
    expect(intervalForStage(0)).toBe(1);
    expect(intervalForStage(2)).toBe(7);
    expect(intervalForStage(4)).toBe(30);
    expect(intervalForStage(9)).toBe(30);
    expect(intervalForStage(-2)).toBe(1);
  });
});

describe("firstReviewDueAt", () => {
  it("is the local midnight one day after 基本OK", () => {
    const basicOk = new Date("2026-05-01T15:20:00").getTime();
    const due = firstReviewDueAt(basicOk);
    expect(due).toBe(startOfDay(new Date("2026-05-02T00:00:00")));
  });
});

describe("planAfterReview", () => {
  const now = new Date("2026-05-10T09:00:00").getTime();

  it("advances the stage on できた and keeps the status", () => {
    const plan = planAfterReview(0, 2, "got", { autoLowerOnFailed: true, now });
    expect(plan.nextStage).toBe(1);
    expect(plan.nextDueAt).toBe(startOfDay(new Date("2026-05-13T00:00:00"))); // +3 days
    expect(plan.nextStatus).toBe(2);
    expect(plan.statusLowered).toBe(false);
  });

  it("graduates the schedule after the final stage", () => {
    const plan = planAfterReview(4, 3, "got", { autoLowerOnFailed: false, now });
    expect(plan.nextStage).toBeNull();
    expect(plan.nextDueAt).toBeNull();
  });

  it("repeats the same interval on 怪しい", () => {
    const plan = planAfterReview(2, 3, "shaky", { autoLowerOnFailed: true, now });
    expect(plan.nextStage).toBe(2);
    expect(plan.nextDueAt).toBe(startOfDay(new Date("2026-05-17T00:00:00"))); // +7 days
    expect(plan.nextStatus).toBe(3);
  });

  it("restarts at stage 0 on できなかった and lowers status only when enabled", () => {
    const lowered = planAfterReview(3, 3, "failed", { autoLowerOnFailed: true, now });
    expect(lowered.nextStage).toBe(0);
    expect(lowered.nextStatus).toBe(2);
    expect(lowered.statusLowered).toBe(true);

    const kept = planAfterReview(3, 3, "failed", { autoLowerOnFailed: false, now });
    expect(kept.nextStatus).toBe(3);
    expect(kept.statusLowered).toBe(false);
  });

  it("never lowers below 未学習", () => {
    const plan = planAfterReview(0, 0, "failed", { autoLowerOnFailed: true, now });
    expect(plan.nextStatus).toBe(0);
    expect(plan.statusLowered).toBe(false);
  });
});
