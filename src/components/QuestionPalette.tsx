import { getQuestionStatus, statusLabel } from "../engine/questionStatus";
import type { QuestionState, QuestionStatus } from "../types/exam";

const STATUSES: QuestionStatus[] = [
  "not-visited",
  "visited-unanswered",
  "answered",
  "marked",
  "answered-marked",
];

const STATUS_SYMBOL: Record<QuestionStatus, string> = {
  "not-visited": "",
  "visited-unanswered": "•",
  answered: "✓",
  marked: "⚑",
  "answered-marked": "✓⚑",
};

export function QuestionPalette({
  questionIds,
  states,
  currentIndex,
  onJump,
}: {
  questionIds: string[];
  states: Record<string, QuestionState>;
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<QuestionStatus, number>;
  for (const id of questionIds) counts[getQuestionStatus(states[id])] += 1;

  return (
    <div>
      <p className="muted">Question palette</p>
      <div className="palette" role="list" onKeyDown={(event) => {
        const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 };
        const current = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-qindex]");
        if (!current || !["Home", "End", ...Object.keys(steps)].includes(event.key)) return;
        event.preventDefault();
        const currentIndex = Number(current.dataset.qindex);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End"
          ? questionIds.length - 1
          : Math.max(0, Math.min(questionIds.length - 1, currentIndex + steps[event.key]));
        event.currentTarget.querySelector<HTMLButtonElement>(`button[data-qindex="${nextIndex}"]`)?.focus();
      }}>
        {questionIds.map((id, index) => {
          const status = getQuestionStatus(states[id]);
          return (
            <button
              key={id}
              type="button"
              className={`st-${status} ${index === currentIndex ? "current" : ""}`}
              aria-current={index === currentIndex ? "true" : undefined}
              aria-label={`Question ${index + 1}, ${statusLabel(status)}`}
              data-qindex={index}
              onClick={() => onJump(index)}
            >
              <span>{index + 1}</span>{STATUS_SYMBOL[status] ? <sup className="st-glyph" aria-hidden="true">{STATUS_SYMBOL[status]}</sup> : null}
            </button>
          );
        })}
      </div>
      <div className="legend">
        {STATUSES.map((status) => (
          <span key={status}>
            <i className={`swatch st-${status}`} aria-hidden="true">{STATUS_SYMBOL[status]}</i>
            {statusLabel(status)} ({counts[status]})
          </span>
        ))}
      </div>
    </div>
  );
}
