import { describe, expect, it } from "vitest";
import { clearOption, createAttempt, selectOption, toggleMark } from "./attempt";
import { getQuestionStatus } from "./questionStatus";
import { remainingMs } from "./timer";
import { parseExamPaper, validateExamPaper } from "./validateExam";

describe("attempt state", () => {
  it("selects, replaces, and clears answers", () => {
    const attempt = createAttempt({
      examId: "e",
      dataVersion: "v",
      questionIds: ["Q1"],
      durationMinutes: 1,
      languageMode: "en",
      autoAdvance: false,
    });
    let state = selectOption(attempt.states.Q1, "B");
    expect(state.selectedOptionId).toBe("B");
    state = selectOption(state, "C");
    expect(state.selectedOptionId).toBe("C");
    state = clearOption(state);
    expect(state.selectedOptionId).toBeNull();
    expect(getQuestionStatus(state)).toBe("visited-unanswered");
  });

  it("tracks answered and marked states independently", () => {
    const attempt = createAttempt({
      examId: "e",
      dataVersion: "v",
      questionIds: ["Q1"],
      durationMinutes: 1,
      languageMode: "en",
      autoAdvance: false,
    });
    let state = toggleMark(attempt.states.Q1);
    expect(getQuestionStatus(state)).toBe("marked");
    state = selectOption(state, "A");
    expect(getQuestionStatus(state)).toBe("answered-marked");
  });

  it("uses an absolute deadline rather than a decrementing counter", () => {
    const attempt = createAttempt({
      examId: "e",
      dataVersion: "v",
      questionIds: ["Q1"],
      durationMinutes: 2,
      languageMode: "en",
      autoAdvance: false,
      now: 10_000,
    });
    expect(attempt.deadlineAt).toBe(10_000 + 2 * 60 * 1000);
    expect(remainingMs(attempt.deadlineAt, 10_000 + 30_000)).toBe(90_000);
  });
});

describe("validation", () => {
  it("rejects duplicate question IDs and invalid answer labels", () => {
    const { paper } = parseExamPaper({
      examId: "bad",
      title: "Bad",
      questions: [
        {
          id: "Q1",
          question: { en: "One", hi: "एक" },
          options: [
            { id: "A", en: "A", hi: "A" },
            { id: "B", en: "B", hi: "B" },
          ],
          correctAnswer: "Z",
        },
        {
          id: "Q1",
          question: { en: "Two", hi: "दो" },
          options: [
            { id: "A", en: "A", hi: "A" },
            { id: "B", en: "B", hi: "B" },
          ],
          correctAnswer: "A",
        },
      ],
    });
    expect(paper).not.toBeNull();
    const result = validateExamPaper(paper!);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "duplicate-id")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "invalid-answer-label")).toBe(true);
  });

  it("warns on missing translations without inventing text", () => {
    const { paper } = parseExamPaper({
      examId: "ok",
      title: "OK",
      questions: [
        {
          id: "Q1",
          question: { en: "Only English", hi: null },
          options: [
            { id: "A", en: "A", hi: null },
            { id: "B", en: "B", hi: null },
          ],
          correctAnswer: "A",
        },
      ],
    });
    const result = validateExamPaper(paper!);
    expect(result.ok).toBe(true);
    expect(result.missingTranslationCount).toBe(1);
  });
});
