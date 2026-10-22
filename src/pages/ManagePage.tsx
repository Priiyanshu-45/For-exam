import { useState } from "react";
import type { LibrarySnapshot } from "../data/examLibrary";
import { parseExamPaper, validateExamPaper } from "../engine/validateExam";
import { deleteImportedExam, saveImportedExam } from "../data/importedLibrary";
import type { ExamPaper, ExamValidation, RegistryExam } from "../types/exam";

export function ManagePage({
  library,
  onChange,
}: {
  library: LibrarySnapshot;
  onChange: () => void;
}) {
  const [preview, setPreview] = useState<{ paper: ExamPaper; validation: ExamValidation } | null>(null);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [shift, setShift] = useState("");
  const [category, setCategory] = useState("custom");
  const [message, setMessage] = useState<string | null>(null);

  const onFile = async (file: File | null) => {
    setMessage(null);
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const parsed = parseExamPaper(raw);
      if (!parsed.paper) {
        setPreview(null);
        setMessage(parsed.issues.map((issue) => issue.message).join(" "));
        return;
      }
      const validation = validateExamPaper(parsed.paper);
      setPreview({ paper: parsed.paper, validation });
      setTitle(parsed.paper.title);
      setShift(parsed.paper.shift ?? "");
      setYear(parsed.paper.examDate?.slice(0, 4) ?? "");
    } catch {
      setPreview(null);
      setMessage("The selected file is not valid JSON.");
    }
  };

  const importExam = async () => {
    if (!preview) return;
    if (!preview.validation.ok) {
      setMessage("Fix validation errors before importing.");
      return;
    }
    const meta: RegistryExam = {
      id: preview.paper.examId,
      title: title.trim() || preview.paper.title,
      year: year ? Number(year) : null,
      examDate: preview.paper.examDate ?? null,
      shift: shift || preview.paper.shift,
      paperSet: preview.paper.paperSet,
      category,
      dataPath: `indexeddb://${preview.paper.examId}`,
      status: "published",
      source: "imported",
    };
    await saveImportedExam({
      id: preview.paper.examId,
      meta,
      paper: preview.paper,
      importedAt: Date.now(),
    });
    setMessage("Imported into this browser's local library. This does not write files to the website.");
    onChange();
  };

  const exportRegistry = () => {
    const blob = new Blob([JSON.stringify({
      schemaVersion: "1.0",
      defaults: library.defaults,
      exams: library.bundled,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "registry.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main id="main" className="page">
      <h1>Manage exams</h1>
      <p className="notice">
        Bundled exams come from <code>public/exams/registry.json</code>. A static site cannot save new files onto the server.
        Imports below live in IndexedDB on this browser until you export them.
      </p>
      <section className="card">
        <h2>Bundled registry</h2>
        {library.bundled.map((exam) => (
          <p key={exam.id}>{exam.title} · {exam.questionCount ?? "?"} questions · {exam.dataPath}</p>
        ))}
        <button type="button" className="ghost" onClick={exportRegistry}>Export bundled registry</button>
      </section>
      <section className="card">
        <h2>Import a local JSON file</h2>
        <input type="file" accept="application/json,.json" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
        {preview ? (
          <>
            <p>{preview.paper.title} · {preview.validation.questionCount} questions · unresolved keys: {preview.validation.unresolvedQuestionIds.length}</p>
            <p>{preview.validation.ok ? "Validation passed" : "Validation failed"} ({preview.validation.issues.length} issue(s))</p>
            <ul>
              {preview.validation.issues.slice(0, 8).map((issue) => (
                <li key={`${issue.code}-${issue.questionId}`}>{issue.level}: {issue.message}</li>
              ))}
            </ul>
            <div className="toolbar">
              <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Exam title" />
              <input value={year} onChange={(event) => setYear(event.target.value)} aria-label="Year" placeholder="Year" />
              <input value={shift} onChange={(event) => setShift(event.target.value)} aria-label="Shift" placeholder="Shift" />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="custom">custom</option>
                <option value="mock">mock</option>
                <option value="previous-year">previous-year</option>
              </select>
            </div>
            <button type="button" className="primary" onClick={importExam}>Import into local library</button>
          </>
        ) : null}
        {message ? <p className="notice">{message}</p> : null}
      </section>
      <section className="card">
        <h2>Browser-local imports</h2>
        {library.imported.map((exam) => (
          <div key={exam.id} className="actions">
            <span>{exam.title} ({exam.questionCount} questions)</span>
            <button type="button" className="ghost" onClick={async () => {
              if (confirm(`Remove ${exam.title} from this browser? Attempt history is kept.`)) {
                await deleteImportedExam(exam.id);
                onChange();
              }
            }}>Remove</button>
          </div>
        ))}
        {library.imported.length === 0 ? <p className="muted">No imported exams in this browser.</p> : null}
      </section>
    </main>
  );
}
