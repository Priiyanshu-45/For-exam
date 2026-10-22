import type {
  ActiveAttempt,
  AttemptResult,
  ResultSummary,
  UserPreferences,
} from "../types/exam";

const PREFS_KEY = "up-pet:prefs";
const ACTIVE_KEY = "up-pet:active-attempt";
const HISTORY_KEY = "up-pet:history";
const RESULT_PREFIX = "up-pet:result:";

export const defaultPreferences: UserPreferences = {
  languageMode: "bilingual",
  theme: "dark",
  autoAdvance: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadPreferences(): UserPreferences {
  return { ...defaultPreferences, ...readJson(PREFS_KEY, {}) };
}

export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadActiveAttempt(): ActiveAttempt | null {
  const attempt = readJson<ActiveAttempt | null>(ACTIVE_KEY, null);
  if (!attempt || attempt.submitted) return null;
  return attempt;
}

export function saveActiveAttempt(attempt: ActiveAttempt): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(attempt));
}

export function clearActiveAttempt(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

export function loadHistory(): ResultSummary[] {
  return readJson<ResultSummary[]>(HISTORY_KEY, []);
}

export function saveHistory(history: ResultSummary[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function appendResult(result: AttemptResult): void {
  localStorage.setItem(RESULT_PREFIX + result.attemptId, JSON.stringify(result));
  const history = loadHistory();
  const summary: ResultSummary = {
    attemptId: result.attemptId,
    examId: result.examId,
    examTitle: result.examTitle,
    submittedAt: result.submittedAt,
    score: result.breakdown.score,
    maxMarks: result.breakdown.maxMarks,
    percentage: result.breakdown.percentage,
    correct: result.breakdown.correct,
    incorrect: result.breakdown.incorrect,
    unanswered: result.breakdown.unanswered,
    autoSubmitted: result.autoSubmitted,
  };
  saveHistory([summary, ...history.filter((item) => item.attemptId !== result.attemptId)]);
}

export function loadResult(attemptId: string): AttemptResult | null {
  return readJson<AttemptResult | null>(RESULT_PREFIX + attemptId, null);
}

export function deleteHistoryForExam(examId: string): void {
  const history = loadHistory();
  const keep: ResultSummary[] = [];
  for (const item of history) {
    if (item.examId === examId) {
      localStorage.removeItem(RESULT_PREFIX + item.attemptId);
    } else {
      keep.push(item);
    }
  }
  saveHistory(keep);
}

export function clearAllLocalData(): void {
  const keys = Object.keys(localStorage).filter((key) => key.startsWith("up-pet:"));
  for (const key of keys) localStorage.removeItem(key);
}

export function examHistory(examId: string): ResultSummary[] {
  return loadHistory().filter((item) => item.examId === examId);
}
