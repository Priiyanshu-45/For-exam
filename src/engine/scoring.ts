import type {
  ActiveAttempt,
  AnswerKeyEntry,
  AttemptResult,
  ExamQuestion,
  MarkingScheme,
  QuestionOutcome,
  QuestionResult,
  ScoreBreakdown,
} from "../types/exam";
import { isEvaluableQuestion } from "./validateExam";

export const SCORING_POLICY =
  "Questions with a verified answer key are scored using the exam marking scheme. Marked-for-review answers are scored if an option is selected. Questions with unresolved, unreadable, or missing keys are excluded from correct/incorrect counts and contribute 0 marks. They still appear in unanswered/attempted statistics. Maximum marks equal evaluable questions × marks per correct answer.";

export function buildAnswerKey(questions: ExamQuestion[]): Record<string, AnswerKeyEntry> {
  const key: Record<string, AnswerKeyEntry> = {};
  for (const question of questions) {
    key[question.id] = {
      questionId: question.id,
      correctAnswer: question.correctAnswer ?? null,
      correctAnswerText: question.correctAnswerText,
      explanation: question.explanation ?? null,
      verificationStatus: (question.verificationStatus ?? "verified").toString(),
      issues: question.issues ?? [],
      evaluable: isEvaluableQuestion(question),
    };
  }
  return key;
}

export function stripAnswerKey(questions: ExamQuestion[]): Array<Omit<ExamQuestion, "correctAnswer" | "correctAnswerText" | "explanation" | "answerSource" | "issues">> {
  return questions.map((question) => ({
    id: question.id,
    originalQuestionNumber: question.originalQuestionNumber,
    subject: question.subject,
    contextId: question.contextId,
    question: question.question,
    options: question.options,
    sourcePage: question.sourcePage,
    verificationStatus: question.verificationStatus,
    optionsIncomplete: question.optionsIncomplete,
  }));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreAttempt(input: {
  attempt: ActiveAttempt;
  examTitle: string;
  questions: Array<{ id: string; subject?: string | null }>;
  answerKey: Record<string, AnswerKeyEntry>;
  markingScheme: MarkingScheme;
  markingSource: string;
  autoSubmitted: boolean;
  now?: number;
}): AttemptResult {
  const submittedAt = input.now ?? Date.now();
  const questionResults: QuestionResult[] = [];

  for (const question of input.questions) {
    const state = input.attempt.states[question.id];
    const key = input.answerKey[question.id];
    const selected = state?.selectedOptionId ?? null;
    const evaluable = Boolean(key?.evaluable && key.correctAnswer);
    let outcome: QuestionOutcome = "unanswered";
    if (!selected) {
      outcome = evaluable ? "unanswered" : "unevaluated";
      if (!evaluable && !selected) outcome = "unevaluated";
    } else if (!evaluable) {
      outcome = "unevaluated";
    } else if (selected === key.correctAnswer) {
      outcome = "correct";
    } else {
      outcome = "incorrect";
    }
    if (!selected && evaluable) outcome = "unanswered";
    if (!selected && !evaluable) outcome = "unevaluated";

    questionResults.push({
      questionId: question.id,
      subject: question.subject?.trim() || "Unspecified",
      selectedOptionId: selected,
      marked: Boolean(state?.marked),
      timeSpentMs: state?.timeSpentMs ?? 0,
      outcome,
      correctAnswer: key?.correctAnswer ?? null,
      evaluable,
    });
  }

  const correct = questionResults.filter((item) => item.outcome === "correct").length;
  const incorrect = questionResults.filter((item) => item.outcome === "incorrect").length;
  const unansweredEvaluable = questionResults.filter((item) => item.outcome === "unanswered").length;
  const unevaluated = questionResults.filter((item) => item.outcome === "unevaluated").length;
  const markedForReview = questionResults.filter((item) => item.marked).length;
  const correctMarkedForReview = questionResults.filter((item) => item.marked && item.outcome === "correct").length;
  const attempted = questionResults.filter((item) => item.selectedOptionId).length;
  const evaluableCount = questionResults.filter((item) => item.evaluable).length;
  const { marksPerCorrect, marksPerIncorrect, marksPerUnattempted } = input.markingScheme;

  const score = roundScore(
    correct * marksPerCorrect +
      incorrect * marksPerIncorrect +
      unansweredEvaluable * marksPerUnattempted,
  );
  const maxMarks = roundScore(evaluableCount * marksPerCorrect);
  const judged = correct + incorrect;
  const accuracy = judged === 0 ? null : roundScore((correct / judged) * 100);
  const percentage = maxMarks === 0 ? null : roundScore((score / maxMarks) * 100);

  const breakdown: ScoreBreakdown = {
    correct,
    incorrect,
    unanswered: unansweredEvaluable + questionResults.filter((item) => !item.selectedOptionId && item.evaluable === false).length,
    unevaluated,
    markedForReview,
    correctMarkedForReview,
    attempted,
    accuracy,
    score,
    maxMarks,
    percentage,
    evaluableCount,
  };

  // Keep unanswered count as all questions without a selected option.
  breakdown.unanswered = questionResults.filter((item) => !item.selectedOptionId).length;

  const subjectMap = new Map<string, QuestionResult[]>();
  for (const result of questionResults) {
    const list = subjectMap.get(result.subject) ?? [];
    list.push(result);
    subjectMap.set(result.subject, list);
  }

  const subjectStats = [...subjectMap.entries()].map(([subject, rows]) => {
    const sCorrect = rows.filter((row) => row.outcome === "correct").length;
    const sIncorrect = rows.filter((row) => row.outcome === "incorrect").length;
    const sUnanswered = rows.filter((row) => !row.selectedOptionId).length;
    const sUnevaluated = rows.filter((row) => row.outcome === "unevaluated").length;
    const sAttempted = rows.filter((row) => row.selectedOptionId).length;
    const sJudged = sCorrect + sIncorrect;
    return {
      subject,
      correct: sCorrect,
      incorrect: sIncorrect,
      unanswered: sUnanswered,
      unevaluated: sUnevaluated,
      attempted: sAttempted,
      accuracy: sJudged === 0 ? null : roundScore((sCorrect / sJudged) * 100),
    };
  });

  const timeUsedMs = Math.max(0, submittedAt - input.attempt.startedAt);
  const timeRemainingMs = Math.max(0, input.attempt.deadlineAt - submittedAt);

  return {
    attemptId: input.attempt.attemptId,
    examId: input.attempt.examId,
    examTitle: input.examTitle,
    dataVersion: input.attempt.dataVersion,
    startedAt: input.attempt.startedAt,
    submittedAt,
    timeUsedMs,
    timeRemainingMs,
    autoSubmitted: input.autoSubmitted,
    languageMode: input.attempt.languageMode,
    markingScheme: input.markingScheme,
    markingSource: input.markingSource,
    scoringPolicy: SCORING_POLICY,
    breakdown,
    questionResults,
    subjectStats,
  };
}
