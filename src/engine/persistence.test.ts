import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAttempt } from "./attempt";
import {
  clearActiveAttempt,
  listActiveAttempts,
  loadActiveAttempt,
  loadHistory,
  saveActiveAttempt,
  saveHistory,
} from "../data/persistence";
import type { ResultSummary } from "../types/exam";

function installStorage(): void {
  const values = new Map<string, string>();
  const storage = Object.create(null) as Storage;
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => values.get(key) ?? null },
    setItem: {
      value: (key: string, value: string) => {
        values.set(key, String(value));
        Object.defineProperty(storage, key, { configurable: true, enumerable: true, value: String(value) });
      },
    },
    removeItem: {
      value: (key: string) => {
        values.delete(key);
        delete (storage as Storage & Record<string, unknown>)[key];
      },
    },
    clear: { value: () => { values.clear(); } },
    key: { value: (index: number) => [...values.keys()][index] ?? null },
    length: { get: () => values.size },
  });
  vi.stubGlobal("localStorage", storage);
}

function summary(attemptId: string, examId: string): ResultSummary {
  return {
    attemptId,
    examId,
    examTitle: examId,
    submittedAt: 10,
    score: 1,
    maxMarks: 1,
    percentage: 100,
    correct: 1,
    incorrect: 0,
    unanswered: 0,
    autoSubmitted: false,
  };
}

function active(examId: string, startedAt: number) {
  return {
    ...createAttempt({
      examId,
      dataVersion: "v1",
      questionIds: ["Q1"],
      durationMinutes: 20,
      languageMode: "en",
      autoAdvance: false,
      now: startedAt,
    }),
    attemptId: `${examId}-active`,
  };
}

describe("per-exam active attempt persistence", () => {
  beforeEach(installStorage);
  afterEach(() => vi.unstubAllGlobals());

  it("keeps active attempts for multiple exams and lists them independently", () => {
    const first = active("exam-1", 100);
    const second = active("exam-2", 200);
    saveActiveAttempt(first);
    saveActiveAttempt(second);

    expect(loadActiveAttempt("exam-1")?.attemptId).toBe(first.attemptId);
    expect(loadActiveAttempt("exam-2")?.attemptId).toBe(second.attemptId);
    expect(loadActiveAttempt()?.attemptId).toBe(second.attemptId);
    expect(Object.keys(listActiveAttempts()).sort()).toEqual(["exam-1", "exam-2"]);
  });

  it("does not overwrite completed history when a new active attempt is saved", () => {
    const completed = summary("completed-1", "exam-1");
    saveHistory([completed]);
    saveActiveAttempt(active("exam-2", 200));
    expect(loadHistory()).toEqual([completed]);
  });

  it("clears one exam without removing another exam's legacy fallback", () => {
    const first = active("exam-1", 100);
    const second = active("exam-2", 200);
    saveActiveAttempt(first);
    saveActiveAttempt(second);
    clearActiveAttempt("exam-1");
    expect(loadActiveAttempt("exam-1")).toBeNull();
    expect(loadActiveAttempt("exam-2")?.attemptId).toBe(second.attemptId);
  });

  it("reads an unsubmitted attempt from the legacy key when no per-exam record exists", () => {
    const stored = active("legacy-exam", 100);
    localStorage.setItem("up-pet:active-attempt", JSON.stringify(stored));
    expect(loadActiveAttempt("legacy-exam")?.attemptId).toBe(stored.attemptId);
    expect(loadActiveAttempt()?.attemptId).toBe(stored.attemptId);
  });
});
