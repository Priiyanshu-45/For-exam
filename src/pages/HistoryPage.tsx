import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import {
  clearAllLocalData,
  deleteAttemptResult,
  deleteHistoryForExam,
  loadHistory,
} from "../data/persistence";
import { clearImportedExams } from "../data/importedLibrary";

export function HistoryPage() {
  const [history, setHistory] = useState(loadHistory());
  const [clearOpen, setClearOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<{ examId: string; title: string } | null>(null);
  const [attemptToDelete, setAttemptToDelete] = useState<{ attemptId: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearData = async () => {
    try {
      clearAllLocalData();
      await clearImportedExams();
      setHistory([]);
      setClearOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear browser data.");
    }
  };

  return (
    <main id="main" className="page">
      <h1>Attempt history</h1>
      <p className="muted">Results stay in this browser. They are not synced and can be lost if site data is cleared.</p>
      {error ? <p className="notice" role="alert">{error}</p> : null}
      <div className="review-grid">
        {history.map((item) => (
          <article className="card" key={item.attemptId}>
            <h2>{item.examTitle}</h2>
            <p>{new Date(item.submittedAt).toLocaleString()} · {item.score}/{item.maxMarks}{item.percentage != null ? ` (${item.percentage}%)` : ""} · {item.autoSubmitted ? "Auto-submitted" : "Submitted"}</p>
            <div className="actions">
              <Link className="primary" to={`/results/${item.attemptId}`}>Open result</Link>
              <button type="button" className="ghost" onClick={() => setAttemptToDelete({ attemptId: item.attemptId, title: item.examTitle })}>Delete this attempt</button>
              <button type="button" className="ghost" onClick={() => setExamToDelete({ examId: item.examId, title: item.examTitle })}>Delete this exam's history</button>
            </div>
          </article>
        ))}
      </div>
      {history.length === 0 ? <p className="notice">No completed attempts yet.</p> : null}
      <div className="actions">
        <button type="button" className="danger" onClick={() => setClearOpen(true)}>Clear all local data</button>
      </div>
      {attemptToDelete ? (
        <Dialog title="Delete this attempt?" onClose={() => setAttemptToDelete(null)}>
          <p>Delete the result for {attemptToDelete.title}? Other attempts and the exam remain untouched.</p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setAttemptToDelete(null)}>Cancel</button>
            <button type="button" className="danger" onClick={() => {
              deleteAttemptResult(attemptToDelete.attemptId);
              setHistory(loadHistory());
              setAttemptToDelete(null);
            }}>Delete attempt</button>
          </div>
        </Dialog>
      ) : null}
      {examToDelete ? (
        <Dialog title="Delete exam history?" onClose={() => setExamToDelete(null)}>
          <p>Delete all stored results for {examToDelete.title}?</p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setExamToDelete(null)}>Cancel</button>
            <button type="button" className="danger" onClick={() => {
              deleteHistoryForExam(examToDelete.examId);
              setHistory(loadHistory());
              setExamToDelete(null);
            }}>Delete exam history</button>
          </div>
        </Dialog>
      ) : null}
      {clearOpen ? (
        <Dialog title="Clear local data?" onClose={() => setClearOpen(false)}>
          <p>This removes in-progress attempts, results, preferences, and browser-imported exams from this device. Bundled exam files are not deleted.</p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setClearOpen(false)}>Cancel</button>
            <button type="button" className="danger" onClick={() => void clearData()}>Clear everything</button>
          </div>
        </Dialog>
      ) : null}
    </main>
  );
}
