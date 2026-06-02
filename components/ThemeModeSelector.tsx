"use client";

import { useEffect, useState } from "react";
import { Check, MonitorSmartphone, Moon, Sun } from "lucide-react";
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
    label: "Auto Theme",
    helper: "Uses Day theme from 6 AM to 6 PM and Night theme from 6 PM to 6 AM.",
    Icon: MonitorSmartphone
  },
  {
    mode: "dark",
    label: "Night / Dark Theme",
    helper: "Always use dark OTT theme.",
    Icon: Moon
  },
  {
    mode: "light",
    label: "Day / Light Theme",
    helper: "Always use clean light theme.",
    Icon: Sun
  }
];

export default function ThemeModeSelector() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light" || saved === "auto") setMode(saved);
    } catch {
      setMode("dark");
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
            <span className="theme-option-head">
              <Icon size={20} />
              <span>{label}</span>
              {mode === optionMode ? <span className="active-badge"><Check size={14} /> Active</span> : null}
            </span>
            <small>{helper}</small>
          </button>
        ))}
      </div>
      <p className="muted">Auto uses light theme from 6 AM to 6 PM and dark theme from 6 PM to 6 AM.</p>
    </div>
  );
}
