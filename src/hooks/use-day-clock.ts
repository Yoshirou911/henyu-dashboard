"use client";

import { useEffect, useState } from "react";
import { dayKey } from "@/lib/date";

/** Returns `prev` while it is still the same local day, otherwise the current time. */
export function nextDayClock(prev: number, now: number): number {
  return dayKey(new Date(prev)) === dayKey(new Date(now)) ? prev : now;
}

/**
 * A timestamp that stays fixed within a day (so derived values don't jitter)
 * but rolls over after midnight. An installed PWA can stay open for days;
 * without this the planner would keep showing yesterday's plan and due dates.
 * Checks every minute and whenever the app comes back to the foreground.
 */
export function useDayClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const check = () => setNow((prev) => nextDayClock(prev, Date.now()));
    const id = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return now;
}
