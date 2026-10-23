import { describe, expect, it } from "vitest";
import { clearOption, createAttempt, isAttemptExpired, selectOption, toggleMark } from "./attempt";
import { createQuestionState, getQuestionStatus } from "./questionStatus";
import { formatDuration, remainingMs, timerUrgency } from "./timer";
import { parseExamPaper, resolveDuration, resolveMarkingScheme, validateExamPaper, validateRegistry } from "./validateExam";
import type { ExamPaper, RegistryDefaults, RegistryExam } from "../types/exam";

const defaults: RegistryDefaults = {
  durationMinutes: 120,
  durationNote: "default duration",
  markingScheme: { marksPerCorrect: 1, marksPerIncorrect: -0.25, marksPerUnattempted: 0 },
  markingNote: "default marking",
};

function paper(fields: Partial<ExamPaper> = {}): ExamPaper {
  return {
    examId: "demo",
    title: "Demo",
    questions: [],
    ...fields,
  };
}

function registry(fields: Partial<RegistryExam> = {}): RegistryExam {
  return {
    id: "demo",
    title: "Demo",
    category: "mock",
    dataPath: "/demo.json",
    status: "published",
    ...fields,
  };
}

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

  it("represents all five question statuses", () => {
    const attempt = createAttempt({
      examId: "e", dataVersion: "v", questionIds: ["Q1", "Q2", "Q3", "Q4", "Q5"],
      durationMinutes: 1, languageMode: "en", autoAdvance: false,
    });
    const states = attempt.states;
    states.Q1 = createQuestionState();
    states.Q2 = { ...states.Q2, visited: true };
    states.Q3 = selectOption(states.Q3, "A");
    states.Q4 = toggleMark({ ...states.Q4, visited: true });
    states.Q5 = { ...selectOption(states.Q5, "A"), marked: true };
    expect(Object.values(states).map(getQuestionStatus)).toEqual([
      "not-visited", "visited-unanswered", "answered", "marked", "answered-marked",
    ]);
    expect(getQuestionStatus(undefined)).toBe("not-visited");
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
    expect(isAttemptExpired(attempt, attempt.deadlineAt - 1)).toBe(false);
    expect(isAttemptExpired(attempt, attempt.deadlineAt)).toBe(true);
  });

  it("formats duration and identifies timer urgency thresholds", () => {
    expect(formatDuration(59)).toBe("00:59");
    expect(formatDuration(3_661)).toBe("01:01:01");
    expect(timerUrgency(5 * 60_000 + 1)).toBe("normal");
    expect(timerUrgency(5 * 60_000)).toBe("warn");
    expect(timerUrgency(60_000)).toBe("final");
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

  it("validates registry entries, rejects duplicate IDs and missing fields, and filters drafts", () => {
    const result = validateRegistry({
      defaults,
      exams: [
        { id: "published", title: "Published", dataPath: "/published.json", category: "mock", status: "published" },
        { id: "draft", title: "Draft", dataPath: "/draft.json", category: "mock", status: "draft" },
        { id: "published", title: "Duplicate", dataPath: "/duplicate.json", category: "mock", status: "published" },
        { title: "Missing ID", dataPath: "/missing.json" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("registry-duplicate-id");
    expect(result.issues.map((issue) => issue.code)).toContain("registry-entry-missing");
    expect(result.exams.filter((exam) => exam.status !== "draft").map((exam) => exam.id)).toEqual(["published"]);
  });

  it("resolves duration and marking precedence as paper, registry, then defaults", () => {
    const paperScheme = { marksPerCorrect: 2, marksPerIncorrect: -1, marksPerUnattempted: 0 };
    const registryScheme = { marksPerCorrect: 3, marksPerIncorrect: -2, marksPerUnattempted: 0 };
    const paperValues = paper({ durationMinutes: 60, markingScheme: paperScheme });
    const registryValues = registry({ durationMinutes: 90, markingScheme: registryScheme });
    expect(resolveDuration(paperValues, registryValues, defaults)).toEqual({ minutes: 60, source: "paper" });
    expect(resolveMarkingScheme(paperValues, registryValues, defaults)).toEqual({ scheme: paperScheme, source: "paper" });
    expect(resolveDuration(paper(), registryValues, defaults)).toEqual({ minutes: 90, source: "registry" });
    expect(resolveMarkingScheme(paper(), registryValues, defaults)).toEqual({ scheme: registryScheme, source: "registry" });
    expect(resolveDuration(paper(), registry(), defaults)).toEqual({ minutes: 120, source: "defaults", note: "default duration" });
    expect(resolveMarkingScheme(paper(), registry(), defaults)).toEqual({ scheme: defaults.markingScheme, source: "defaults", note: "default marking" });
  });
});
