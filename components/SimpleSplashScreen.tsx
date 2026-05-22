"use client";

import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

const SPLASH_KEY = "watchfinder_splash_seen";

export default function SimpleSplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY) === "true") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sessionStorage.setItem(SPLASH_KEY, "true");
    setVisible(true);

    const timer = window.setTimeout(() => setVisible(false), reducedMotion ? 1000 : 1700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="simple-splash-screen" aria-label="Opening WatchFinder" role="status">
      <div className="simple-splash-logo">
        <BrandLogo href="" variant="splash" showText={false} />
      </div>
      <p>WatchFinder</p>
    </div>
  );
}
