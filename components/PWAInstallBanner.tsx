"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallManager";
import { trackEvent } from "@/lib/analytics";

const DISMISSED_AT_KEY = "watchfinder-install-banner-dismissed-at";
const LATER_UNTIL_KEY = "watchfinder-install-banner-later-until";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export default function PWAInstallBanner() {
  const pathname = usePathname();
  const { canPrompt, installed, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (installed || pathname.startsWith("/admin")) return;

    const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY) || 0);
    const dismissedRecently = dismissedAt && Date.now() - dismissedAt < WEEK_MS;
    const laterUntil = Number(localStorage.getItem(LATER_UNTIL_KEY) || 0);
    if (dismissedRecently || laterUntil > Date.now()) return;

    const showTimer = window.setTimeout(() => setVisible(true), 4000);
    const analyticsTimer = window.setTimeout(() => trackEvent({ event_type: "app_install_prompt_shown" }), 4000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(analyticsTimer);
    };
  }, [installed, pathname]);

  if (!visible || installed || pathname.startsWith("/admin")) return null;

  async function install() {
    const result = await promptInstall();
    if (result === "accepted" || result === "installed" || result === "manual") setVisible(false);
    if (result === "dismissed") later();
  }

  function later() {
    localStorage.setItem(LATER_UNTIL_KEY, String(Date.now() + DAY_MS));
    setVisible(false);
  }

  function dismissToday() {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <aside className="pwa-install-banner" aria-label="Install WatchFinder app">
      <div className="pwa-install-icon">
        <Image src="/icon-192-v3.png" width={44} height={44} alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>Install WatchFinder</strong>
        <span>Get quick access from your home screen.</span>
      </div>
      <div className="pwa-install-actions">
        <button className="button primary" type="button" onClick={install}>{canPrompt ? "Install" : "Show install steps"}</button>
        <button className="button ghost" type="button" onClick={later}>Later</button>
        <button className="icon-button" type="button" onClick={dismissToday} aria-label="Close install prompt">
          <X size={17} />
        </button>
      </div>
    </aside>
  );
}
