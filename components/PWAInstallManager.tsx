"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import PWAInstallInstructions, { type InstallPlatform } from "@/components/PWAInstallInstructions";
import { trackEvent } from "@/lib/analytics";
import { isAppInstalledOrStandalone, markAppInstalled } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallResult = "installed" | "accepted" | "dismissed" | "manual";

type PWAInstallContextValue = {
  canPrompt: boolean;
  installed: boolean;
  status: string | null;
  platform: InstallPlatform;
  promptInstall: () => Promise<InstallResult>;
  showInstructions: () => void;
  clearStatus: () => void;
};

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null);

function getPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function devLog(message: string, data?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    if (typeof data === "undefined") console.info(`[WatchFinder PWA] ${message}`);
    else console.info(`[WatchFinder PWA] ${message}`, data);
  }
}

export function usePWAInstall() {
  const context = useContext(PWAInstallContext);
  if (!context) throw new Error("usePWAInstall must be used inside PWAInstallManager");
  return context;
}

export default function PWAInstallManager({ children }: { children: React.ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const platform = useMemo(getPlatform, []);

  useEffect(() => {
    const currentlyInstalled = isAppInstalledOrStandalone();
    setInstalled(currentlyInstalled);
    if (currentlyInstalled) markAppInstalled();

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      devLog("beforeinstallprompt fired");
      if (isAppInstalledOrStandalone()) {
        setInstalled(true);
        setPromptEvent(null);
        return;
      }
      setPromptEvent(event as BeforeInstallPromptEvent);
      setStatus("Install is ready.");
    }

    function handleInstalled() {
      devLog("appinstalled fired");
      setInstalled(true);
      setPromptEvent(null);
      setInstructionsOpen(false);
      markAppInstalled();
      setStatus("Watch Finder installed successfully.");
      trackEvent({ event_type: "app_installed" });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallResult> => {
    trackEvent({ event_type: "app_install_clicked" });
    if (installed || isAppInstalledOrStandalone()) {
      setInstalled(true);
      markAppInstalled();
      setStatus("Watch Finder is already installed.");
      return "installed";
    }

    if (!promptEvent) {
      devLog("unsupported browser fallback");
      setInstructionsOpen(true);
      setStatus("Install prompt is not available in this browser. Follow the steps below.");
      return "manual";
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);

    if (choice.outcome === "accepted") {
      devLog("install accepted");
      markAppInstalled();
      setStatus("Watch Finder installed successfully.");
      return "accepted";
    }

    devLog("install dismissed");
    setStatus("Installation cancelled.");
    return "dismissed";
  }, [installed, promptEvent]);

  const value = useMemo<PWAInstallContextValue>(
    () => ({
      canPrompt: Boolean(promptEvent),
      installed,
      status,
      platform,
      promptInstall,
      showInstructions: () => setInstructionsOpen(true),
      clearStatus: () => setStatus(null)
    }),
    [promptEvent, installed, status, platform, promptInstall]
  );

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
      <PWAInstallInstructions open={instructionsOpen} platform={platform} onClose={() => setInstructionsOpen(false)} />
    </PWAInstallContext.Provider>
  );
}
