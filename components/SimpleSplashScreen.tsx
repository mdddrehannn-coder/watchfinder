"use client";

import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { getActiveTheme } from "@/lib/theme";

const SPLASH_KEY = "watchfinder_splash_seen";

export default function SimpleSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY) === "true") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sessionStorage.setItem(SPLASH_KEY, "true");
    setTheme(getActiveTheme());
    setVisible(true);

    const timer = window.setTimeout(() => setVisible(false), reducedMotion ? 1000 : 1700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={`simple-splash-screen loader-${theme}`} aria-label="Opening WatchFinder" role="status">
      <div className="simple-splash-logo">
        <BrandLogo href="" variant="splash" showText={false} />
      </div>
      <p>WatchFinder</p>
    </div>
  );
}
