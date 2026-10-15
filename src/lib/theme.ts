// The site's visual themes. Each is a set of design tokens in globals.css,
// selected by the data-theme attribute on <html>. The choice is remembered in
// a cookie so the server can render the right theme on the first paint (no
// flash of the wrong one).
export const THEMES = [
  { id: "cobalt", label: "Cobalt" },
  { id: "slate", label: "Slate" },
  { id: "midnight", label: "Midnight" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "cobalt";
export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: string | null | undefined): ThemeId {
  return THEMES.find((t) => t.id === value)?.id ?? DEFAULT_THEME;
}

export function isTheme(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}
