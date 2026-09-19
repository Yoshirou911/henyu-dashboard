import type {
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
}
