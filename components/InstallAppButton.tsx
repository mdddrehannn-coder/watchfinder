"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

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
  if (/android/.test(ua)) return "Open browser menu and tap Install app.";
  return "Open your browser menu and choose Install app.";
}

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    setInstalled(isStandalone());
    setInstruction(fallbackInstruction());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  }

  if (installed) {
    return <p className="legal-badge">App installed</p>;
  }

  return (
    <div className="install-app-actions">
      <button className="button primary" type="button" onClick={install} disabled={!promptEvent}>
        <Download size={18} /> Download My App
      </button>
      {!promptEvent ? <p className="muted">{instruction}</p> : null}
    </div>
  );
}
