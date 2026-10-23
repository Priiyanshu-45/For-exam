import { NavLink } from "react-router-dom";
import type { UserPreferences } from "../types/exam";

export function AppHeader({
  prefs,
  onPrefs,
}: {
  prefs: UserPreferences;
  onPrefs: (next: UserPreferences) => void;
}) {
  return (
    <header className="app-header">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="brand">
        <strong>UP PET Practice</strong>
        <span>Computer-based mock examination</span>
      </div>
      <nav className="nav" aria-label="Primary">
        <NavLink to="/" end>Library</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/manage">Manage exams</NavLink>
        <button
          type="button"
          className={`ghost theme-toggle ${prefs.theme === "dark" ? "is-dark" : "is-light"}`}
          onClick={() => onPrefs({ ...prefs, theme: prefs.theme === "dark" ? "light" : "dark" })}
          aria-label={prefs.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {prefs.theme === "dark" ? "☀️ Light mode" : "🌙 Dark mode"}
        </button>
      </nav>
    </header>
  );
}
