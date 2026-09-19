import { DAY_MS, startOfDay } from "@/lib/date";
import { FORECAST_CONFIG, type ForecastConfig } from "@/lib/forecast/config";
import {
  collectSpeedSamples,
  createSpeedEstimator,
  median,
  type SpeedSource,
  type TopicRef,
} from "@/lib/forecast/learningSpeed";
import {
  calculateDeadlineRisk,
  calculatePredictionConfidence,
  calculateScheduleMargin,
  estimateCompletionDate,
  estimateCurrentPace,
  estimateRequiredPace,
  topicRemainingMinutes,
  type CompletionEstimate,
  type Confidence,
  type DeadlineRisk,
  type PaceEstimate,
  type RequiredPace,
} from "@/lib/forecast/pace";
import type { StudyModel } from "@/lib/model/buildStudyModel";
import type { ID } from "@/lib/types";

export interface CategoryForecast {
  categoryId: ID;
  name: string;
  remainingMinutes: number;
}

export interface SubjectForecast {
  subjectId: ID;
  subjectName: string;
  topicCount: number;
  /** topics with work left (remaining factor > 0) */
  openTopicCount: number;
  remainingMinutes: number;
  categories: CategoryForecast[];
  speed: {
    /** observed "learned it" topics in this subject */
    samples: number;
    /** median recorded minutes until 基本OK (raw, this subject) */
    medianMinutesToBasic: number | null;
    medianProblemsToBasic: number | null;
    medianDaysToBasic: number | null;
    /** estimated minutes for a fresh topic of this subject (未学習 → done) */
    topicMinutes: number;
    source: SpeedSource;
    /** 0–1 share of the estimate that is observed rather than prior */
    observedWeight: number;
  };
  plannedMinutesPerWeek: number;
  pace: PaceEstimate;
  required: RequiredPace;
  eta: CompletionEstimate;
  /** + days ahead of the completion target / − behind; null without an ETA */
  marginDays: number | null;
  risk: DeadlineRisk;
  confidence: Confidence;
  /** true while the forecast leans on the plan or on very little data */
  provisional: boolean;
}

export interface StudyForecast {
  examDate: string;
  /** exam date − examPrepReserveDays */
  completionTarget: string;
  /** completed days since the first study record (0 = none / today only) */
  daysSinceFirstRecord: number;
  subjects: SubjectForecast[];
  bySubject: Map<ID, SubjectForecast>;
}

/**
 * Per-subject pace forecast, derived read-only from the study model (the
 * same topic scope: non-archived topics of visible subjects). Display only —
 * the planner never reads it.
 */
export function buildForecast(
  model: Pick<
    StudyModel,
    "now" | "snapshot" | "activeSubjects" | "topicMetrics" | "allocation" | "examDate"
  >,
  cfg: ForecastConfig = FORECAST_CONFIG,
): StudyForecast {
  const { now, snapshot } = model;
  const todayStart = startOfDay(now);
  const activeIds = new Set(model.activeSubjects.map((s) => s.id));
  const metrics = [...model.topicMetrics.values()].filter((m) => activeIds.has(m.subject.id));
  const refOf = (m: (typeof metrics)[number]): TopicRef => ({
    topicId: m.topic.id,
    categoryId: m.category.id,
    subjectId: m.subject.id,
    evaluationType: m.evaluationType,
  });

  const samples = collectSpeedSamples(
    {
      topics: metrics.map(refOf),
      sessions: snapshot.sessions,
      exerciseResults: snapshot.exerciseResults,
      statusLogs: snapshot.statusLogs ?? [],
    },
    cfg,
  );
  const estimate = createSpeedEstimator(samples, cfg);

  // history length and recent minutes per subject (completed days only)
  const topicSubject = new Map(metrics.map((m) => [m.topic.id, m.subject.id]));
  const past = snapshot.sessions.filter((s) => s.startedAt < todayStart);
  const firstAt = past.reduce((min, s) => Math.min(min, s.startedAt), Infinity);
  const daysSinceFirstRecord = Number.isFinite(firstAt)
    ? Math.max(0, Math.round((todayStart - startOfDay(firstAt)) / DAY_MS))
    : 0;
  const windowDays = Math.min(cfg.paceWindowDays, daysSinceFirstRecord);
  const windowFrom = todayStart - windowDays * DAY_MS;
  const windowMinutes = new Map<ID, number>();
  for (const s of past) {
    if (s.startedAt < windowFrom) continue;
    const sid = s.subjectId ?? (s.topicId ? topicSubject.get(s.topicId) : undefined);
    if (sid) windowMinutes.set(sid, (windowMinutes.get(sid) ?? 0) + s.durationSec / 60);
  }
  const shareOf = new Map(model.allocation.map((a) => [a.subjectId, a.targetShare]));
  const weeklyGoal = Math.max(0, snapshot.settings.weeklyStudyGoalMin || 0);

  const subjects = model.activeSubjects.map((subject): SubjectForecast => {
    const own = metrics.filter((m) => m.subject.id === subject.id);
    const categories = new Map<ID, CategoryForecast & { order: number }>();
    let remaining = 0;
    let open = 0;
    for (const m of own) {
      const r = topicRemainingMinutes(estimate(refOf(m)).minutes, m.topic.status, cfg);
      remaining += r;
      if (r > 0) open++;
      const c = categories.get(m.category.id) ?? {
        categoryId: m.category.id,
        name: m.category.name,
        remainingMinutes: 0,
        order: m.category.order,
      };
      c.remainingMinutes += r;
      categories.set(m.category.id, c);
    }

    const subjectSamples = samples.filter((s) => s.subjectId === subject.id);
    const fresh = estimate({
      topicId: "",
      categoryId: "",
      subjectId: subject.id,
      evaluationType: subject.evaluationType ?? "problem",
    });
    const plannedMinutesPerWeek = weeklyGoal * (shareOf.get(subject.id) ?? 0);
    const pace = estimateCurrentPace(
      {
        minutesInWindow: windowMinutes.get(subject.id) ?? 0,
        trackedDays: daysSinceFirstRecord,
        plannedMinutesPerWeek,
      },
      cfg,
    );
    const required = estimateRequiredPace(
      { remainingMinutes: remaining, examDate: model.examDate, now },
      cfg,
    );
    const eta = estimateCompletionDate(
      { remainingMinutes: remaining, minutesPerWeek: pace.minutesPerWeek, now },
      cfg,
    );
    const risk = calculateDeadlineRisk(
      { remainingMinutes: remaining, topicCount: own.length, required, pace },
      cfg,
    );
    const confidence =
      own.length > 0 && remaining <= 0
        ? "high"
        : calculatePredictionConfidence(
            {
              subjectSamples: subjectSamples.length,
              daysSinceFirstRecord,
              paceSource: pace.source,
            },
            cfg,
          );

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      topicCount: own.length,
      openTopicCount: open,
      remainingMinutes: remaining,
      categories: [...categories.values()]
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          categoryId: c.categoryId,
          name: c.name,
          remainingMinutes: c.remainingMinutes,
        })),
      speed: {
        samples: subjectSamples.length,
        medianMinutesToBasic: median(subjectSamples.map((s) => s.minutes)),
        medianProblemsToBasic: median(subjectSamples.map((s) => s.problems)),
        medianDaysToBasic: median(subjectSamples.map((s) => s.days)),
        topicMinutes: fresh.minutes,
        source: fresh.source,
        observedWeight: fresh.observedWeight,
      },
      plannedMinutesPerWeek,
      pace,
      required,
      eta,
      marginDays: calculateScheduleMargin(required.completionTarget, eta),
      risk,
      confidence,
      provisional: risk.level !== "done" && (pace.source === "plan" || confidence === "low"),
    };
  });

  return {
    examDate: model.examDate,
    completionTarget: estimateRequiredPace(
      { remainingMinutes: 0, examDate: model.examDate, now },
      cfg,
    ).completionTarget,
    daysSinceFirstRecord,
    subjects,
    bySubject: new Map(subjects.map((s) => [s.subjectId, s])),
  };
}
