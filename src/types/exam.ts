export type LanguageCode = "en" | "hi";
export type LanguageMode = "en" | "hi" | "bilingual";
export type ExamCategory = "previous-year" | "mock" | "custom";
export type PublicationStatus = "published" | "draft";
export type VerificationStatus =
  | "verified"
  | "unresolved"
  | "unreadable"
  | "disputed"
  | "incomplete";

export type QuestionStatus =
  | "not-visited"
  | "visited-unanswered"
  | "answered"
  | "marked"
  | "answered-marked";

export type BilingualText = {
  en?: string | null;
  hi?: string | null;
};

export type MarkingScheme = {
  marksPerCorrect: number;
  marksPerIncorrect: number;
  marksPerUnattempted: number;
};

export type ExamOption = {
  id: string;
  en?: string | null;
  hi?: string | null;
};

export type ChartSeries = {
  name: BilingualText;
  values: number[];
};

export type ExamTable = {
  rowHeader?: BilingualText;
  columns: BilingualText[];
  rows: Array<{
    label: string | BilingualText;
    values: Array<string | number>;
  }>;
};

export type ExamChart = {
  unit?: string;
  categories: string[];
  series: ChartSeries[];
  note?: string;
};

export type ExamContext = {
  id: string;
  type: "table" | "bar_chart" | "line_chart" | "passage" | string;
  questionRange?: number[];
  sourcePages?: number[];
  directions?: BilingualText;
  title?: BilingualText | null;
  passage?: BilingualText | null;
  table?: ExamTable;
  chart?: ExamChart;
};

export type ExamQuestion = {
  id: string;
  originalQuestionNumber?: string | number;
  subject?: string | null;
  contextId?: string | null;
  question: BilingualText;
  options: ExamOption[];
  correctAnswer?: string | null;
  correctAnswerText?: BilingualText;
  answerSource?: string | null;
  explanation?: string | null;
  sourcePage?: number | null;
  verificationStatus?: VerificationStatus | string | null;
  issues?: string[];
  optionsIncomplete?: boolean;
};

export type SanitizedQuestion = Omit<
  ExamQuestion,
  "correctAnswer" | "correctAnswerText" | "explanation" | "answerSource" | "issues"
>;

export type AnswerKeyEntry = {
  questionId: string;
  correctAnswer: string | null;
  correctAnswerText?: BilingualText;
  explanation?: string | null;
  verificationStatus: string;
  issues: string[];
  evaluable: boolean;
};

export type ExamPaper = {
  schemaVersion?: string;
  examId: string;
  title: string;
  titleHi?: string;
  examDate?: string | null;
  shift?: string | null;
  paperSet?: string | null;
  durationMinutes?: number | null;
  totalQuestions?: number | null;
  markingScheme?: Partial<MarkingScheme> | null;
  metadata?: Record<string, unknown>;
  conductingBody?: BilingualText;
  contexts?: ExamContext[];
  questions: ExamQuestion[];
};

export type RegistryDefaults = {
  durationMinutes: number;
  durationNote: string;
  markingScheme: MarkingScheme;
  markingNote: string;
};

export type RegistryExam = {
  id: string;
  title: string;
  year?: number | null;
  examDate?: string | null;
  shift?: string | null;
  paperSet?: string | null;
  category: ExamCategory | string;
  dataPath: string;
  status: PublicationStatus | string;
  durationMinutes?: number | null;
  markingScheme?: Partial<MarkingScheme> | null;
  source?: "bundled" | "imported";
};

export type ExamRegistry = {
  schemaVersion: string;
  defaults: RegistryDefaults;
  exams: RegistryExam[];
};

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  questionId?: string;
};

export type ExamValidation = {
  ok: boolean;
  examId: string;
  title: string;
  questionCount: number;
  optionCounts: Record<string, number>;
  unresolvedQuestionIds: string[];
  missingTranslationCount: number;
  issues: ValidationIssue[];
};

export type ResolvedExam = {
  registry: RegistryExam;
  paper: ExamPaper;
  questions: SanitizedQuestion[];
  contexts: ExamContext[];
  durationMinutes: number;
  durationSource: "paper" | "registry" | "defaults";
  markingScheme: MarkingScheme;
  markingSource: "paper" | "registry" | "defaults";
  durationNote?: string;
  markingNote?: string;
  validation: ExamValidation;
  dataVersion: string;
  answerKey: Record<string, AnswerKeyEntry>;
  source: "bundled" | "imported";
};

export type QuestionState = {
  visited: boolean;
  marked: boolean;
  selectedOptionId: string | null;
  timeSpentMs: number;
};

export type ActiveAttempt = {
  attemptId: string;
  examId: string;
  dataVersion: string;
  startedAt: number;
  deadlineAt: number;
  currentIndex: number;
  languageMode: LanguageMode;
  autoAdvance: boolean;
  states: Record<string, QuestionState>;
  submitted: boolean;
  submittedAt?: number;
};

export type QuestionOutcome =
  | "correct"
  | "incorrect"
  | "unanswered"
  | "unevaluated";

export type QuestionResult = {
  questionId: string;
  subject: string;
  selectedOptionId: string | null;
  marked: boolean;
  timeSpentMs: number;
  outcome: QuestionOutcome;
  correctAnswer: string | null;
  evaluable: boolean;
};

export type ScoreBreakdown = {
  correct: number;
  incorrect: number;
  unanswered: number;
  unevaluated: number;
  markedForReview: number;
  correctMarkedForReview: number;
  attempted: number;
  accuracy: number | null;
  score: number;
  maxMarks: number;
  percentage: number | null;
  evaluableCount: number;
};

export type AttemptResult = {
  attemptId: string;
  examId: string;
  examTitle: string;
  dataVersion: string;
  startedAt: number;
  submittedAt: number;
  timeUsedMs: number;
  timeRemainingMs: number;
  autoSubmitted: boolean;
  languageMode: LanguageMode;
  markingScheme: MarkingScheme;
  markingSource: string;
  scoringPolicy: string;
  breakdown: ScoreBreakdown;
  questionResults: QuestionResult[];
  subjectStats: Array<{
    subject: string;
    correct: number;
    incorrect: number;
    unanswered: number;
    unevaluated: number;
    attempted: number;
    accuracy: number | null;
  }>;
};

export type ResultSummary = {
  attemptId: string;
  examId: string;
  examTitle: string;
  submittedAt: number;
  score: number;
  maxMarks: number;
  percentage: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  autoSubmitted: boolean;
};

export type UserPreferences = {
  languageMode: LanguageMode;
  theme: "dark" | "light";
  autoAdvance: boolean;
};

export type LibraryExam = RegistryExam & {
  questionCount?: number;
  durationMinutes?: number | null;
  markingScheme?: Partial<MarkingScheme> | null;
  validationOk?: boolean;
  validationIssues?: ValidationIssue[];
  source: "bundled" | "imported";
};
