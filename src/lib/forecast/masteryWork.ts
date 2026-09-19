import { FORECAST_CONFIG, type ForecastConfig } from "@/lib/forecast/config";
import { MASTERY_CONFIG } from "@/lib/mastery/calculateMastery";
import { STATUS_VALUES } from "@/lib/types";

/*
 * Phase 3.1 — a continuous, mastery-based alternative to the status lookup
 * `remainingWorkFactor`. NOT wired into buildForecast yet (see
 * docs/PHASE3_DESIGN.md §7.1): the forecast still uses the status factor.
 *
 * The curve interpolates between the status anchors — mastery base score
 * (0/20/50/75/100) ↔ status work factor (1/0.7/0.35/0.1/0) — so a topic with
 * no corrections gets exactly the current factor, and evidence (accuracy,
 * reviews, decay …) moves it smoothly between the anchors.
 */
export function masteryRemainingWorkFactor(
  mastery: number,
  cfg: Pick<ForecastConfig, "remainingWorkFactor"> = FORECAST_CONFIG,
  base: Record<number, number> = MASTERY_CONFIG.base,
): number {
  if (!Number.isFinite(mastery)) return cfg.remainingWorkFactor[0];
  const anchors = STATUS_VALUES.map((s) => ({
    m: base[s] ?? 0,
    f: cfg.remainingWorkFactor[s],
  })).sort((a, b) => a.m - b.m);
  const first = anchors[0] as { m: number; f: number };
  const last = anchors[anchors.length - 1] as { m: number; f: number };
  if (mastery <= first.m) return first.f;
  if (mastery >= last.m) return last.f;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1] as { m: number; f: number };
    const b = anchors[i] as { m: number; f: number };
    if (mastery <= b.m) {
      const t = b.m === a.m ? 1 : (mastery - a.m) / (b.m - a.m);
      return a.f + (b.f - a.f) * t;
    }
  }
  return last.f;
}

/** remaining minutes by mastery (the comparison counterpart of `topicRemainingMinutes`) */
export function topicRemainingMinutesByMastery(
  estimatedMinutes: number,
  mastery: number,
  cfg: Pick<ForecastConfig, "remainingWorkFactor"> = FORECAST_CONFIG,
): number {
  return Number.isFinite(estimatedMinutes)
    ? Math.max(0, estimatedMinutes * masteryRemainingWorkFactor(mastery, cfg))
    : 0;
}
