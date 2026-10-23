import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadLibrary, loadResolvedExam } from "../data/examLibrary";
import { loadActiveAttempt, loadPreferences, saveActiveAttempt, savePreferences } from "../data/persistence";
import { createAttempt, isAttemptExpired } from "../engine/attempt";
import type { LanguageMode, ResolvedExam } from "../types/exam";

export function InstructionsPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ResolvedExam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [freshStart, setFreshStart] = useState(false);
  const [languageMode, setLanguageMode] = useState<LanguageMode>(() => loadPreferences().languageMode);
  const [autoAdvance, setAutoAdvance] = useState(() => loadPreferences().autoAdvance);
  const active = loadActiveAttempt(examId);
  const canResume = Boolean(active && active.examId === examId && !active.submitted && !isAttemptExpired(active));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const library = await loadLibrary();
        const resolved = await loadResolvedExam(examId, library.defaults);
        if (!cancelled) setExam(resolved);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this exam.");
      }
    })();
    return () => { cancelled = true; };
  }, [examId]);

  if (error) return <main className="page"><p className="notice" role="alert">{error}</p><Link to="/">Back to library</Link></main>;
  if (!exam) return <main className="page"><p>Loading exam instructions…</p></main>;

  const updatePreferences = (next: { languageMode?: LanguageMode; autoAdvance?: boolean }) => {
    savePreferences({ ...loadPreferences(), ...next });
    if (next.languageMode) setLanguageMode(next.languageMode);
    if (next.autoAdvance !== undefined) setAutoAdvance(next.autoAdvance);
  };
  const evaluableCount = Math.max(0, exam.questions.length - exam.validation.unresolvedQuestionIds.length);
  const maxMarks = Math.round(evaluableCount * exam.markingScheme.marksPerCorrect * 100) / 100;
  const canStart = agreed && autoAdvance;

  const start = () => {
    const attempt = createAttempt({
      examId: exam.registry.id,
      dataVersion: exam.dataVersion,
      questionIds: exam.questions.map((question) => question.id),
      durationMinutes: exam.durationMinutes,
      languageMode,
      autoAdvance,
    });
    saveActiveAttempt(attempt);
    navigate(`/exam/${encodeURIComponent(examId)}`);
  };

  const resume = () => navigate(`/exam/${encodeURIComponent(examId)}`);

  return (
    <main id="main" className="page">
      <p><Link to="/">← Library</Link></p>
      <h1>{exam.registry.title}</h1>
      <section className="card">
        <h2>Examination details</h2>
        <p><strong>Exam title (English):</strong> {exam.paper.title}</p>
        <p><strong>Exam title (Hindi):</strong> {exam.paper.titleHi || "Not provided"}</p>
        <p><strong>Exam date:</strong> {exam.paper.examDate || exam.registry.examDate || "Not specified"}</p>
        <p><strong>Shift:</strong> {exam.paper.shift || exam.registry.shift || "Not specified"} · <strong>Paper set:</strong> {exam.paper.paperSet || exam.registry.paperSet || "Not specified"}</p>
        <p><strong>Total questions:</strong> {exam.questions.length}</p>
        <p><strong>Duration:</strong> {exam.durationMinutes} minutes ({exam.durationSource}{exam.durationNote ? ` — ${exam.durationNote}` : ""})</p>
        <p>
          <strong>Maximum marks:</strong> {maxMarks}
          {exam.validation.unresolvedQuestionIds.length
            ? ` across ${evaluableCount} evaluable questions; ${exam.validation.unresolvedQuestionIds.length} unresolved answer key(s) are excluded.`
            : ""}
        </p>
        <p><strong>Marking rules:</strong> {exam.markingScheme.marksPerCorrect} for a correct answer, {exam.markingScheme.marksPerIncorrect} for an incorrect answer, {exam.markingScheme.marksPerUnattempted} for an unanswered question.</p>
        <p className="muted">Marking source: {exam.markingSource}{exam.markingNote ? `. ${exam.markingNote}` : ""}</p>
        {exam.validation.unresolvedQuestionIds.length ? (
          <p className="notice" role="status">
            {exam.validation.unresolvedQuestionIds.length} question(s) have unresolved answer keys and will not be scored as correct or incorrect.
          </p>
        ) : null}
        <h2>Before you begin</h2>
        <ul>
          <li>Use the palette to jump to any question. Status is shown with both symbols and a legend.</li>
          <li>Single-click an option to select or replace your answer. Double-click the selected option within 350 ms to clear it; use Clear Response with one click on touch or desktop devices.</li>
          <li>Mark for Review does not change scoring; a selected marked answer is still evaluated.</li>
          <li>The timer starts only after you select Start examination. It uses a saved deadline, so a valid attempt resumes with the same remaining time.</li>
          <li>Progress is stored in this browser only. Clearing site data removes it. It is not tamper-proof and does not sync across devices.</li>
          <li>Correct answers are not shown during the exam. The paper submits automatically when time reaches zero.</li>
        </ul>
        <div className="toolbar">
          <label>
            Default language mode{" "}
            <select value={languageMode} onChange={(event) => updatePreferences({ languageMode: event.target.value as LanguageMode })} aria-label="Default language mode">
              <option value="bilingual">Bilingual</option>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="check-control">
            <input type="checkbox" checked={autoAdvance} onChange={(event) => updatePreferences({ autoAdvance: event.target.checked })} />
            Automatically advance to the next question after selecting an option
          </label>
        </div>
        <label className="check-control">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I have read and understood the examination instructions
        </label>
        <p className="muted" id="start-requirements">Select both options above to enable starting or resuming the exam.</p>
        <div className="actions">
          {canResume && !freshStart ? (
            <>
              <button type="button" className="primary" disabled={!canStart} onClick={resume}>Resume exam</button>
              <button type="button" className="ghost" disabled={!canStart} onClick={() => setFreshStart(true)}>Start new attempt instead</button>
            </>
          ) : (
            <button type="button" className="primary" disabled={!canStart} aria-describedby="start-requirements" onClick={start}>Start examination</button>
          )}
        </div>
      </section>
    </main>
  );
}
