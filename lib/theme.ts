export type WatchFinderThemeMode = "auto" | "dark" | "light";
export type WatchFinderTheme = "dark" | "light";

export const WATCHFINDER_THEME_STORAGE_KEY = "watchfinder-theme-mode";

export function resolveWatchFinderTheme(mode?: string | null, date = new Date()): WatchFinderTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (mode !== "auto") return "dark";
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

export function getActiveTheme(): WatchFinderTheme {
  if (typeof window === "undefined") return "dark";
  try {
    return resolveWatchFinderTheme(localStorage.getItem(WATCHFINDER_THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function getThemeClass(theme: WatchFinderTheme) {
  return theme === "light" ? "theme-light" : "theme-dark";
}
