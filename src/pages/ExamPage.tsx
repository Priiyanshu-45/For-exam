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
  loadPreferences,
  saveActiveAttempt,
  savePreferences,
  appendResult,
} from "../data/persistence";
import { addTimeSpent, attemptCounts, clearOption, isAttemptExpired, selectOption, toggleMark, visitQuestion } from "../engine/attempt";
import { applyOptionClick, type ClickMemory } from "../engine/optionClick";
import { scoreAttempt } from "../engine/scoring";
import { formatDuration, remainingMs, timerUrgency } from "../engine/timer";
import type { ActiveAttempt, LanguageMode, QuestionState, ResolvedExam } from "../types/exam";

export function ExamPage() {
  const { examId = "" } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ResolvedExam | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [desktopPaletteCollapsed, setDesktopPaletteCollapsed] = useState(false);
  const lastClick = useRef<ClickMemory | null>(null);
  const lastTick = useRef(Date.now());
  const lastPersist = useRef(Date.now());
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
        const stored = loadActiveAttempt(examId);
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
    const states = { ...next.states };
    const previous = attemptRef.current;
    if (previous) {
      for (const [id, state] of Object.entries(previous.states)) {
        const incoming = states[id];
        if (incoming) states[id] = { ...incoming, timeSpentMs: Math.max(incoming.timeSpentMs, state.timeSpentMs) };
      }
    }
    const synchronized = { ...next, states };
    attemptRef.current = synchronized;
    setAttempt(synchronized);
    saveActiveAttempt(synchronized);
    lastPersist.current = Date.now();
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
    clearActiveAttempt(resolved.registry.id);
    navigate(`/results/${result.attemptId}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!attempt || !exam) return;
    const tick = () => {
      const now = Date.now();
      const current = attemptRef.current;
      if (!current || current.submitted) return;
      const delta = now - lastTick.current;
      lastTick.current = now;
      let next = current;
      const question = exam.questions[current.currentIndex];
      if (question && document.visibilityState === "visible" && delta > 0 && delta < 5_000) {
        const state = addTimeSpent(current.states[question.id], delta);
        next = { ...current, states: { ...current.states, [question.id]: state } };
        attemptRef.current = next;
      }
      const left = remainingMs(current.deadlineAt, now);
      setRemaining(left);
      if (left <= 0) {
        finalize(exam, next, true);
      } else if (now - lastPersist.current >= 5_000) {
        saveActiveAttempt(next);
        lastPersist.current = now;
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const saveNow = () => {
      const current = attemptRef.current;
      if (current && !current.submitted) {
        saveActiveAttempt(current);
        lastPersist.current = Date.now();
      }
    };
    const onVis = () => { saveNow(); tick(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", saveNow);
    window.addEventListener("beforeunload", saveNow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", saveNow);
      window.removeEventListener("beforeunload", saveNow);
    };
  }, [attempt?.attemptId, exam, finalize]);

  const questionIds = useMemo(() => exam?.questions.map((question) => question.id) ?? [], [exam]);
  const sections = useMemo(() => {
    if (!exam) return [];
    const map = new Map<string, { name: string; firstIndex: number; questionIds: string[] }>();
    exam.questions.forEach((item, index) => {
      const name = item.subject?.trim() || "General";
      const section = map.get(name);
      if (section) section.questionIds.push(item.id);
      else map.set(name, { name, firstIndex: index, questionIds: [item.id] });
    });
    return [...map.values()];
  }, [exam]);
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

  const updateCurrent = (mutator: (state: QuestionState) => QuestionState) => {
    const currentAttempt = attempt;
    if (!currentAttempt) return;
    const nextState = mutator(currentAttempt.states[question.id]);
    persist({ ...currentAttempt, states: { ...currentAttempt.states, [question.id]: nextState } });
    return nextState;
  };

  const onOption = (optionId: string) => {
    const currentAttempt = attempt;
    if (!currentAttempt) return;
    const result = applyOptionClick({
      selectedOptionId: currentAttempt.states[question.id]?.selectedOptionId ?? null,
      optionId,
      now: Date.now(),
      lastClick: lastClick.current,
    });
    lastClick.current = result.lastClick;
    const nextState = result.selectedOptionId
      ? selectOption(currentAttempt.states[question.id], result.selectedOptionId)
      : clearOption(currentAttempt.states[question.id]);
    const nextIndex = result.selectedOptionId && currentAttempt.autoAdvance && currentAttempt.currentIndex < exam.questions.length - 1
      ? currentAttempt.currentIndex + 1
      : currentAttempt.currentIndex;
    const nextQuestionId = exam.questions[nextIndex]?.id;
    const nextAttempt = {
      ...currentAttempt,
      currentIndex: nextIndex,
      states: {
        ...currentAttempt.states,
        [question.id]: nextState,
        ...(nextIndex !== currentAttempt.currentIndex && nextQuestionId
          ? { [nextQuestionId]: visitQuestion(currentAttempt.states[nextQuestionId]) }
          : {}),
      },
    };
    persist(nextAttempt);
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
        <button
          type="button"
          className="ghost palette-toggle-desktop"
          aria-expanded={!desktopPaletteCollapsed}
          onClick={() => setDesktopPaletteCollapsed((collapsed) => !collapsed)}
        >
          {desktopPaletteCollapsed ? "Show palette" : "Hide palette"}
        </button>
      </header>
      <div className={`exam-body ${desktopPaletteCollapsed ? "palette-collapsed" : ""}`}>
        <main id="main" className="question-pane">
          {sections.length > 1 ? (
            <nav className="section-tabs" aria-label="Exam sections">
              {sections.map((section) => {
                const answeredInSec = section.questionIds.filter((id) => Boolean(attempt.states[id]?.selectedOptionId)).length;
                const active = section.questionIds.includes(question.id);
                return (
                  <button
                    type="button"
                    key={section.name}
                    className={`section-tab ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => goTo(section.firstIndex)}
                  >
                    {section.name} ({answeredInSec}/{section.questionIds.length})
                  </button>
                );
              })}
            </nav>
          ) : null}
          <div className="toolbar">
            <label>
              Language{" "}
              <select
                value={mode}
                onChange={(event) => {
                  const languageMode = event.target.value as LanguageMode;
                  savePreferences({ ...loadPreferences(), languageMode });
                  persist({ ...attempt, languageMode });
                }}
                aria-label="Question language"
              >
                <option value="bilingual">Bilingual</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="check-control">
              <input
                type="checkbox"
                checked={attempt.autoAdvance}
                onChange={(event) => {
                  const autoAdvance = event.target.checked;
                  savePreferences({ ...loadPreferences(), autoAdvance });
                  persist({ ...attempt, autoAdvance });
                }}
              />
              Auto-advance
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
        <button type="button" className="ghost palette-toggle palette-toggle-mobile" onClick={() => setPaletteOpen(true)}>Question palette</button>
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
