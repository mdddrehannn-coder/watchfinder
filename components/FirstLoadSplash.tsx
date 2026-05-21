"use client";

import { useEffect, useState } from "react";
import BrandLoader from "@/components/BrandLoader";

const SPLASH_KEY = "watchfinder-splash-seen";

export default function FirstLoadSplash() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
      sessionStorage.setItem(SPLASH_KEY, "true");
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), 1200);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="first-load-splash">
      <BrandLoader label="Loading..." />
    </div>
  );
}
