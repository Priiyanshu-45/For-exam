import type {
  ExamRegistry,
  ExamValidation,
  LibraryExam,
  RegistryDefaults,
  RegistryExam,
  ResolvedExam,
  ValidationIssue,
} from "../types/exam";
import { fingerprintPaper } from "../engine/hash";
import { buildAnswerKey, stripAnswerKey } from "../engine/scoring";
import {
  parseExamPaper,
  resolveDuration,
  resolveMarkingScheme,
  validateExamPaper,
  validateRegistry,
} from "../engine/validateExam";
import { getImportedExam, listImportedExams } from "./importedLibrary";

export type LibrarySnapshot = {
  defaults: RegistryDefaults;
  bundled: LibraryExam[];
  imported: LibraryExam[];
  exams: LibraryExam[];
  registryIssues: ValidationIssue[];
};

const FALLBACK_DEFAULTS: RegistryDefaults = {
  durationMinutes: 120,
  durationNote: "Typical UP PET duration used because the paper file omitted it.",
  markingScheme: {
    marksPerCorrect: 1,
    marksPerIncorrect: -0.25,
    marksPerUnattempted: 0,
  },
  markingNote: "Standard PET practice marking used because the paper file omitted it.",
};

export async function loadRegistry(): Promise<{
  defaults: RegistryDefaults;
  exams: RegistryExam[];
  issues: ValidationIssue[];
}> {
  const response = await fetch("/exams/registry.json", { cache: "no-store" });
  if (!response.ok) {
    return {
      defaults: FALLBACK_DEFAULTS,
      exams: [],
      issues: [{ level: "error", code: "registry-missing", message: "Could not load /exams/registry.json." }],
    };
  }
  const raw: unknown = await response.json();
  const parsed = validateRegistry(raw);
  return {
    defaults: parsed.defaults ?? FALLBACK_DEFAULTS,
    exams: parsed.exams.filter((exam) => exam.status !== "draft"),
    issues: parsed.issues,
  };
}

async function peekPaperMeta(exam: RegistryExam, defaults: RegistryDefaults): Promise<Pick<LibraryExam, "questionCount" | "maxMarks" | "subjects" | "durationMinutes" | "durationSource" | "markingScheme" | "markingSource" | "validationOk" | "validationIssues">> {
  try {
    const response = await fetch(exam.dataPath, { cache: "no-store" });
    if (!response.ok) {
      return {
        validationOk: false,
        validationIssues: [{ level: "error", code: "missing-file", message: `Exam file not found: ${exam.dataPath}` }],
      };
    }
    const raw: unknown = await response.json();
    const { paper, issues } = parseExamPaper(raw);
    if (!paper) {
      return { validationOk: false, validationIssues: issues };
    }
    const validation = validateExamPaper(paper);
    const duration = resolveDuration(paper, exam, defaults);
    const marking = resolveMarkingScheme(paper, exam, defaults);
    const evaluableCount = Math.max(0, paper.questions.length - validation.unresolvedQuestionIds.length);
    const maxMarks = Math.round(evaluableCount * marking.scheme.marksPerCorrect * 100) / 100;
    const subjects = [...new Set(paper.questions.map((question) => question.subject?.trim()).filter((subject): subject is string => Boolean(subject)))];
    return {
      questionCount: paper.questions.length,
      maxMarks,
      subjects,
      durationMinutes: duration.minutes,
      durationSource: duration.source,
      markingScheme: marking.scheme,
      markingSource: marking.source,
      validationOk: validation.ok,
      validationIssues: [...issues, ...validation.issues],
    };
  } catch {
    return {
      validationOk: false,
      validationIssues: [{ level: "error", code: "parse-error", message: `Could not parse ${exam.dataPath}` }],
    };
  }
}

export async function loadLibrary(): Promise<LibrarySnapshot> {
  const registry = await loadRegistry();
  const bundled = await Promise.all(
    registry.exams.map(async (exam) => {
      const meta = await peekPaperMeta(exam, registry.defaults);
      return { ...exam, ...meta, source: "bundled" as const };
    }),
  );
  const importedRecords = await listImportedExams();
  const imported: LibraryExam[] = importedRecords.map((record) => {
    const validation = validateExamPaper(record.paper);
    const duration = resolveDuration(record.paper, record.meta, registry.defaults);
    const marking = resolveMarkingScheme(record.paper, record.meta, registry.defaults);
    const evaluableCount = Math.max(0, record.paper.questions.length - validation.unresolvedQuestionIds.length);
    return {
      ...record.meta,
      questionCount: record.paper.questions.length,
      maxMarks: Math.round(evaluableCount * marking.scheme.marksPerCorrect * 100) / 100,
      subjects: [...new Set(record.paper.questions.map((question) => question.subject?.trim()).filter((subject): subject is string => Boolean(subject)))],
      durationMinutes: duration.minutes,
      durationSource: duration.source,
      markingScheme: marking.scheme,
      markingSource: marking.source,
      validationOk: validation.ok,
      validationIssues: validation.issues,
      source: "imported",
    };
  });
  return {
    defaults: registry.defaults,
    bundled,
    imported,
    exams: [...bundled, ...imported],
    registryIssues: registry.issues,
  };
}

export async function loadResolvedExam(examId: string, defaults: RegistryDefaults): Promise<ResolvedExam> {
  const registry = await loadRegistry();
  const bundled = registry.exams.find((exam) => exam.id === examId);
  if (bundled) {
    const response = await fetch(bundled.dataPath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Exam data file is missing: ${bundled.dataPath}`);
    }
    const raw: unknown = await response.json();
    return resolveLoadedPaper(bundled, raw, defaults, "bundled");
  }

  const imported = await getImportedExam(examId);
  if (!imported) {
    throw new Error(`Exam ${examId} was not found in the registry or local library.`);
  }
  return resolveLoadedPaper(imported.meta, imported.paper, defaults, "imported");
}

async function resolveLoadedPaper(
  registry: RegistryExam,
  raw: unknown,
  defaults: RegistryDefaults,
  source: "bundled" | "imported",
): Promise<ResolvedExam> {
  const parsed = parseExamPaper(raw);
  if (!parsed.paper) {
    throw new Error(parsed.issues[0]?.message ?? "Invalid exam file.");
  }
  const validation = validateExamPaper(parsed.paper);
  if (!validation.ok) {
    const firstError = validation.issues.find((issue) => issue.level === "error");
    throw new Error(firstError?.message ?? "Exam failed validation.");
  }
  const duration = resolveDuration(parsed.paper, registry, defaults);
  const marking = resolveMarkingScheme(parsed.paper, registry, defaults);
  return {
    registry,
    paper: parsed.paper,
    questions: stripAnswerKey(parsed.paper.questions),
    contexts: parsed.paper.contexts ?? [],
    durationMinutes: duration.minutes,
    durationSource: duration.source,
    markingScheme: marking.scheme,
    markingSource: marking.source,
    durationNote: duration.note,
    markingNote: marking.note,
    validation: { ...validation, issues: [...parsed.issues, ...validation.issues] },
    dataVersion: await fingerprintPaper(parsed.paper),
    answerKey: buildAnswerKey(parsed.paper.questions),
    source,
  };
}

export function examToRegistryExport(snapshot: LibrarySnapshot): ExamRegistry {
  return {
    schemaVersion: "1.0",
    defaults: snapshot.defaults,
    exams: snapshot.bundled.map((exam) => {
      const {
        questionCount: _questionCount,
        maxMarks: _maxMarks,
        subjects: _subjects,
        durationSource: _durationSource,
        markingSource: _markingSource,
        validationOk: _validationOk,
        validationIssues: _validationIssues,
        source: _source,
        ...registryExam
      } = exam;
      return registryExam;
    }),
  };
}

export function summarizeValidation(validation: ExamValidation | undefined): string {
  if (!validation) return "Not validated";
  const errors = validation.issues.filter((issue) => issue.level === "error").length;
  const warnings = validation.issues.filter((issue) => issue.level === "warning").length;
  if (errors) return `${errors} error${errors === 1 ? "" : "s"}`;
  if (warnings) return `${warnings} warning${warnings === 1 ? "" : "s"}`;
  return "Valid";
}
