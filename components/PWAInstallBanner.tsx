"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallManager";

const DISMISSED_AT_KEY = "watchfinder-install-banner-dismissed-at";
const LATER_KEY = "watchfinder-install-banner-later-session";
const DAY_MS = 24 * 60 * 60 * 1000;

export default function PWAInstallBanner() {
  const pathname = usePathname();
  const { installed, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (installed || pathname.startsWith("/admin")) return;

    const dismissedAt = Number(localStorage.getItem(DISMISSED_AT_KEY) || 0);
    const dismissedToday = dismissedAt && Date.now() - dismissedAt < DAY_MS;
    const laterThisSession = sessionStorage.getItem(LATER_KEY) === "1";
    if (dismissedToday || laterThisSession) return;

    const showTimer = window.setTimeout(() => setVisible(true), 1000);
    const hideTimer = window.setTimeout(() => setVisible(false), 9000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [installed, pathname]);

  if (!visible || installed || pathname.startsWith("/admin")) return null;

  async function install() {
    const result = await promptInstall();
    if (result === "accepted" || result === "installed") setVisible(false);
  }

  function later() {
    sessionStorage.setItem(LATER_KEY, "1");
    setVisible(false);
  }

  function dismissToday() {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setVisible(false);
  }

  return (
    <aside className="pwa-install-banner" aria-label="Install WatchFinder app">
      <div className="pwa-install-icon">
        <Image src="/icon-192-v2.png" width={44} height={44} alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>Install WatchFinder App</strong>
        <span>Get quick access from your home screen.</span>
      </div>
      <div className="pwa-install-actions">
        <button className="button primary" type="button" onClick={install}>Install</button>
        <button className="button ghost" type="button" onClick={later}>Later</button>
        <button className="icon-button" type="button" onClick={dismissToday} aria-label="Don't show today">
          <X size={17} />
        </button>
      </div>
    </aside>
  );
}
