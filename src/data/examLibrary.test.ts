import { afterEach, describe, expect, it, vi } from "vitest";
import { examToRegistryExport, loadRegistry, type LibrarySnapshot } from "./examLibrary";
import type { LibraryExam, RegistryDefaults } from "../types/exam";

const defaults: RegistryDefaults = {
  durationMinutes: 120,
  durationNote: "Default duration",
  markingScheme: { marksPerCorrect: 1, marksPerIncorrect: -0.25, marksPerUnattempted: 0 },
  markingNote: "Default marking",
};

describe("exam library registry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads published exams while keeping draft entries out of the library", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        schemaVersion: "1.0",
        defaults,
        exams: [
          { id: "published", title: "Published paper", category: "mock", dataPath: "/published.json", status: "published" },
          { id: "draft", title: "Draft paper", category: "mock", dataPath: "/draft.json", status: "draft" },
        ],
      }),
    }));
    const result = await loadRegistry();
    expect(result.exams.map((exam) => exam.id)).toEqual(["published"]);
    expect(result.defaults.durationMinutes).toBe(120);
  });

  it("strips computed library fields from exported registry entries", () => {
    const computedExam: LibraryExam = {
      id: "computed",
      title: "Computed paper",
      category: "mock",
      dataPath: "/computed.json",
      status: "published",
      questionCount: 10,
      maxMarks: 9,
      subjects: ["Math"],
      durationMinutes: 120,
      durationSource: "defaults",
      markingScheme: defaults.markingScheme,
      markingSource: "defaults",
      validationOk: true,
      validationIssues: [],
      source: "bundled",
    };
    const snapshot: LibrarySnapshot = {
      defaults,
      bundled: [computedExam],
      imported: [],
      exams: [computedExam],
      registryIssues: [],
    };
    const exported = examToRegistryExport(snapshot).exams[0];
    expect(exported).not.toHaveProperty("questionCount");
    expect(exported).not.toHaveProperty("maxMarks");
    expect(exported).not.toHaveProperty("subjects");
    expect(exported).not.toHaveProperty("durationSource");
    expect(exported).not.toHaveProperty("markingSource");
    expect(exported).not.toHaveProperty("validationOk");
    expect(exported).not.toHaveProperty("validationIssues");
    expect(exported).not.toHaveProperty("source");
    expect(exported.durationMinutes).toBe(120);
  });
});
