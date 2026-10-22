import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { LibrarySnapshot } from "../data/examLibrary";
import { examHistory, loadActiveAttempt, loadHistory } from "../data/persistence";
import type { LibraryExam } from "../types/exam";

export function LibraryPage({ library }: { library: LibrarySnapshot }) {
  const history = loadHistory();
  const active = loadActiveAttempt();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [shift, setShift] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const years = [...new Set(library.exams.map((exam) => exam.year).filter(Boolean))] as number[];
  const shifts = [...new Set(library.exams.map((exam) => exam.shift).filter(Boolean))] as string[];
  const categories = [...new Set(library.exams.map((exam) => exam.category))];

  const completed = history.length;
  const latest = history[0];
  const best = history.reduce<number | null>((acc, item) => {
    if (item.percentage == null) return acc;
    return acc == null ? item.percentage : Math.max(acc, item.percentage);
  }, null);

  const exams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = library.exams.filter((exam) => {
      const attempted = examHistory(exam.id).length > 0;
      const hay = [exam.title, exam.shift, exam.paperSet, exam.year, exam.examDate, exam.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (needle && !hay.includes(needle)) return false;
      if (year !== "all" && String(exam.year) !== year) return false;
      if (shift !== "all" && exam.shift !== shift) return false;
      if (category !== "all" && exam.category !== category) return false;
      if (status === "attempted" && !attempted) return false;
      if (status === "not-attempted" && attempted) return false;
      return exam.validationOk !== false;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "oldest") return (a.examDate || String(a.year) || "").localeCompare(b.examDate || String(b.year) || "");
      if (sort === "score") {
        const aBest = bestFor(a.id);
        const bBest = bestFor(b.id);
        return (bBest ?? -1) - (aBest ?? -1);
      }
      return (b.examDate || String(b.year) || "").localeCompare(a.examDate || String(a.year) || "");
    });
    return rows;
  }, [library.exams, query, year, shift, category, status, sort]);

  return (
    <main id="main" className="page">
      <h1>Exam library</h1>
      <p className="muted">
        Papers are loaded from <code>public/exams/registry.json</code>. Adding a valid exam file and registry
        entry is enough; the interface does not hard-code individual papers. Browser-imported exams stay on this device only.
      </p>
      <section className="stats" aria-label="Library summary">
        <article className="stat"><div className="label">Available exams</div><div className="value">{library.exams.length}</div></article>
        <article className="stat"><div className="label">Completed attempts</div><div className="value">{completed}</div></article>
        <article className="stat"><div className="label">Best score</div><div className="value">{best == null ? "—" : `${best}%`}</div></article>
        <article className="stat"><div className="label">Latest score</div><div className="value">{latest ? `${latest.score}/${latest.maxMarks}` : "—"}</div></article>
      </section>
      {library.registryIssues.length > 0 ? (
        <p className="notice" role="status">
          Registry issues: {library.registryIssues.map((issue) => issue.message).join(" ")}
        </p>
      ) : null}
      <div className="toolbar">
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, year, shift, or paper set" aria-label="Search exams" />
        <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filter by year">
          <option value="all">All years</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={shift} onChange={(event) => setShift(event.target.value)} aria-label="Filter by shift">
          <option value="all">All shifts</option>
          {shifts.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by completion">
          <option value="all">All statuses</option>
          <option value="attempted">Attempted</option>
          <option value="not-attempted">Not attempted</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort exams">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="score">Previous performance</option>
        </select>
      </div>
      <div className="exam-grid">
        {exams.map((exam) => (
          <ExamCard key={`${exam.source}-${exam.id}`} exam={exam} activeId={active?.examId} />
        ))}
      </div>
      {exams.length === 0 ? <p className="notice">No published exams match the current filters.</p> : null}
    </main>
  );
}

function bestFor(examId: string): number | null {
  const rows = examHistory(examId);
  return rows.reduce<number | null>((acc, item) => {
    if (item.percentage == null) return acc;
    return acc == null ? item.percentage : Math.max(acc, item.percentage);
  }, null);
}

function ExamCard({ exam, activeId }: { exam: LibraryExam; activeId?: string }) {
  const attempts = examHistory(exam.id);
  const last = attempts[0];
  const canResume = activeId === exam.id;
  const marking = exam.markingScheme;
  const markingText = marking && typeof marking.marksPerCorrect === "number"
    ? `+${marking.marksPerCorrect} / ${marking.marksPerIncorrect ?? 0} / ${marking.marksPerUnattempted ?? 0}`
    : "See instructions";
  return (
    <article className="card exam-card">
      <h2>{exam.title}</h2>
      <div className="meta">
        {exam.year ? <span className="chip">{exam.year}</span> : null}
        {exam.examDate ? <span className="chip">{exam.examDate}</span> : null}
        {exam.shift ? <span className="chip">{exam.shift}</span> : null}
        {exam.paperSet ? <span className="chip">{exam.paperSet}</span> : null}
        <span className="chip">{exam.category}</span>
        {exam.source === "imported" ? <span className="chip warn">Browser import</span> : <span className="chip">Bundled</span>}
        {attempts.length ? <span className="chip ok">Attempted</span> : <span className="chip">Not attempted</span>}
      </div>
      <p className="muted">
        {exam.questionCount ?? "—"} questions · {exam.durationMinutes ?? "—"} min · marking {markingText}
      </p>
      {last ? <p>Previous score: {last.score}/{last.maxMarks}{last.percentage != null ? ` (${last.percentage}%)` : ""}</p> : null}
      <div className="actions">
        <Link className="primary" to={`/exam/${encodeURIComponent(exam.id)}/instructions`}>
          {canResume ? "Resume exam" : "Start exam"}
        </Link>
        {attempts.length ? <Link className="ghost" to={`/results/${attempts[0].attemptId}`}>Previous results</Link> : null}
      </div>
    </article>
  );
}
