import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { loadLibrary, type LibrarySnapshot } from "./data/examLibrary";
import { loadPreferences, savePreferences } from "./data/persistence";
import { ExamPage } from "./pages/ExamPage";
import { HistoryPage } from "./pages/HistoryPage";
import { InstructionsPage } from "./pages/InstructionsPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ManagePage } from "./pages/ManagePage";
import { ResultsPage } from "./pages/ResultsPage";
import type { UserPreferences } from "./types/exam";

export default function App() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences);
  const [library, setLibrary] = useState<LibrarySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    loadLibrary()
      .then(setLibrary)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load exam registry."));
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    savePreferences(prefs);
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs]);

  return (
    <>
      <Routes>
        <Route path="/exam/:examId" element={<ExamPage />} />
        <Route
          path="*"
          element={
            <>
              <AppHeader prefs={prefs} onPrefs={setPrefs} />
              {error ? <p className="notice">{error}</p> : null}
              {!library ? <p className="page">Loading registry…</p> : (
                <Routes>
                  <Route path="/" element={<LibraryPage library={library} />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/manage" element={<ManagePage library={library} onChange={refresh} />} />
                  <Route path="/exam/:examId/instructions" element={<InstructionsPage />} />
                  <Route path="/results/:attemptId" element={<ResultsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </>
          }
        />
      </Routes>
    </>
  );
}
