"use client";

import { useEffect } from "react";

const STORAGE_KEY = "watchfinder-theme-mode";
const THEME_EVENT = "watchfinder-theme-change";

function getAutoTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "theme-light" : "theme-dark";
}

function applyTheme(mode?: string | null) {
  const selectedMode = mode === "dark" || mode === "light" ? mode : "auto";
  const themeClass = selectedMode === "auto" ? getAutoTheme() : `theme-${selectedMode}`;
  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(themeClass);
  document.documentElement.dataset.themeMode = selectedMode;
}

export default function ThemeManager() {
  useEffect(() => {
    function readAndApply() {
      try {
        applyTheme(localStorage.getItem(STORAGE_KEY));
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

export { STORAGE_KEY, THEME_EVENT };
