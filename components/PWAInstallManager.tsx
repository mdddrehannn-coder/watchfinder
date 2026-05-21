"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import PWAInstallInstructions, { type InstallPlatform } from "@/components/PWAInstallInstructions";

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

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
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
    setInstalled(isStandalone());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setStatus("Install is available on this browser.");
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setInstructionsOpen(false);
      setStatus("WatchFinder is already installed.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallResult> => {
    if (installed || isStandalone()) {
      setInstalled(true);
      setStatus("WatchFinder is already installed.");
      return "installed";
    }

    if (!promptEvent) {
      setInstructionsOpen(true);
      setStatus("Manual install instructions opened.");
      return "manual";
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);

    if (choice.outcome === "accepted") {
      setStatus("Install started.");
      return "accepted";
    }

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
