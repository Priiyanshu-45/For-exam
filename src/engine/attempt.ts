import type { ActiveAttempt, LanguageMode, QuestionState } from "../types/exam";
import { createQuestionState } from "./questionStatus";
import { createDeadline } from "./timer";

export function createAttempt(input: {
  examId: string;
  dataVersion: string;
  questionIds: string[];
  durationMinutes: number;
  languageMode: LanguageMode;
  autoAdvance: boolean;
  now?: number;
}): ActiveAttempt {
  const startedAt = input.now ?? Date.now();
  const states: Record<string, QuestionState> = {};
  for (const id of input.questionIds) {
    states[id] = createQuestionState();
  }
  if (input.questionIds[0]) {
    states[input.questionIds[0]] = { ...states[input.questionIds[0]], visited: true };
  }
  return {
    attemptId: crypto.randomUUID(),
    examId: input.examId,
    dataVersion: input.dataVersion,
    startedAt,
    deadlineAt: createDeadline(input.durationMinutes, startedAt),
    currentIndex: 0,
    languageMode: input.languageMode,
    autoAdvance: input.autoAdvance,
    states,
    submitted: false,
  };
}

export function selectOption(state: QuestionState, optionId: string): QuestionState {
  return { ...state, selectedOptionId: optionId, visited: true };
}

export function clearOption(state: QuestionState): QuestionState {
  return { ...state, selectedOptionId: null, visited: true };
}

export function toggleMark(state: QuestionState): QuestionState {
  return { ...state, marked: !state.marked, visited: true };
}

export function visitQuestion(state: QuestionState | undefined): QuestionState {
  return { ...(state ?? createQuestionState()), visited: true };
}

export function addTimeSpent(state: QuestionState, deltaMs: number): QuestionState {
  if (deltaMs <= 0) return state;
  return { ...state, timeSpentMs: state.timeSpentMs + deltaMs };
}

export function isAttemptExpired(attempt: ActiveAttempt, now = Date.now()): boolean {
  return now >= attempt.deadlineAt;
}

export function attemptCounts(attempt: ActiveAttempt, questionIds: string[]) {
  let answered = 0;
  let marked = 0;
  let notVisited = 0;
  for (const id of questionIds) {
    const state = attempt.states[id];
    if (!state?.visited) notVisited += 1;
    if (state?.selectedOptionId) answered += 1;
    if (state?.marked) marked += 1;
  }
  return {
    answered,
    unanswered: questionIds.length - answered,
    marked,
    notVisited,
    total: questionIds.length,
  };
}
