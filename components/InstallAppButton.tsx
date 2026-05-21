"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Info } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function fallbackInstruction() {
  if (typeof navigator === "undefined") return "Open your browser menu and choose Install app.";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "Tap Share, then Add to Home Screen.";
  if (/android/.test(ua)) return "Tap browser menu (three dots) and select Install app or Add to Home screen.";
  return "Use your browser install icon or menu to install WatchFinder.";
}

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setInstruction(fallbackInstruction());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setStatus("Install is available on this browser.");
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setStatus("App installed.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setStatus(instruction || fallbackInstruction());
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setStatus("Install started.");
    } else {
      setStatus("Installation cancelled.");
    }
    setPromptEvent(null);
  }

  if (installed) {
    return <p className="legal-badge"><CheckCircle2 size={16} /> App installed</p>;
  }

  return (
    <div className="install-app-actions">
      <button className="button primary install-button" type="button" onClick={install}>
        <Download size={18} /> Download WatchFinder App
      </button>
      <p className="install-help">
        <Info size={16} />
        {status || (promptEvent ? "Tap the button to install WatchFinder." : instruction)}
      </p>
    </div>
  );
}
