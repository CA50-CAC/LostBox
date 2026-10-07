/**
 * The light/dark theme choice: System (follow the device), Light, or Dark.
 *
 * The choice lives in a cookie, not localStorage, so the server already knows
 * it when it builds the page and can put data-theme on <html>. That means the
 * very first paint has the right colors (no flash of the wrong theme) and no
 * script has to run first. "System" stores nothing on <html>; the
 * prefers-color-scheme media query in globals.css picks.
 *
 * The cookie only ever holds one of three words. Anything else is treated as
 * "system", so a tampered cookie can't put arbitrary text into the page.
 */
export const THEME_COOKIE = "lb_theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Page background per theme, for the browser's theme-color (address bar). Must match --background in globals.css. */
export const THEME_BACKGROUND = { light: "#ffffff", dark: "#0b1424" } as const;

export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/** The data-theme attribute for <html>: nothing for System, so CSS follows the device. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
