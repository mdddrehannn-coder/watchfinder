"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallManager";
import { trackEvent } from "@/lib/analytics";
import { isAppInstalledOrStandalone } from "@/lib/pwa";

const DISMISSED_AT_KEY = "watchfinder_install_dismissed_at";
const LEGACY_DISMISSED_AT_KEY = "watchfinder-install-banner-dismissed-at";
const LEGACY_LATER_UNTIL_KEY = "watchfinder-install-banner-later-until";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3500;

function isHiddenRoute(pathname: string) {
  return pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/settings");
}

function dismissedRecently() {
  try {
    const dismissedAt = Number(
      localStorage.getItem(DISMISSED_AT_KEY) ||
      localStorage.getItem(LEGACY_DISMISSED_AT_KEY) ||
      0
    );
    const legacyLaterUntil = Number(localStorage.getItem(LEGACY_LATER_UNTIL_KEY) || 0);
    return (dismissedAt > 0 && Date.now() - dismissedAt < WEEK_MS) || legacyLaterUntil > Date.now();
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    localStorage.removeItem(LEGACY_LATER_UNTIL_KEY);
  } catch {
    // Dismiss state is best-effort only.
  }
}

export default function PWAInstallPrompt() {
  const pathname = usePathname();
  const { canPrompt, installed, platform, promptInstall, showInstructions } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  const shouldOfferFallback = platform === "ios" && !canPrompt;
  const canShow = useMemo(() => {
    if (installed || isHiddenRoute(pathname)) return false;
    if (typeof window === "undefined") return false;
    if (isAppInstalledOrStandalone()) return false;
    return canPrompt || shouldOfferFallback;
  }, [canPrompt, installed, pathname, shouldOfferFallback]);

  useEffect(() => {
    setVisible(false);
    setFallbackMode(false);
    if (!canShow) return undefined;
    if (dismissedRecently()) return undefined;

    const timer = window.setTimeout(() => {
      setFallbackMode(shouldOfferFallback);
      setVisible(true);
      trackEvent({ event_type: "app_install_prompt_shown" });
    }, SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [canShow, shouldOfferFallback]);

  if (!visible || !canShow) return null;

  async function install() {
    if (fallbackMode || !canPrompt) {
      showInstructions();
      return;
    }

    const result = await promptInstall();
    if (result === "accepted" || result === "installed") {
      setVisible(false);
      return;
    }

    if (result === "dismissed") {
      rememberDismissed();
      setVisible(false);
      return;
    }

    if (result === "manual") {
      setVisible(false);
    }
  }

  function dismiss() {
    rememberDismissed();
    setVisible(false);
  }

  return (
    <aside className="pwa-install-banner pwa-install-prompt" aria-label="Install Watch Finder app" role="dialog" aria-live="polite">
      <div className="pwa-install-icon">
        <Image src="/icon-192-v3.png" width={44} height={44} alt="" />
      </div>
      <div className="pwa-install-copy">
        <strong>Install Watch Finder</strong>
        <span>
          {fallbackMode
            ? "Install from Share -> Add to Home Screen."
            : "One tap access to movies, trailers, and official watch links."}
        </span>
      </div>
      <div className="pwa-install-actions">
        <button className="button primary" type="button" onClick={install}>
          {fallbackMode ? "Show steps" : "Install App"}
        </button>
        <button className="button ghost" type="button" onClick={dismiss}>Not now</button>
        <button className="icon-button" type="button" onClick={dismiss} aria-label="Close install prompt">
          <X size={17} />
        </button>
      </div>
    </aside>
  );
}
