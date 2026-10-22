import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ContextBlock } from "../components/ContextBlock";
import { MathText, pickText } from "../components/MathText";
import { loadLibrary, loadResolvedExam } from "../data/examLibrary";
import { examHistory, loadResult } from "../data/persistence";
import { formatDuration } from "../engine/timer";
import type { AttemptResult, LanguageMode, ResolvedExam } from "../types/exam";

type Filter = "all" | "incorrect" | "unanswered" | "correct" | "marked" | "unevaluated";

export function ResultsPage() {
  const { attemptId = "" } = useParams();
  const result = loadResult(attemptId);
  const [exam, setExam] = useState<ResolvedExam | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<LanguageMode>(result?.languageMode ?? "bilingual");

  useEffect(() => {
    if (!result) return;
    (async () => {
      const library = await loadLibrary();
      const resolved = await loadResolvedExam(result.examId, library.defaults);
      setExam(resolved);
    })().catch(() => setExam(null));
  }, [result?.examId]);

  if (!result) {
    return <main className="page"><p className="notice">That result was not found in this browser.</p><Link to="/">Library</Link></main>;
  }

  const previous = examHistory(result.examId).filter((item) => item.attemptId !== result.attemptId);
  const filtered = result.questionResults.filter((item) => {
    if (filter === "incorrect") return item.outcome === "incorrect";
    if (filter === "unanswered") return !item.selectedOptionId;
    if (filter === "correct") return item.outcome === "correct";
    if (filter === "marked") return item.marked;
    if (filter === "unevaluated") return item.outcome === "unevaluated";
    return true;
  });
  const current = filtered[Math.min(index, Math.max(0, filtered.length - 1))];
  const question = exam?.questions.find((item) => item.id === current?.questionId);
  const context = exam && question?.contextId ? exam.contexts.find((item) => item.id === question.contextId) : undefined;
  const langs: Array<"en" | "hi"> = mode === "bilingual" ? ["hi", "en"] : [mode];
  const insights = useMemo(() => buildInsights(result, previous), [result, previous]);

  return (
    <main id="main" className="page">
      <p><Link to="/">← Library</Link></p>
      <h1>Results — {result.examTitle}</h1>
      {exam && exam.dataVersion !== result.dataVersion ? (
        <p className="notice">This attempt used an earlier version of the exam file. Review uses the current file; historical scores are unchanged.</p>
      ) : null}
      <section className="stats">
        <article className="stat"><div className="label">Score</div><div className="value">{result.breakdown.score}/{result.breakdown.maxMarks}</div></article>
        <article className="stat"><div className="label">Percentage</div><div className="value">{result.breakdown.percentage ?? "—"}%</div></article>
        <article className="stat"><div className="label">Accuracy</div><div className="value">{result.breakdown.accuracy ?? "—"}%</div></article>
        <article className="stat"><div className="label">Time used</div><div className="value">{formatDuration(result.timeUsedMs / 1000)}</div></article>
      </section>
      <p className="muted">
        Correct {result.breakdown.correct} · Incorrect {result.breakdown.incorrect} · Unanswered {result.breakdown.unanswered} · Attempted {result.breakdown.attempted}
        {result.breakdown.unevaluated ? ` · Unevaluated ${result.breakdown.unevaluated}` : ""} · Remaining {formatDuration(result.timeRemainingMs / 1000)} · {result.autoSubmitted ? "Auto-submitted" : "Submitted"}
      </p>
      <div className="charts-row">
        <article className="card">
          <h2>Outcome mix</h2>
          <div className="stack-bar" aria-hidden="true">
            <i className="seg-c" style={{ width: `${pct(result.breakdown.correct, result.questionResults.length)}%` }} />
            <i className="seg-i" style={{ width: `${pct(result.breakdown.incorrect, result.questionResults.length)}%` }} />
            <i className="seg-u" style={{ width: `${pct(result.breakdown.unanswered, result.questionResults.length)}%` }} />
          </div>
          <p className="muted">Green correct, red incorrect, grey unanswered.</p>
        </article>
        <article className="card">
          <h2>Subject performance</h2>
          {result.subjectStats.filter((row) => row.subject !== "Unspecified" || result.subjectStats.length === 1).map((row) => (
            <p key={row.subject}>{row.subject}: {row.correct} correct / {row.attempted} attempted{row.accuracy != null ? ` (${row.accuracy}%)` : ""}</p>
          ))}
        </article>
      </div>
      {previous.length ? (
        <article className="card">
          <h2>Previous attempts</h2>
          <p>This score {result.breakdown.score} vs last {previous[0].score}. History is kept separately for each attempt.</p>
        </article>
      ) : null}
      <article className="card">
        <h2>Observations</h2>
        <ul className="insight">{insights.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="muted">{result.scoringPolicy}</p>
      </article>
      <article className="card">
        <h2>Question review</h2>
        <div className="toolbar">
          <select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setIndex(0); }} aria-label="Filter reviewed questions">
            <option value="all">All</option>
            <option value="incorrect">Incorrect</option>
            <option value="unanswered">Unanswered</option>
            <option value="correct">Correct</option>
            <option value="marked">Marked for review</option>
            <option value="unevaluated">Unresolved keys</option>
          </select>
          <select value={mode} onChange={(event) => setMode(event.target.value as LanguageMode)}>
            <option value="bilingual">Bilingual</option>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
        </div>
        {current && question ? (
          <>
            <p className="muted">{current.outcome} · your answer {current.selectedOptionId ?? "—"} · key {current.correctAnswer ?? "unavailable"}</p>
            {context ? <ContextBlock context={context} mode={mode} /> : null}
            {langs.map((lang) => {
              const text = pickText(question.question, lang);
              if (!text) return null;
              return <p key={lang} className="q-text"><MathText text={text} /></p>;
            })}
            {question.options.map((option) => {
              const chosen = current.selectedOptionId === option.id;
              const correct = current.correctAnswer === option.id;
              return (
                <div key={option.id} className={`option ${correct ? "correct" : ""} ${chosen && !correct ? "incorrect" : ""} ${chosen ? "selected" : ""}`}>
                  <span className="oid">{option.id}</span>
                  <span>
                    <MathText text={pickText(option, mode === "en" ? "en" : "hi") || pickText(option, "en") || pickText(option, "hi")} />
                    {chosen ? " · Your answer" : ""}{correct ? " · Correct answer" : ""}
                  </span>
                </div>
              );
            })}
            {exam?.answerKey[question.id]?.explanation ? <p><strong>Explanation:</strong> {exam.answerKey[question.id].explanation}</p> : null}
            {current.outcome === "unevaluated" ? <p className="notice">This question was not scored because the answer key is unresolved or incomplete.</p> : null}
            <div className="actions">
              <button type="button" className="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>Previous</button>
              <button type="button" className="ghost" disabled={index >= filtered.length - 1} onClick={() => setIndex((value) => value + 1)}>Next</button>
            </div>
          </>
        ) : <p>No questions in this filter.</p>}
      </article>
    </main>
  );
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

function buildInsights(result: AttemptResult, previous: ReturnType<typeof examHistory>): string[] {
  const lines: string[] = [];
  const ranked = [...result.subjectStats].filter((row) => row.attempted > 0).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0));
  if (ranked[0]) lines.push(`Strongest attempted area: ${ranked[0].subject} (${ranked[0].accuracy}%).`);
  if (ranked.length > 1) lines.push(`Needs more practice: ${ranked[ranked.length - 1].subject} (${ranked[ranked.length - 1].accuracy}%).`);
  lines.push(`You attempted ${result.breakdown.attempted} of ${result.questionResults.length} questions.`);
  if (result.breakdown.unevaluated) {
    lines.push(`${result.breakdown.unevaluated} question(s) were excluded from scoring because their keys are unresolved.`);
  }
  const slow = [...result.questionResults].sort((a, b) => b.timeSpentMs - a.timeSpentMs)[0];
  if (slow && slow.timeSpentMs > 60_000) {
    lines.push(`Longest recorded time was on ${slow.questionId} (${formatDuration(slow.timeSpentMs / 1000)}). Timing is local and approximate.`);
  }
  if (previous[0] && previous[0].percentage != null && result.breakdown.percentage != null) {
    const delta = Math.round((result.breakdown.percentage - previous[0].percentage) * 10) / 10;
    lines.push(`Compared with the previous attempt, percentage changed by ${delta > 0 ? "+" : ""}${delta} points.`);
  }
  return lines;
}
