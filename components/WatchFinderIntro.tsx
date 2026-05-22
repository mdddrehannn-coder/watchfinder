"use client";

import { useEffect, useState } from "react";

const INTRO_KEY = "watchfinder_intro_seen";

export default function WatchFinderIntro() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(INTRO_KEY) === "true") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sessionStorage.setItem(INTRO_KEY, "true");
    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, reducedMotion ? 1000 : 2800);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="watchfinder-intro" aria-label="WatchFinder loading intro" role="status">
      <div className="intro-glow" />
      <div className="intro-w-mark" aria-hidden="true">
        <span className="intro-ribbon intro-ribbon-left" />
        <span className="intro-ribbon intro-ribbon-middle-back" />
        <span className="intro-ribbon intro-ribbon-middle-front" />
        <span className="intro-ribbon intro-ribbon-right" />
      </div>
      <p>Loading WatchFinder...</p>
    </div>
  );
}
