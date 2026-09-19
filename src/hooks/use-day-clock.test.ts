import { describe, expect, it } from "vitest";
import { nextDayClock } from "@/hooks/use-day-clock";

describe("nextDayClock", () => {
  const evening = new Date("2026-09-19T23:59:00").getTime();
  it("keeps the pinned time within the same day", () => {
    const later = new Date("2026-09-19T23:59:59").getTime();
    expect(nextDayClock(evening, later)).toBe(evening);
  });
  it("rolls over after local midnight", () => {
    const next = new Date("2026-09-20T00:00:30").getTime();
    expect(nextDayClock(evening, next)).toBe(next);
  });
});
