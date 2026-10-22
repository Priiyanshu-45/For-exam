import type { QuestionState, QuestionStatus } from "../types/exam";

export function createQuestionState(): QuestionState {
  return {
    visited: false,
    marked: false,
    selectedOptionId: null,
    timeSpentMs: 0,
  };
}

export function getQuestionStatus(state: QuestionState | undefined): QuestionStatus {
  if (!state || !state.visited) return "not-visited";
  const answered = Boolean(state.selectedOptionId);
  if (state.marked && answered) return "answered-marked";
  if (state.marked) return "marked";
  if (answered) return "answered";
  return "visited-unanswered";
}

export function isAnswered(state: QuestionState | undefined): boolean {
  return Boolean(state?.selectedOptionId);
}

export function statusLabel(status: QuestionStatus): string {
  switch (status) {
    case "not-visited":
      return "Not visited";
    case "visited-unanswered":
      return "Visited, unanswered";
    case "answered":
      return "Answered";
    case "marked":
      return "Marked for review";
    case "answered-marked":
      return "Answered and marked";
  }
}
