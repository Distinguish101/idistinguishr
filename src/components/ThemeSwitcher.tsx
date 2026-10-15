"use client";

import { useState, type ChangeEvent } from "react";
import { THEMES, THEME_COOKIE, THEME_COOKIE_MAX_AGE, parseTheme, type ThemeId } from "@/lib/theme";

// A plain labelled <select>: works with a keyboard and screen readers, and on
// phones opens the native picker. Applies instantly (no reload) and saves the
// choice in a cookie so the next page the server renders matches.
export function ThemeSwitcher({ current }: { current: ThemeId }) {
  const [theme, setTheme] = useState<ThemeId>(current);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = parseTheme(e.target.value);
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  }

  return (
    <div className="theme-switch">
      <label htmlFor="theme-select">Theme</label>
      <select id="theme-select" value={theme} onChange={handleChange}>
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
