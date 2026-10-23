import { describe, expect, it } from "vitest";
import { createAttempt, selectOption } from "./attempt";
import { scoreAttempt, buildAnswerKey, stripAnswerKey } from "./scoring";
import type { ExamQuestion, MarkingScheme } from "../types/exam";

const scheme: MarkingScheme = {
  marksPerCorrect: 1,
  marksPerIncorrect: -0.25,
  marksPerUnattempted: 0,
};

function q(id: string, answer: string | null, extra?: Partial<ExamQuestion>): ExamQuestion {
  return {
    id,
    question: { en: id, hi: id },
    options: [
      { id: "A", en: "A", hi: "A" },
      { id: "B", en: "B", hi: "B" },
      { id: "C", en: "C", hi: "C" },
      { id: "D", en: "D", hi: "D" },
    ],
    correctAnswer: answer,
    verificationStatus: answer ? "verified" : "unresolved",
    subject: extra?.subject ?? "General",
    ...extra,
  };
}

describe("scoreAttempt", () => {
  it("strips all answer-key material from active examination questions", () => {
    const question = q("Q1", "A", {
      correctAnswerText: { en: "Answer" },
      explanation: "Explanation",
      answerSource: "Official key",
      issues: ["Review note"],
    });
    const [sanitized] = stripAnswerKey([question]);
    expect(sanitized).not.toHaveProperty("correctAnswer");
    expect(sanitized).not.toHaveProperty("correctAnswerText");
    expect(sanitized).not.toHaveProperty("explanation");
    expect(sanitized).not.toHaveProperty("answerSource");
    expect(sanitized).not.toHaveProperty("issues");
    expect(sanitized).toHaveProperty("id", "Q1");
  });

  it("applies correct, incorrect, and unanswered marks", () => {
    const questions = [q("Q1", "A"), q("Q2", "B"), q("Q3", "C")];
    const attempt = createAttempt({
      examId: "demo",
      dataVersion: "v1",
      questionIds: questions.map((item) => item.id),
      durationMinutes: 10,
      languageMode: "en",
      autoAdvance: false,
      now: 1_000,
    });
    attempt.states.Q1 = selectOption(attempt.states.Q1, "A");
    attempt.states.Q2 = selectOption(attempt.states.Q2, "A");

    const result = scoreAttempt({
      attempt,
      examTitle: "Demo",
      questions,
      answerKey: buildAnswerKey(questions),
      markingScheme: scheme,
      markingSource: "paper",
      autoSubmitted: false,
      now: 1_000 + 60_000,
    });

    expect(result.breakdown.correct).toBe(1);
    expect(result.breakdown.incorrect).toBe(1);
    expect(result.breakdown.unanswered).toBe(1);
    expect(result.breakdown.score).toBe(0.75);
    expect(result.breakdown.maxMarks).toBe(3);
  });

  it("scores marked-for-review answers normally", () => {
    const questions = [q("Q1", "C")];
    const attempt = createAttempt({
      examId: "demo",
      dataVersion: "v1",
      questionIds: ["Q1"],
      durationMinutes: 10,
      languageMode: "en",
      autoAdvance: false,
    });
    attempt.states.Q1 = { ...selectOption(attempt.states.Q1, "C"), marked: true };
    const result = scoreAttempt({
      attempt,
      examTitle: "Demo",
      questions,
      answerKey: buildAnswerKey(questions),
      markingScheme: scheme,
      markingSource: "paper",
      autoSubmitted: false,
    });
    expect(result.breakdown.correct).toBe(1);
    expect(result.breakdown.correctMarkedForReview).toBe(1);
    expect(result.breakdown.score).toBe(1);
  });

  it("does not treat unresolved keys as incorrect", () => {
    const questions = [q("Q1", null, { verificationStatus: "unreadable", optionsIncomplete: true })];
    const attempt = createAttempt({
      examId: "demo",
      dataVersion: "v1",
      questionIds: ["Q1"],
      durationMinutes: 10,
      languageMode: "en",
      autoAdvance: false,
    });
    attempt.states.Q1 = selectOption(attempt.states.Q1, "A");
    const result = scoreAttempt({
      attempt,
      examTitle: "Demo",
      questions,
      answerKey: buildAnswerKey(questions),
      markingScheme: scheme,
      markingSource: "paper",
      autoSubmitted: false,
    });
    expect(result.breakdown.incorrect).toBe(0);
    expect(result.breakdown.correct).toBe(0);
    expect(result.breakdown.unevaluated).toBe(1);
    expect(result.breakdown.score).toBe(0);
    expect(result.breakdown.maxMarks).toBe(0);
  });

  it("uses the supplied marking scheme instead of a hardcoded one", () => {
    const questions = [q("Q1", "A"), q("Q2", "B")];
    const attempt = createAttempt({
      examId: "demo",
      dataVersion: "v1",
      questionIds: ["Q1", "Q2"],
      durationMinutes: 10,
      languageMode: "en",
      autoAdvance: false,
    });
    attempt.states.Q1 = selectOption(attempt.states.Q1, "A");
    attempt.states.Q2 = selectOption(attempt.states.Q2, "A");
    const result = scoreAttempt({
      attempt,
      examTitle: "Demo",
      questions,
      answerKey: buildAnswerKey(questions),
      markingScheme: { marksPerCorrect: 2, marksPerIncorrect: 0, marksPerUnattempted: 0 },
      markingSource: "paper",
      autoSubmitted: false,
    });
    expect(result.breakdown.score).toBe(2);
    expect(result.breakdown.maxMarks).toBe(4);
  });
});
