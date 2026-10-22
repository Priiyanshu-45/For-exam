import type {
  ExamPaper,
  ExamQuestion,
  ExamValidation,
  MarkingScheme,
  RegistryDefaults,
  RegistryExam,
  ValidationIssue,
} from "../types/exam";

const OPTION_ID = /^[A-Za-z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bilingualPresent(value: unknown): { en: boolean; hi: boolean } {
  if (!isRecord(value)) return { en: false, hi: false };
  return {
    en: typeof value.en === "string" && value.en.trim().length > 0,
    hi: typeof value.hi === "string" && value.hi.trim().length > 0,
  };
}

export function isEvaluableQuestion(question: ExamQuestion): boolean {
  const status = (question.verificationStatus ?? "verified").toString().toLowerCase();
  if (["unresolved", "unreadable", "disputed", "incomplete"].includes(status)) {
    return false;
  }
  if (question.optionsIncomplete) return false;
  if (!question.correctAnswer) return false;
  return question.options.some((option) => option.id === question.correctAnswer);
}

export function validateRegistry(raw: unknown): {
  ok: boolean;
  issues: ValidationIssue[];
  defaults: RegistryDefaults | null;
  exams: RegistryExam[];
} {
  const issues: ValidationIssue[] = [];
  if (!isRecord(raw)) {
    return { ok: false, issues: [{ level: "error", code: "registry-invalid", message: "Registry is not an object." }], defaults: null, exams: [] };
  }

  const defaultsRaw = isRecord(raw.defaults) ? raw.defaults : {};
  const marking = isRecord(defaultsRaw.markingScheme) ? defaultsRaw.markingScheme : {};
  const defaults: RegistryDefaults = {
    durationMinutes: Number(defaultsRaw.durationMinutes) || 120,
    durationNote: asString(defaultsRaw.durationNote) ?? "",
    markingNote: asString(defaultsRaw.markingNote) ?? "",
    markingScheme: {
      marksPerCorrect: Number(marking.marksPerCorrect ?? 1),
      marksPerIncorrect: Number(marking.marksPerIncorrect ?? 0),
      marksPerUnattempted: Number(marking.marksPerUnattempted ?? 0),
    },
  };

  if (!Array.isArray(raw.exams)) {
    issues.push({ level: "error", code: "registry-exams", message: "Registry exams must be an array." });
    return { ok: false, issues, defaults, exams: [] };
  }

  const exams: RegistryExam[] = [];
  const ids = new Set<string>();
  for (const entry of raw.exams) {
    if (!isRecord(entry)) {
      issues.push({ level: "error", code: "registry-entry", message: "A registry entry is not an object." });
      continue;
    }
    const id = asString(entry.id);
    const title = asString(entry.title);
    const dataPath = asString(entry.dataPath);
    if (!id || !title || !dataPath) {
      issues.push({
        level: "error",
        code: "registry-entry-missing",
        message: `Registry entry is missing id, title, or dataPath (${id ?? "unknown"}).`,
      });
      continue;
    }
    if (ids.has(id)) {
      issues.push({ level: "error", code: "registry-duplicate-id", message: `Duplicate exam ID in registry: ${id}` });
      continue;
    }
    ids.add(id);
    exams.push({
      id,
      title,
      year: typeof entry.year === "number" ? entry.year : null,
      examDate: asString(entry.examDate),
      shift: asString(entry.shift),
      paperSet: asString(entry.paperSet),
      category: asString(entry.category) ?? "previous-year",
      dataPath,
      status: asString(entry.status) ?? "published",
      durationMinutes: typeof entry.durationMinutes === "number" ? entry.durationMinutes : null,
      markingScheme: isRecord(entry.markingScheme) ? (entry.markingScheme as Partial<MarkingScheme>) : null,
      source: "bundled",
    });
  }

  return { ok: issues.every((issue) => issue.level !== "error"), issues, defaults, exams };
}

export function parseExamPaper(raw: unknown): { paper: ExamPaper | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (!isRecord(raw)) {
    return { paper: null, issues: [{ level: "error", code: "invalid-json", message: "Exam file is not a JSON object." }] };
  }
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    issues.push({ level: "error", code: "no-questions", message: "Exam file has no questions." });
    return { paper: null, issues };
  }

  const questions: ExamQuestion[] = [];
  for (const item of raw.questions) {
    if (!isRecord(item)) {
      issues.push({ level: "error", code: "question-invalid", message: "A question entry is not an object." });
      continue;
    }
    const id = asString(item.id);
    if (!id) {
      issues.push({ level: "error", code: "question-id", message: "A question is missing an id." });
      continue;
    }
    const optionsRaw = Array.isArray(item.options) ? item.options : [];
    const options = optionsRaw.flatMap((option) => {
      if (!isRecord(option)) return [];
      const optionId = asString(option.id);
      if (!optionId) return [];
      return [{ id: optionId, en: asString(option.en), hi: asString(option.hi) }];
    });
    questions.push({
      id,
      originalQuestionNumber: asString(item.originalQuestionNumber) ?? questions.length + 1,
      subject: asString(item.subject),
      contextId: asString(item.contextId),
      question: isRecord(item.question)
        ? { en: asString(item.question.en), hi: asString(item.question.hi) }
        : { en: null, hi: null },
      options,
      correctAnswer: asString(item.correctAnswer),
      correctAnswerText: isRecord(item.correctAnswerText)
        ? { en: asString(item.correctAnswerText.en), hi: asString(item.correctAnswerText.hi) }
        : undefined,
      answerSource: asString(item.answerSource),
      explanation: asString(item.explanation),
      sourcePage: typeof item.sourcePage === "number" ? item.sourcePage : null,
      verificationStatus: asString(item.verificationStatus) ?? "verified",
      issues: Array.isArray(item.issues) ? item.issues.filter((value): value is string => typeof value === "string") : [],
      optionsIncomplete: Boolean(item.optionsIncomplete),
    });
  }

  const paper: ExamPaper = {
    schemaVersion: asString(raw.schemaVersion) ?? "1.0",
    examId: asString(raw.examId) ?? "unknown-exam",
    title: asString(raw.title) ?? "Untitled exam",
    titleHi: asString(raw.titleHi) ?? undefined,
    examDate: asString(raw.examDate),
    shift: asString(raw.shift),
    paperSet: asString(raw.paperSet),
    durationMinutes: typeof raw.durationMinutes === "number" ? raw.durationMinutes : null,
    totalQuestions: typeof raw.totalQuestions === "number" ? raw.totalQuestions : questions.length,
    markingScheme: isRecord(raw.markingScheme) ? (raw.markingScheme as Partial<MarkingScheme>) : null,
    metadata: isRecord(raw.metadata) ? raw.metadata : {},
    conductingBody: isRecord(raw.conductingBody)
      ? { en: asString(raw.conductingBody.en), hi: asString(raw.conductingBody.hi) }
      : undefined,
    contexts: Array.isArray(raw.contexts) ? (raw.contexts as ExamPaper["contexts"]) : [],
    questions,
  };

  return { paper, issues };
}

export function validateExamPaper(paper: ExamPaper): ExamValidation {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const optionCounts: Record<string, number> = {};
  const unresolvedQuestionIds: string[] = [];
  let missingTranslationCount = 0;

  if (!paper.examId) {
    issues.push({ level: "error", code: "exam-id", message: "Exam is missing examId." });
  }
  if (!paper.title) {
    issues.push({ level: "error", code: "exam-title", message: "Exam is missing a title." });
  }
  if (paper.questions.length === 0) {
    issues.push({ level: "error", code: "no-questions", message: "Exam has no usable questions." });
  }

  for (const question of paper.questions) {
    if (seen.has(question.id)) {
      issues.push({
        level: "error",
        code: "duplicate-id",
        message: `Duplicate question ID ${question.id}.`,
        questionId: question.id,
      });
    }
    seen.add(question.id);

    const count = question.options.length;
    optionCounts[String(count)] = (optionCounts[String(count)] ?? 0) + 1;
    if (count < 2) {
      issues.push({
        level: question.optionsIncomplete ? "warning" : "error",
        code: "missing-options",
        message: `Question ${question.id} has fewer than two options.`,
        questionId: question.id,
      });
    }

    const optionIds = new Set<string>();
    for (const option of question.options) {
      if (!OPTION_ID.test(option.id)) {
        issues.push({
          level: "error",
          code: "invalid-option-id",
          message: `Question ${question.id} has an invalid option label ${option.id}.`,
          questionId: question.id,
        });
      }
      if (optionIds.has(option.id)) {
        issues.push({
          level: "error",
          code: "duplicate-option",
          message: `Question ${question.id} repeats option ${option.id}.`,
          questionId: question.id,
        });
      }
      optionIds.add(option.id);
      const optionLang = bilingualPresent(option);
      if (!optionLang.en && !optionLang.hi) {
        issues.push({
          level: "error",
          code: "empty-option",
          message: `Question ${question.id} option ${option.id} has no text.`,
          questionId: question.id,
        });
      }
    }

    const qLang = bilingualPresent(question.question);
    if (!qLang.en && !qLang.hi) {
      issues.push({
        level: "error",
        code: "empty-question",
        message: `Question ${question.id} has no English or Hindi text.`,
        questionId: question.id,
      });
    } else if (!qLang.en || !qLang.hi) {
      missingTranslationCount += 1;
      issues.push({
        level: "warning",
        code: "missing-translation",
        message: `Question ${question.id} is missing a language variant.`,
        questionId: question.id,
      });
    }

    if (question.correctAnswer && !optionIds.has(question.correctAnswer)) {
      issues.push({
        level: "error",
        code: "invalid-answer-label",
        message: `Question ${question.id} answer key ${question.correctAnswer} does not match any option.`,
        questionId: question.id,
      });
    }

    if (!isEvaluableQuestion(question)) {
      unresolvedQuestionIds.push(question.id);
      issues.push({
        level: "warning",
        code: "unresolved-key",
        message: `Question ${question.id} has no verified scorable answer key.`,
        questionId: question.id,
      });
    }
  }

  if (paper.totalQuestions && paper.totalQuestions !== paper.questions.length) {
    issues.push({
      level: "warning",
      code: "count-mismatch",
      message: `Declared totalQuestions is ${paper.totalQuestions}, but ${paper.questions.length} questions were found.`,
    });
  }

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  return {
    ok: errorCount === 0,
    examId: paper.examId,
    title: paper.title,
    questionCount: paper.questions.length,
    optionCounts,
    unresolvedQuestionIds,
    missingTranslationCount,
    issues,
  };
}

export function resolveMarkingScheme(
  paper: ExamPaper,
  registry: RegistryExam,
  defaults: RegistryDefaults,
): { scheme: MarkingScheme; source: "paper" | "registry" | "defaults"; note?: string } {
  const paperScheme = paper.markingScheme;
  if (
    paperScheme &&
    typeof paperScheme.marksPerCorrect === "number" &&
    typeof paperScheme.marksPerIncorrect === "number" &&
    typeof paperScheme.marksPerUnattempted === "number"
  ) {
    return {
      scheme: {
        marksPerCorrect: paperScheme.marksPerCorrect,
        marksPerIncorrect: paperScheme.marksPerIncorrect,
        marksPerUnattempted: paperScheme.marksPerUnattempted,
      },
      source: "paper",
    };
  }
  if (
    registry.markingScheme &&
    typeof registry.markingScheme.marksPerCorrect === "number" &&
    typeof registry.markingScheme.marksPerIncorrect === "number" &&
    typeof registry.markingScheme.marksPerUnattempted === "number"
  ) {
    return {
      scheme: {
        marksPerCorrect: registry.markingScheme.marksPerCorrect,
        marksPerIncorrect: registry.markingScheme.marksPerIncorrect,
        marksPerUnattempted: registry.markingScheme.marksPerUnattempted,
      },
      source: "registry",
    };
  }
  return {
    scheme: defaults.markingScheme,
    source: "defaults",
    note: defaults.markingNote,
  };
}

export function resolveDuration(
  paper: ExamPaper,
  registry: RegistryExam,
  defaults: RegistryDefaults,
): { minutes: number; source: "paper" | "registry" | "defaults"; note?: string } {
  if (typeof paper.durationMinutes === "number" && paper.durationMinutes > 0) {
    return { minutes: paper.durationMinutes, source: "paper" };
  }
  if (typeof registry.durationMinutes === "number" && registry.durationMinutes > 0) {
    return { minutes: registry.durationMinutes, source: "registry" };
  }
  return { minutes: defaults.durationMinutes, source: "defaults", note: defaults.durationNote };
}

export function sanitizeQuestions(questions: ExamQuestion[]): ExamQuestion["id"][] {
  return questions.map((question) => question.id);
}
