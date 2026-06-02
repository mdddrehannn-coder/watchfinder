"use client";

import { useEffect } from "react";
import { getThemeClass, resolveWatchFinderTheme, WATCHFINDER_THEME_STORAGE_KEY } from "@/lib/theme";

const THEME_EVENT = "watchfinder-theme-change";

function applyTheme(mode?: string | null) {
  const selectedMode = mode === "dark" || mode === "light" || mode === "auto" ? mode : "dark";
  const themeClass = getThemeClass(resolveWatchFinderTheme(selectedMode));
  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(themeClass);
  document.documentElement.dataset.themeMode = selectedMode;
  let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = themeClass === "theme-light" ? "#f6f7fb" : "#090a0f";
}

export default function ThemeManager() {
  useEffect(() => {
    function readAndApply() {
      try {
        applyTheme(localStorage.getItem(WATCHFINDER_THEME_STORAGE_KEY));
      } catch {
        applyTheme("dark");
      }
    }

    readAndApply();
    const interval = window.setInterval(readAndApply, 60 * 1000);
    window.addEventListener("storage", readAndApply);
    window.addEventListener(THEME_EVENT, readAndApply);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", readAndApply);
      window.removeEventListener(THEME_EVENT, readAndApply);
    };
  }, []);

  return null;
}

export { WATCHFINDER_THEME_STORAGE_KEY as STORAGE_KEY, THEME_EVENT };
