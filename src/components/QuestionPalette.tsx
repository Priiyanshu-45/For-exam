import { getQuestionStatus, statusLabel } from "../engine/questionStatus";
import type { QuestionState, QuestionStatus } from "../types/exam";

const STATUSES: QuestionStatus[] = [
  "not-visited",
  "visited-unanswered",
  "answered",
  "marked",
  "answered-marked",
];

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
      <div className="palette" role="list">
        {questionIds.map((id, index) => {
          const status = getQuestionStatus(states[id]);
          return (
            <button
              key={id}
              type="button"
              className={`st-${status} ${index === currentIndex ? "current" : ""}`}
              aria-current={index === currentIndex ? "true" : undefined}
              aria-label={`Question ${index + 1}, ${statusLabel(status)}`}
              onClick={() => onJump(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      <div className="legend">
        {STATUSES.map((status) => (
          <span key={status}>
            <i className={`swatch st-${status}`} aria-hidden="true" />
            {statusLabel(status)} ({counts[status]})
          </span>
        ))}
      </div>
    </div>
  );
}
