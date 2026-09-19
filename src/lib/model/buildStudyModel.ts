import { studyStreakDays } from "@/lib/analytics";
import { DEFAULT_AVAILABLE_MINUTES, PRIORITY_META } from "@/lib/constants";
import { DAY_MS, dayKey, daysUntil, monthKey, startOfDay } from "@/lib/date";
import { DEFAULT_ALLOCATION_BY_SLUG } from "@/lib/db/seed";
import { monthlySummary, type MonthlySummary } from "@/lib/goals/monthlyProgress";
import { computeTopicAccuracy, type TopicAccuracy } from "@/lib/mastery/accuracy";
import { calculateMastery, type MasteryResult } from "@/lib/mastery/calculateMastery";
import {
  calculateReadyForNext,
  computeReviewRate,
  type ReadyResult,
} from "@/lib/mastery/readyForNext";
import type { StudySnapshot } from "@/lib/model/snapshot";
import { buildTodayPlan, type PlanCandidate, type TodayPlan } from "@/lib/planner/buildTodayPlan";
import { calculatePriority } from "@/lib/planner/calculatePriority";
import { computeAllocationStatus, type AllocationStatus } from "@/lib/planner/subjectAllocation";
import { weightedPercent } from "@/lib/progress";
import {
  subjectScore,
  universityReadiness,
  type ReadinessResult,
} from "@/lib/readiness/universityReadiness";
import {
  compareReviewPriority,
  dueLabel,
  reviewAmount,
  VOCAB_PATTERN,
} from "@/lib/review/prioritizeReviews";
import type {
  Category,
  EvaluationType,
  ExerciseResult,
  ID,
  Milestone,
  Review,
  Settings,
  StudySession,
  Subject,
  Topic,
  University,
  UniversityRequirement,
} from "@/lib/types";
import {
  WEAKNESS_CONFIG,
  calculateWeakness,
  isImproving,
  type WeaknessResult,
} from "@/lib/weakness/calculateWeakness";

export interface TopicMetrics {
  topic: Topic;
  category: Category;
  subject: Subject;
  evaluationType: EvaluationType;
  isVocab: boolean;
  accuracy: TopicAccuracy;
  mastery: MasteryResult;
  ready: ReadyResult;
  reviewRate: number | null;
  weakness: WeaknessResult;
  improving: boolean;
  studyMinutes: number;
  studyMinutes7d: number;
  minutesLast2Days: number;
  daysSinceStudied: number | null;
  openReview?: Review;
  /** days past due for the open review (0 = today); null when not due yet / none */
  overdueDays: number | null;
  reviewCounts: { got: number; shaky: number; failed: number };
  unmetDeps: Topic[];
  /** prerequisite categories (roadmap order) not yet at 基本OK — only blocks untouched topics */
  lockedBy: Category[];
  depsMet: boolean;
  /** not-yet-定着 topics that depend on this one */
  dependents: Topic[];
  nextTopic?: Topic;
  isFrontier: boolean;
  frontierIndex: number | null;
  isMonthlyTarget: boolean;
  firstChoiceImportance: number;
  pastExam: { correct: number; partial: number; wrong: number };
  mockWeakCount: number;
  results: ExerciseResult[];
}

export interface CategorySummary {
  category: Category;
  score: number;
  statusPercent: number;
  topicCount: number;
  doneCount: number;
}

export interface SubjectSummary {
  subject: Subject;
  evaluationType: EvaluationType;
  /** mastery-based 0–100 — what readiness uses */
  score: number;
  /** Phase 1 status-based progress */
  statusPercent: number;
  categories: CategorySummary[];
  topicCount: number;
  doneCount: number;
  weekMinutes: number;
  weakCount: number;
  dueReviewCount: number;
  focus?: TopicMetrics;
}

export interface UniversitySummary {
  university: University;
  requirements: UniversityRequirement[];
  readiness: ReadinessResult;
}

export interface ReviewQueueItem {
  review: Review;
  metrics: TopicMetrics;
  overdueDays: number;
  amount: string;
  dueLabel: string;
}

export interface StudyModel {
  now: number;
  today: string;
  snapshot: StudySnapshot;
  settings: Settings;
  /** non-archived subjects in order */
  subjects: Subject[];
  /** non-archived, non-hidden subjects (planner / dashboards) */
  activeSubjects: Subject[];
  subjectById: Map<ID, Subject>;
  categoryById: Map<ID, Category>;
  topicMetrics: Map<ID, TopicMetrics>;
  subjectSummaries: SubjectSummary[];
  subjectScores: Map<ID, number>;
  universities: UniversitySummary[];
  primaryUniversity?: UniversitySummary;
  examDate: string;
  daysToExam: number;
  reviewQueue: ReviewQueueItem[];
  overdueCount: number;
  upcomingReviews: ReviewQueueItem[];
  weakList: TopicMetrics[];
  improvingList: TopicMetrics[];
  allocation: AllocationStatus[];
  candidates: PlanCandidate[];
  availableMinutesToday: number;
  buildPlan: (availableMinutes: number) => TodayPlan;
  monthly: MonthlySummary;
  nextMilestone?: Milestone;
  weekMinutes: number;
  todayMinutes: number;
  streak: number;
  /** the topic the user is (or should be) working on — for the 次へ進む条件 card */
  focus?: TopicMetrics;
}

/** unfinished topics per category that count as "次の単元" */
const FRONTIER_WINDOW = 2;

const minutesOf = (sessions: readonly StudySession[]) =>
  sessions.reduce((s, x) => s + x.durationSec, 0) / 60;

function groupBy<T, K>(items: readonly T[], key: (t: T) => K | undefined | null): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === undefined || k === null) continue;
    const arr = out.get(k);
    if (arr) arr.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function buildStudyModel(snapshot: StudySnapshot, nowMs: number = Date.now()): StudyModel {
  const now = nowMs;
  const todayStart = startOfDay(now);
  const today = dayKey(new Date(now));
  const { settings } = snapshot;

  const subjects = snapshot.subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const activeSubjects = subjects.filter((s) => !s.hidden);
  const subjectById = new Map(snapshot.subjects.map((s) => [s.id, s]));
  const categoryById = new Map(snapshot.categories.map((c) => [c.id, c]));
  const liveSubjectIds = new Set(subjects.map((s) => s.id));

  const categoriesBySubject = groupBy(snapshot.categories, (c) => c.subjectId);
  for (const arr of categoriesBySubject.values()) arr.sort((a, b) => a.order - b.order);

  const topics = snapshot.topics.filter((t) => {
    if (t.archived) return false;
    const c = categoryById.get(t.categoryId);
    return Boolean(c && liveSubjectIds.has(c.subjectId));
  });
  const topicById = new Map(snapshot.topics.map((t) => [t.id, t]));
  const topicsByCategory = groupBy(topics, (t) => t.categoryId);
  for (const arr of topicsByCategory.values()) arr.sort((a, b) => a.order - b.order);
  const subjectOfTopic = (topicId: ID | null | undefined): ID | null => {
    if (!topicId) return null;
    const t = topicById.get(topicId);
    return t ? (categoryById.get(t.categoryId)?.subjectId ?? null) : null;
  };

  /* ---------------- universities & 第一志望 ---------------- */
  const reqByUniv = groupBy(snapshot.requirements, (r) => r.universityId);
  const universitiesRaw = snapshot.universities
    .filter((u) => !u.archived)
    .sort(
      (a, b) =>
        PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank || a.order - b.order,
    );
  const primaryRaw =
    universitiesRaw.find((u) => u.id === settings.primaryUniversityId) ??
    universitiesRaw.find((u) => u.priority === "first_choice");
  const firstChoiceImportance = new Map<ID, number>();
  for (const r of primaryRaw ? (reqByUniv.get(primaryRaw.id) ?? []) : []) {
    if (r.weight > 0) firstChoiceImportance.set(r.subjectId, r.importance);
  }
  const examDate = primaryRaw?.examDate || settings.examDate;
  const daysToExam = daysUntil(examDate, new Date(now));

  /* ---------------- per-topic raw groupings ---------------- */
  const resultsByTopic = groupBy(snapshot.exerciseResults, (r) => r.topicId);
  const reviewsByTopic = groupBy(snapshot.reviews, (r) => r.topicId);
  const sessionsByTopic = groupBy(snapshot.sessions, (s) => s.topicId);
  const problemsByTopic = groupBy(snapshot.pastExamProblems, (p) => p.topicId);
  const mockWeak = new Map<ID, number>();
  for (const m of snapshot.mockExams) {
    for (const id of m.weakTopicIds ?? []) mockWeak.set(id, (mockWeak.get(id) ?? 0) + 1);
  }
  const dependentsOf = new Map<ID, Topic[]>();
  for (const t of topics) {
    for (const d of t.dependsOn ?? []) {
      if (t.status >= 3) continue;
      const arr = dependentsOf.get(d) ?? [];
      arr.push(t);
      dependentsOf.set(d, arr);
    }
  }

  // current month goals → topics on the path to a target are "今月の目標"
  const month = monthKey(now);
  const monthlyTargets = new Set<ID>();
  for (const g of snapshot.monthlyGoals.filter((g) => g.month === month)) {
    if (!g.targetTopicId) continue;
    const target = topicById.get(g.targetTopicId);
    if (!target) continue;
    const goalStatus = g.targetStatus ?? 2;
    for (const t of topicsByCategory.get(target.categoryId) ?? []) {
      if (t.order <= target.order && t.status < goalStatus) monthlyTargets.add(t.id);
    }
  }

  // a category is locked while any prerequisite category still has topics below 基本OK
  const lockedByOf = new Map<ID, Category[]>();
  for (const c of snapshot.categories) {
    const blockers = (c.prerequisiteIds ?? [])
      .map((id) => categoryById.get(id))
      .filter((p): p is Category => Boolean(p))
      .filter((p) => (topicsByCategory.get(p.id) ?? []).some((t) => t.status < 2));
    if (blockers.length > 0) lockedByOf.set(c.id, blockers);
  }

  // frontier = the next unfinished topics of each category
  const frontier = new Map<ID, number>();
  const nextTopicOf = new Map<ID, Topic>();
  for (const [subjectId, cats] of categoriesBySubject) {
    if (!liveSubjectIds.has(subjectId)) continue;
    const ordered = cats.flatMap((c) => topicsByCategory.get(c.id) ?? []);
    ordered.forEach((t, i) => {
      const next = ordered[i + 1];
      if (next) nextTopicOf.set(t.id, next);
    });
    for (const c of cats) {
      // the next few unfinished topics in roadmap order are "up next"
      (topicsByCategory.get(c.id) ?? [])
        .filter((t) => t.status < 3)
        .slice(0, FRONTIER_WINDOW)
        .forEach((t, i) => frontier.set(t.id, i));
    }
  }

  /* ---------------- topic metrics ---------------- */
  const weekFrom = todayStart - 6 * DAY_MS;
  const twoDayFrom = todayStart - DAY_MS;
  const topicMetrics = new Map<ID, TopicMetrics>();
  for (const topic of topics) {
    const category = categoryById.get(topic.categoryId) as Category;
    const subject = subjectById.get(category.subjectId) as Subject;
    const evaluationType: EvaluationType = subject.evaluationType ?? "problem";
    const results = (resultsByTopic.get(topic.id) ?? []).slice().sort((a, b) => a.at - b.at);
    const accuracy = computeTopicAccuracy(results, { now });
    const reviews = reviewsByTopic.get(topic.id) ?? [];
    const reviewCounts = { got: 0, shaky: 0, failed: 0 };
    for (const r of reviews) if (r.completedAt && r.outcome) reviewCounts[r.outcome]++;
    const openReview = reviews.find((r) => !r.completedAt);
    const overdueDays =
      openReview && openReview.dueAt <= todayStart
        ? Math.round((todayStart - startOfDay(openReview.dueAt)) / DAY_MS)
        : null;
    const sessions = sessionsByTopic.get(topic.id) ?? [];
    const lastTouch = Math.max(topic.lastStudiedAt ?? 0, accuracy.lastAt ?? 0);
    const daysSinceStudied =
      lastTouch > 0 ? Math.floor((todayStart - startOfDay(lastTouch)) / DAY_MS) : null;
    const problems = problemsByTopic.get(topic.id) ?? [];
    const pastExam = {
      correct: problems.filter((p) => p.result === "correct").length,
      partial: problems.filter((p) => p.result === "partial").length,
      wrong: problems.filter((p) => p.result === "wrong").length,
    };
    const studyMinutes7d = minutesOf(sessions.filter((s) => s.startedAt >= weekFrom));

    const mastery = calculateMastery({
      status: topic.status,
      evaluationType,
      accuracy,
      reviewOutcomes: reviewCounts,
      daysSinceStudied,
      pastExam,
      mockWeakCount: mockWeak.get(topic.id) ?? 0,
      studyMinutes7d,
    });

    const reviewRate = computeReviewRate(results, reviews, topic.basicOkAt).rate;
    const ready = calculateReadyForNext({
      evaluationType,
      status: topic.status,
      recentBasic: accuracy.recentBasic,
      reviewRate,
      override: topic.readyOverride,
    });

    const unmetDeps = (topic.dependsOn ?? [])
      .map((id) => topicById.get(id))
      .filter((d): d is Topic => Boolean(d) && !d?.archived && (d?.status ?? 0) < 2);

    // deliberate work already underway is never blocked by roadmap order
    const lockedBy = topic.status === 0 ? (lockedByOf.get(topic.categoryId) ?? []) : [];

    const started = topic.status >= 1 || results.length > 0;
    const importance = firstChoiceImportance.get(subject.id) ?? 0;
    const weakness = started
      ? calculateWeakness({
          status: topic.status,
          mastery: mastery.score,
          recent: accuracy.recent,
          failedReviews: reviewCounts.failed,
          shakyReviews: reviewCounts.shaky,
          studyMinutesTotal: minutesOf(sessions),
          daysSinceStatusUp:
            topic.status >= 1
              ? Math.floor((now - (topic.lastStatusUpAt ?? topic.createdAt)) / DAY_MS)
              : null,
          pastExam,
          mockWeakCount: mockWeak.get(topic.id) ?? 0,
          overdueDays,
          firstChoiceImportance: importance,
        })
      : { score: 0, reasons: [] };

    topicMetrics.set(topic.id, {
      topic,
      category,
      subject,
      evaluationType,
      isVocab: VOCAB_PATTERN.test(`${category.name} ${topic.name}`),
      accuracy,
      mastery,
      ready,
      reviewRate,
      weakness,
      improving: isImproving(accuracy.recent, accuracy.earlier),
      studyMinutes: minutesOf(sessions),
      studyMinutes7d,
      minutesLast2Days: minutesOf(sessions.filter((s) => s.startedAt >= twoDayFrom)),
      daysSinceStudied,
      openReview,
      overdueDays,
      reviewCounts,
      unmetDeps,
      lockedBy,
      depsMet: unmetDeps.length === 0 && lockedBy.length === 0,
      dependents: dependentsOf.get(topic.id) ?? [],
      nextTopic: nextTopicOf.get(topic.id),
      isFrontier: frontier.has(topic.id),
      frontierIndex: frontier.get(topic.id) ?? null,
      isMonthlyTarget: monthlyTargets.has(topic.id),
      firstChoiceImportance: importance,
      pastExam,
      mockWeakCount: mockWeak.get(topic.id) ?? 0,
      results,
    });
  }
  const masteryById = new Map([...topicMetrics].map(([id, m]) => [id, m.mastery.score]));

  /* ---------------- allocation ---------------- */
  const allocationMap: Record<ID, number> = {};
  for (const s of activeSubjects) {
    allocationMap[s.id] =
      settings.subjectAllocation?.[s.id] ?? DEFAULT_ALLOCATION_BY_SLUG[s.slug] ?? 0;
  }
  const allocation = computeAllocationStatus({
    allocation: allocationMap,
    subjectIds: activeSubjects.map((s) => s.id),
    sessions: snapshot.sessions,
    subjectOfSession: (s) => s.subjectId ?? subjectOfTopic(s.topicId),
    weeklyGoalMinutes: settings.weeklyStudyGoalMin,
    now,
  });

  /* ---------------- candidates + priority ---------------- */
  const activeIds = new Set(activeSubjects.map((s) => s.id));
  const candidates: PlanCandidate[] = [];
  const priorityOf = new Map<ID, number>();
  for (const m of topicMetrics.values()) {
    if (!activeIds.has(m.subject.id)) continue;
    const base = {
      status: m.topic.status,
      mastery: m.mastery.score,
      weakness: m.weakness.score,
      recentRate: m.accuracy.recent.rate,
      recentAttempted: m.accuracy.recent.attempted,
      firstChoiceImportance: m.firstChoiceImportance,
      isMonthlyTarget: m.isMonthlyTarget,
      isInProgress: m.topic.status === 1 || m.topic.status === 2,
      isFrontier: m.isFrontier,
      frontierIndex: m.frontierIndex ?? undefined,
      blocksCount: m.dependents.length,
      depsMet: m.depsMet,
      daysSinceStudied: m.daysSinceStudied,
      daysToExam,
      minutesLast2Days: m.minutesLast2Days,
    };
    const shared = {
      topicId: m.topic.id,
      subjectId: m.subject.id,
      topicName: m.topic.name,
      subjectName: m.subject.name,
      categoryName: m.category.name,
      evaluationType: m.evaluationType,
      status: m.topic.status,
      isVocab: m.isVocab,
      depsMet: m.depsMet,
    };
    if (m.openReview && m.overdueDays !== null) {
      const p = calculatePriority({ ...base, kind: "review", overdueDays: m.overdueDays });
      candidates.push({
        ...shared,
        kind: "review",
        reviewId: m.openReview.id,
        overdueDays: m.overdueDays,
        priority: p.score,
        reasons: p.reasons,
      });
    }
    const learnable =
      (m.topic.status < 3 && (m.topic.status >= 1 || m.isFrontier)) ||
      (m.topic.status >= 3 && m.weakness.score >= 30);
    if (learnable) {
      const p = calculatePriority({ ...base, kind: "learn", overdueDays: null });
      candidates.push({ ...shared, kind: "learn", priority: p.score, reasons: p.reasons });
      priorityOf.set(m.topic.id, p.score);
    }
  }

  const availableMinutesToday =
    snapshot.dailyGoals.find((g) => g.date === today)?.availableMinutes ??
    settings.defaultAvailableMinutes ??
    DEFAULT_AVAILABLE_MINUTES;

  /* ---------------- review queue ---------------- */
  const queueItems: ReviewQueueItem[] = [];
  const upcoming: ReviewQueueItem[] = [];
  for (const m of topicMetrics.values()) {
    if (!m.openReview) continue;
    const overdue = Math.round((todayStart - startOfDay(m.openReview.dueAt)) / DAY_MS);
    const item: ReviewQueueItem = {
      review: m.openReview,
      metrics: m,
      overdueDays: Math.max(0, overdue),
      amount: reviewAmount({
        evaluationType: m.evaluationType,
        isVocab: m.isVocab,
        overdueDays: Math.max(0, overdue),
      }),
      dueLabel: overdue >= 0 ? dueLabel(overdue) : `${-overdue}日後`,
    };
    if (overdue >= 0) queueItems.push(item);
    else upcoming.push(item);
  }
  const keyOf = (i: ReviewQueueItem) => ({
    overdueDays: i.overdueDays,
    mastery: i.metrics.mastery.score,
    failedCount: i.metrics.reviewCounts.failed,
    firstChoiceImportance: i.metrics.firstChoiceImportance,
    blocksCount: i.metrics.dependents.length,
  });
  queueItems.sort((a, b) => compareReviewPriority(keyOf(a), keyOf(b)));
  upcoming.sort((a, b) => a.review.dueAt - b.review.dueAt);

  /* ---------------- weakness lists ---------------- */
  const all = [...topicMetrics.values()].filter((m) => activeIds.has(m.subject.id));
  const weakList = all
    .filter((m) => m.weakness.score >= WEAKNESS_CONFIG.listThreshold)
    .sort((a, b) => b.weakness.score - a.weakness.score);
  const improvingList = all
    .filter((m) => m.improving)
    .sort(
      (a, b) =>
        (b.accuracy.recent.rate ?? 0) -
        (b.accuracy.earlier.rate ?? 0) -
        ((a.accuracy.recent.rate ?? 0) - (a.accuracy.earlier.rate ?? 0)),
    );

  /* ---------------- subjects ---------------- */
  const sessionSubject = (s: StudySession) => s.subjectId ?? subjectOfTopic(s.topicId);
  const weekMinutesBySubject = new Map<ID, number>();
  for (const s of snapshot.sessions) {
    if (s.startedAt < weekFrom) continue;
    const sid = sessionSubject(s);
    if (sid)
      weekMinutesBySubject.set(sid, (weekMinutesBySubject.get(sid) ?? 0) + s.durationSec / 60);
  }

  const subjectScores = new Map<ID, number>();
  const subjectSummaries: SubjectSummary[] = subjects.map((subject) => {
    const cats = (categoriesBySubject.get(subject.id) ?? []).slice();
    const subjectTopics = cats.flatMap((c) => topicsByCategory.get(c.id) ?? []);
    const score = subjectScore(subjectTopics, masteryById);
    subjectScores.set(subject.id, score);
    const metrics = subjectTopics
      .map((t) => topicMetrics.get(t.id))
      .filter((m): m is TopicMetrics => Boolean(m));
    const focus =
      metrics
        .filter((m) => m.topic.status >= 1 && m.topic.status < 3)
        .sort((a, b) => (priorityOf.get(b.topic.id) ?? 0) - (priorityOf.get(a.topic.id) ?? 0))[0] ??
      metrics.find((m) => m.isFrontier && m.depsMet) ??
      metrics.find((m) => m.isFrontier);
    return {
      subject,
      evaluationType: subject.evaluationType ?? "problem",
      score,
      statusPercent: weightedPercent(subjectTopics),
      categories: cats.map((category) => {
        const ts = topicsByCategory.get(category.id) ?? [];
        return {
          category,
          score: subjectScore(ts, masteryById),
          statusPercent: weightedPercent(ts),
          topicCount: ts.length,
          doneCount: ts.filter((t) => t.status >= 3).length,
        };
      }),
      topicCount: subjectTopics.length,
      doneCount: subjectTopics.filter((t) => t.status >= 3).length,
      weekMinutes: Math.round(weekMinutesBySubject.get(subject.id) ?? 0),
      weakCount: weakList.filter((m) => m.subject.id === subject.id).length,
      dueReviewCount: queueItems.filter((i) => i.metrics.subject.id === subject.id).length,
      focus,
    };
  });

  const universities: UniversitySummary[] = universitiesRaw.map((university) => {
    const requirements = reqByUniv.get(university.id) ?? [];
    return {
      university,
      requirements,
      readiness: universityReadiness(requirements, subjectScores),
    };
  });
  const primaryUniversity = universities.find((u) => u.university.id === primaryRaw?.id);

  /* ---------------- time stats / goals ---------------- */
  const weekMinutes = Math.round(
    minutesOf(snapshot.sessions.filter((s) => s.startedAt >= weekFrom)),
  );
  const todayMinutes = Math.round(
    minutesOf(snapshot.sessions.filter((s) => s.startedAt >= todayStart)),
  );
  const statusOf = (id: ID) => topicById.get(id)?.status;
  const nextMilestone = snapshot.milestones
    .filter((m) => !m.done && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const primarySubject = subjectSummaries.find((s) => s.subject.id === settings.primarySubjectId);
  const focus =
    primarySubject?.focus ??
    subjectSummaries.find((s) => activeIds.has(s.subject.id) && s.focus)?.focus;

  return {
    now,
    today,
    snapshot,
    settings,
    subjects,
    activeSubjects,
    subjectById,
    categoryById,
    topicMetrics,
    subjectSummaries,
    subjectScores,
    universities,
    primaryUniversity,
    examDate,
    daysToExam,
    reviewQueue: queueItems,
    overdueCount: queueItems.filter((i) => i.overdueDays > 0).length,
    upcomingReviews: upcoming,
    weakList,
    improvingList,
    allocation,
    candidates,
    availableMinutesToday,
    buildPlan: (minutes: number) =>
      buildTodayPlan({
        availableMinutes: minutes,
        candidates,
        allocation,
        doneMinutes: todayMinutes,
      }),
    monthly: monthlySummary(month, snapshot.monthlyGoals, statusOf, new Date(now)),
    nextMilestone,
    weekMinutes,
    todayMinutes,
    streak: studyStreakDays(snapshot.sessions, new Date(now)),
    focus,
  };
}
