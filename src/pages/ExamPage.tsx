import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContextBlock } from "../components/ContextBlock";
import { Dialog } from "../components/Dialog";
import { MathText, pickText } from "../components/MathText";
import { QuestionPalette } from "../components/QuestionPalette";
import { loadLibrary, loadResolvedExam } from "../data/examLibrary";
import {
  clearActiveAttempt,
  loadActiveAttempt,
  saveActiveAttempt,
  appendResult,
} from "../data/persistence";
import { addTimeSpent, attemptCounts, clearOption, isAttemptExpired, selectOption, toggleMark, visitQuestion } from "../engine/attempt";
import { applyOptionClick, type ClickMemory } from "../engine/optionClick";
import { scoreAttempt } from "../engine/scoring";
import { formatDuration, remainingMs, timerUrgency } from "../engine/timer";
import type { ActiveAttempt, LanguageMode, ResolvedExam } from "../types/exam";

export function ExamPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ResolvedExam | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const lastClick = useRef<ClickMemory | null>(null);
  const lastTick = useRef(Date.now());
  const submitting = useRef(false);
  const attemptRef = useRef<ActiveAttempt | null>(null);

  useEffect(() => { attemptRef.current = attempt; }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const library = await loadLibrary();
        const resolved = await loadResolvedExam(examId, library.defaults);
        if (cancelled) return;
        const stored = loadActiveAttempt();
        if (!stored || stored.examId !== examId) {
          setError("No active attempt. Open the instructions screen to start the timer.");
          return;
        }
        if (stored.submitted) {
          navigate(`/results/${stored.attemptId}`, { replace: true });
          return;
        }
        setExam(resolved);
        if (isAttemptExpired(stored)) {
          finalize(resolved, stored, true);
          return;
        }
        setAttempt(stored);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load exam.");
      }
    })();
    return () => { cancelled = true; };
  }, [examId, navigate]);

  const persist = useCallback((next: ActiveAttempt) => {
    setAttempt(next);
    saveActiveAttempt(next);
  }, []);

  const finalize = useCallback((resolved: ResolvedExam, current: ActiveAttempt, autoSubmitted: boolean) => {
    if (submitting.current || current.submitted) return;
    submitting.current = true;
    const frozen: ActiveAttempt = { ...current, submitted: true, submittedAt: Date.now() };
    const result = scoreAttempt({
      attempt: frozen,
      examTitle: resolved.registry.title,
      questions: resolved.questions,
      answerKey: resolved.answerKey,
      markingScheme: resolved.markingScheme,
      markingSource: resolved.markingSource,
      autoSubmitted,
    });
    appendResult(result);
    clearActiveAttempt();
    navigate(`/results/${result.attemptId}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!attempt || !exam) return;
    const tick = () => {
      const now = Date.now();
      const current = attemptRef.current;
      if (!current || current.submitted) return;
      const question = exam.questions[current.currentIndex];
      if (question) {
        const state = addTimeSpent(current.states[question.id], now - lastTick.current);
        const next = { ...current, states: { ...current.states, [question.id]: state } };
        attemptRef.current = next;
        saveActiveAttempt(next);
      }
      lastTick.current = now;
      const left = remainingMs(current.deadlineAt, now);
      setRemaining(left);
      if (left <= 0) finalize(exam, attemptRef.current ?? current, true);
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => { lastTick.current = Date.now(); tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [attempt?.attemptId, exam, finalize]);

  const questionIds = useMemo(() => exam?.questions.map((question) => question.id) ?? [], [exam]);
  const question = exam && attempt ? exam.questions[attempt.currentIndex] : null;
  const context = exam && question?.contextId ? exam.contexts.find((item) => item.id === question.contextId) : undefined;
  const counts = attempt ? attemptCounts(attempt, questionIds) : null;
  const urgency = timerUrgency(remaining);

  if (error) {
    return <main className="page"><p className="notice" role="alert">{error}</p><Link to={`/exam/${encodeURIComponent(examId)}/instructions`}>Open instructions</Link></main>;
  }
  if (!exam || !attempt || !question) return <main className="page">Loading examination…</main>;

  const goTo = (index: number) => {
    const id = exam.questions[index]?.id;
    if (!id) return;
    persist({
      ...attempt,
      currentIndex: index,
      states: { ...attempt.states, [id]: visitQuestion(attempt.states[id]) },
    });
    setPaletteOpen(false);
  };

  const updateCurrent = (mutator: (state: typeof attempt.states[string]) => typeof attempt.states[string]) => {
    const nextState = mutator(attempt.states[question.id]);
    persist({ ...attempt, states: { ...attempt.states, [question.id]: nextState } });
    return nextState;
  };

  const onOption = (optionId: string) => {
    const result = applyOptionClick({
      selectedOptionId: attempt.states[question.id]?.selectedOptionId ?? null,
      optionId,
      now: Date.now(),
      lastClick: lastClick.current,
    });
    lastClick.current = result.lastClick;
    const nextState = result.selectedOptionId
      ? selectOption(attempt.states[question.id], result.selectedOptionId)
      : clearOption(attempt.states[question.id]);
    const nextAttempt = { ...attempt, states: { ...attempt.states, [question.id]: nextState } };
    persist(nextAttempt);
    if (result.selectedOptionId && attempt.autoAdvance && attempt.currentIndex < exam.questions.length - 1) {
      goTo(attempt.currentIndex + 1);
    }
  };

  const isLast = attempt.currentIndex === exam.questions.length - 1;
  const mode = attempt.languageMode;
  const langs: Array<"en" | "hi"> = mode === "bilingual" ? ["hi", "en"] : [mode];

  return (
    <div className="exam-shell">
      <header className="exam-top">
        <div>
          <h1>{exam.registry.title}</h1>
          <div className="muted">Question {attempt.currentIndex + 1} of {exam.questions.length}{question.subject ? ` · ${question.subject}` : ""}</div>
        </div>
        <div className={`timer ${urgency}`} aria-live="polite" aria-label="Time remaining">
          {formatDuration(remaining / 1000)}
        </div>
      </header>
      <div className="exam-body">
        <main id="main" className="question-pane">
          <div className="toolbar">
            <label>
              Language{" "}
              <select
                value={mode}
                onChange={(event) => persist({ ...attempt, languageMode: event.target.value as LanguageMode })}
                aria-label="Question language"
              >
                <option value="bilingual">Bilingual</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          {context ? <ContextBlock context={context} mode={mode} /> : null}
          <p className="q-kicker">Q{question.originalQuestionNumber ?? attempt.currentIndex + 1}</p>
          {langs.map((lang) => {
            const text = pickText(question.question, lang);
            if (!text) return null;
            return (
              <div key={lang} className="lang-block">
                {mode === "bilingual" ? <div className="lang-label">{lang === "hi" ? "हिन्दी" : "English"}</div> : null}
                <p className="q-text"><MathText text={text} /></p>
              </div>
            );
          })}
          {question.options.map((option) => {
            const selected = attempt.states[question.id]?.selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`option ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onOption(option.id)}
              >
                <span className="oid">{option.id}</span>
                <span>
                  {langs.map((lang) => {
                    const text = pickText(option, lang);
                    if (!text) return null;
                    return (
                      <div key={lang} className="lang-block">
                        {mode === "bilingual" ? <div className="lang-label">{lang === "hi" ? "हिन्दी" : "English"}</div> : null}
                        <MathText text={text} />
                      </div>
                    );
                  })}
                </span>
              </button>
            );
          })}
        </main>
        <aside className="palette-pane">
          <QuestionPalette questionIds={questionIds} states={attempt.states} currentIndex={attempt.currentIndex} onJump={goTo} />
          <p className="muted">Answered {counts?.answered} · Unanswered {counts?.unanswered} · Marked {counts?.marked}</p>
          <button type="button" className="danger" onClick={() => setConfirm(true)}>Submit exam</button>
        </aside>
      </div>
      <footer className="exam-controls">
        <button type="button" className="ghost" disabled={attempt.currentIndex === 0} onClick={() => goTo(attempt.currentIndex - 1)}>Previous</button>
        <button type="button" className="ghost" onClick={() => updateCurrent(clearOption)}>Clear response</button>
        <button type="button" className="ghost" onClick={() => updateCurrent(toggleMark)}>
          {attempt.states[question.id]?.marked ? "Unmark review" : "Mark for review"}
        </button>
        <button type="button" className="ghost palette-toggle" onClick={() => setPaletteOpen(true)}>Question palette</button>
        <span className="spacer" />
        {isLast ? (
          <button type="button" className="primary" onClick={() => setConfirm(true)}>Submit exam</button>
        ) : (
          <button type="button" className="primary" onClick={() => goTo(attempt.currentIndex + 1)}>Save and next</button>
        )}
      </footer>
      {paletteOpen ? (
        <div className="mobile-drawer">
          <div className="overlay" onClick={() => setPaletteOpen(false)} />
          <div className="drawer" role="dialog" aria-label="Question palette">
            <QuestionPalette questionIds={questionIds} states={attempt.states} currentIndex={attempt.currentIndex} onJump={goTo} />
            <button type="button" className="ghost" onClick={() => setPaletteOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
      {confirm ? (
        <Dialog title="Submit examination?" onClose={() => setConfirm(false)}>
          <p>Answered: {counts?.answered}. Unanswered: {counts?.unanswered}. Marked for review: {counts?.marked}.</p>
          {(counts?.unanswered ?? 0) > 0 ? <p className="notice">Some questions are still unanswered.</p> : null}
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setConfirm(false)}>Return to exam</button>
            <button type="button" className="danger" onClick={() => finalize(exam, attempt, false)}>Confirm submit</button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
