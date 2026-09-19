import type {
  ActivityLog,
  Category,
  DailyGoal,
  ExerciseResult,
  Milestone,
  MockExam,
  MonthlyGoal,
  PastExam,
  PastExamProblem,
  Review,
  Settings,
  StudySession,
  Subject,
  Topic,
  University,
  UniversityRequirement,
} from "@/lib/types";

/** Raw persisted facts needed to derive every Phase 2 metric. */
export interface StudySnapshot {
  settings: Settings;
  subjects: Subject[];
  categories: Category[];
  topics: Topic[];
  sessions: StudySession[];
  reviews: Review[];
  exerciseResults: ExerciseResult[];
  universities: University[];
  requirements: UniversityRequirement[];
  monthlyGoals: MonthlyGoal[];
  milestones: Milestone[];
  mockExams: MockExam[];
  pastExams: PastExam[];
  pastExamProblems: PastExamProblem[];
  dailyGoals: DailyGoal[];
  /**
   * `status_change` activity logs — the history of when topics moved.
   * Read only by forecasting (Phase 3.0b); the planner never uses it.
   * Optional so older fixtures / callers stay valid.
   */
  statusLogs?: ActivityLog[];
}
