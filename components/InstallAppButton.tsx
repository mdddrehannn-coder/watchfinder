"use client";

import { CheckCircle2, Download, Info } from "lucide-react";
import { usePWAInstall } from "@/components/PWAInstallManager";

export default function InstallAppButton() {
  const { canPrompt, installed, platform, promptInstall, status } = usePWAInstall();

  async function install() {
    await promptInstall();
  }

  function fallbackText() {
    if (canPrompt) return "Tap the button to install WatchFinder.";
    if (platform === "ios") return "Tap Install to see Add to Home Screen steps.";
    if (platform === "android") return "Tap Install for the browser prompt or Android steps.";
    return "Tap Install for browser install steps.";
  }

  if (installed) {
    return <p className="legal-badge"><CheckCircle2 size={16} /> WatchFinder is already installed.</p>;
  }

  return (
    <div className="install-app-actions">
      <button className="button primary install-button" type="button" onClick={install}>
        <Download size={18} /> {canPrompt ? "Install WatchFinder" : "Show install steps"}
      </button>
      <p className="install-help">
        <Info size={16} />
        {status || fallbackText()}
      </p>
    </div>
  );
}
