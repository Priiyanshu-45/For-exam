import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../components/Dialog";
import { clearAllLocalData, deleteHistoryForExam, loadHistory } from "../data/persistence";
import { clearImportedExams } from "../data/importedLibrary";

export function HistoryPage() {
  const [history, setHistory] = useState(loadHistory());
  const [clearOpen, setClearOpen] = useState(false);

  return (
    <main id="main" className="page">
      <h1>Attempt history</h1>
      <p className="muted">Results stay in this browser. They are not synced and can be lost if site data is cleared.</p>
      <div className="review-grid">
        {history.map((item) => (
          <article className="card" key={item.attemptId}>
            <h2>{item.examTitle}</h2>
            <p>{new Date(item.submittedAt).toLocaleString()} · {item.score}/{item.maxMarks}{item.percentage != null ? ` (${item.percentage}%)` : ""} · {item.autoSubmitted ? "Auto-submitted" : "Submitted"}</p>
            <div className="actions">
              <Link className="primary" to={`/results/${item.attemptId}`}>Open result</Link>
              <button type="button" className="ghost" onClick={() => {
                if (confirm(`Delete all stored results for ${item.examTitle}?`)) {
                  deleteHistoryForExam(item.examId);
                  setHistory(loadHistory());
                }
              }}>Delete this exam's history</button>
            </div>
          </article>
        ))}
      </div>
      {history.length === 0 ? <p className="notice">No completed attempts yet.</p> : null}
      <div className="actions">
        <button type="button" className="danger" onClick={() => setClearOpen(true)}>Clear all local data</button>
      </div>
      {clearOpen ? (
        <Dialog title="Clear local data?" onClose={() => setClearOpen(false)}>
          <p>This removes in-progress attempts, results, preferences, and browser-imported exams from this device. Bundled exam files are not deleted.</p>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setClearOpen(false)}>Cancel</button>
            <button type="button" className="danger" onClick={async () => {
              clearAllLocalData();
              await clearImportedExams();
              setHistory([]);
              setClearOpen(false);
            }}>Clear everything</button>
          </div>
        </Dialog>
      ) : null}
    </main>
  );
}
