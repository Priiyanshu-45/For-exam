import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseExamPaper, resolveDuration, resolveMarkingScheme, validateExamPaper, validateRegistry } from "./validateExam";
import { loadHistory, saveHistory } from "../data/persistence";
import type { ExamRegistry, ResultSummary } from "../types/exam";

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("dynamic registry discovery", () => {
  it("discovers a newly registered paper, resolves metadata, and leaves attempt history intact", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    });

    const existingResult: ResultSummary = {
      attemptId: "existing-result",
      examId: "upsssc-pet-2021-shift-2-gamma21-a",
      examTitle: "UP PET 2021",
      submittedAt: 1,
      score: 1,
      maxMarks: 1,
      percentage: 100,
      correct: 1,
      incorrect: 0,
      unanswered: 0,
      autoSubmitted: false,
    };
    saveHistory([existingResult]);

    const registryRaw = loadJson(resolve(process.cwd(), "public", "exams", "registry.json"));
    const sampleRaw = loadJson(resolve(process.cwd(), "public", "exams", "sample-mock-3.json"));
    const sample = parseExamPaper(sampleRaw).paper;
    expect(sample).not.toBeNull();
    const sourceRegistry = registryRaw as ExamRegistry;
    const dynamicRegistry = {
      ...sourceRegistry,
      exams: [
        ...sourceRegistry.exams,
        {
          id: sample!.examId,
          title: sample!.title,
          year: sample!.examDate ? Number(sample!.examDate.slice(0, 4)) : null,
          examDate: sample!.examDate ?? null,
          shift: sample!.shift ?? null,
          paperSet: sample!.paperSet ?? null,
          category: "mock",
          dataPath: "/exams/sample-mock-3.json",
          status: "published",
        },
      ],
    };
    const validatedRegistry = validateRegistry(dynamicRegistry);
    expect(validatedRegistry.ok).toBe(true);
    expect(validatedRegistry.exams.map((item) => item.id)).toContain(sample!.examId);

    for (const entry of validatedRegistry.exams) {
      const filename = entry.dataPath.replace(/^\/+/, "");
      const paper = parseExamPaper(loadJson(resolve(process.cwd(), "public", filename))).paper;
      expect(paper).not.toBeNull();
      const validation = validateExamPaper(paper!);
      expect(validation.ok, `${entry.id} should validate`).toBe(true);
      const duration = resolveDuration(paper!, entry, validatedRegistry.defaults!);
      const marking = resolveMarkingScheme(paper!, entry, validatedRegistry.defaults!);
      expect(duration.minutes).toBeGreaterThan(0);
      expect(marking.scheme.marksPerCorrect).toBeGreaterThan(0);
      expect(validation.questionCount).toBe(paper!.questions.length);
    }
    expect(loadHistory()).toEqual([existingResult]);
    vi.unstubAllGlobals();
  });
});
