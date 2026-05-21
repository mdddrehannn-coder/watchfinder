"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STORAGE_KEY, THEME_EVENT } from "@/components/ThemeManager";

type ThemeMode = "auto" | "dark" | "light";

const OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  helper: string;
  Icon: LucideIcon;
}> = [
  {
    mode: "auto",
    label: "Auto",
    helper: "Day light, night dark",
    Icon: MonitorSmartphone
  },
  {
    mode: "dark",
    label: "Dark",
    helper: "Always use dark OTT mode",
    Icon: Moon
  },
  {
    mode: "light",
    label: "Light",
    helper: "Always use daytime mode",
    Icon: Sun
  }
];

export default function ThemeModeSelector() {
  const [mode, setMode] = useState<ThemeMode>("auto");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light" || saved === "auto") setMode(saved);
    } catch {
      setMode("auto");
    }
  }, []);

  function choose(nextMode: ThemeMode) {
    setMode(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
      window.dispatchEvent(new Event(THEME_EVENT));
    } catch {
      // Dark fallback remains active if localStorage is unavailable.
    }
  }

  return (
    <div className="theme-selector">
      <div className="option-group theme-option-group">
        {OPTIONS.map(({ mode: optionMode, label, helper, Icon }) => (
          <button
            className={mode === optionMode ? "option-card theme-option selected" : "option-card theme-option"}
            key={optionMode}
            onClick={() => choose(optionMode)}
            type="button"
          >
            <Icon size={20} />
            <span>{label}</span>
            <small>{helper}</small>
          </button>
        ))}
      </div>
      <p className="muted">Auto uses light theme from 6 AM to 6 PM and dark theme from 6 PM to 6 AM.</p>
    </div>
  );
}
