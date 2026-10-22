import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadLibrary, loadResolvedExam } from "../data/examLibrary";
import { createAttempt } from "../engine/attempt";
import { loadActiveAttempt, loadPreferences, saveActiveAttempt } from "../data/persistence";
import type { ResolvedExam } from "../types/exam";

export function InstructionsPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ResolvedExam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [freshStart, setFreshStart] = useState(false);
  const active = loadActiveAttempt();
  const canResume = active?.examId === examId && !active.submitted;

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

  const start = () => {
    const prefs = loadPreferences();
    const attempt = createAttempt({
      examId: exam.registry.id,
      dataVersion: exam.dataVersion,
      questionIds: exam.questions.map((question) => question.id),
      durationMinutes: exam.durationMinutes,
      languageMode: prefs.languageMode,
      autoAdvance: prefs.autoAdvance,
    });
    saveActiveAttempt(attempt);
    navigate(`/exam/${encodeURIComponent(examId)}`);
  };

  const resume = () => navigate(`/exam/${encodeURIComponent(examId)}`);

  return (
    <main id="main" className="page">
      <p><Link to="/">← Library</Link></p>
      <h1>{exam.registry.title}</h1>
      <p className="muted">{exam.paper.titleHi || exam.paper.title}</p>
      <section className="card">
        <p><strong>Questions:</strong> {exam.questions.length}</p>
        <p><strong>Duration:</strong> {exam.durationMinutes} minutes ({exam.durationSource}{exam.durationNote ? ` — ${exam.durationNote}` : ""})</p>
        <p>
          <strong>Maximum marks:</strong> {exam.validation.unresolvedQuestionIds.length
            ? `${exam.markingScheme.marksPerCorrect * (exam.questions.length - exam.validation.unresolvedQuestionIds.length)} from evaluable questions`
            : exam.markingScheme.marksPerCorrect * exam.questions.length}
        </p>
        <p><strong>Correct:</strong> {exam.markingScheme.marksPerCorrect} · <strong>Incorrect:</strong> {exam.markingScheme.marksPerIncorrect} · <strong>Unanswered:</strong> {exam.markingScheme.marksPerUnattempted}</p>
        <p className="muted">Marking source: {exam.markingSource}{exam.markingNote ? `. ${exam.markingNote}` : ""}</p>
        {exam.validation.unresolvedQuestionIds.length ? (
          <p className="notice">
            {exam.validation.unresolvedQuestionIds.length} question(s) have unresolved answer keys and will not be scored as correct or incorrect.
          </p>
        ) : null}
        <ul>
          <li>Use the palette to jump to any question. Status is shown with both colour and a legend.</li>
          <li>Single click selects an option. Double-click the selected option to clear it. On touch devices use Clear Response.</li>
          <li>Mark for Review does not change scoring; a selected marked answer is still evaluated.</li>
          <li>The timer uses a saved deadline, so refreshing the browser resumes the same remaining time when the attempt is still valid.</li>
          <li>Progress is stored in this browser only. Clearing site data will remove it. It is not tamper-proof and does not sync across devices.</li>
          <li>Correct answers are not shown during the exam. The paper submits automatically when time reaches zero.</li>
        </ul>
        <label>
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> I have read the instructions.
        </label>
        <div className="actions">
          {canResume && !freshStart ? (
            <>
              <button type="button" className="primary" onClick={resume}>Resume exam</button>
              <button type="button" className="ghost" onClick={() => setFreshStart(true)}>Start new attempt instead</button>
            </>
          ) : (
            <button type="button" className="primary" disabled={!agreed} onClick={start}>Start examination</button>
          )}
        </div>
      </section>
    </main>
  );
}
