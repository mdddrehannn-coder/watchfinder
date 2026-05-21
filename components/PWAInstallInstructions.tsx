"use client";

import { X } from "lucide-react";

export type InstallPlatform = "android" | "ios" | "desktop";

const COPY: Record<InstallPlatform, { title: string; steps: string[] }> = {
  android: {
    title: "Install WatchFinder",
    steps: [
      "Tap the browser menu (three dots).",
      "Tap Install app or Add to Home screen.",
      "Confirm Install."
    ]
  },
  ios: {
    title: "Add WatchFinder to Home Screen",
    steps: [
      "Tap the Share button.",
      "Tap Add to Home Screen.",
      "Tap Add."
    ]
  },
  desktop: {
    title: "Install WatchFinder",
    steps: [
      "Look for the install icon in the address bar.",
      "Or open your browser menu.",
      "Choose Install WatchFinder."
    ]
  }
};

export default function PWAInstallInstructions({
  open,
  platform,
  onClose
}: {
  open: boolean;
  platform: InstallPlatform;
  onClose: () => void;
}) {
  if (!open) return null;

  const copy = COPY[platform];

  return (
    <div className="install-modal-backdrop" role="presentation">
      <section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-modal-title">
        <button className="icon-button install-modal-close" type="button" onClick={onClose} aria-label="Close install instructions">
          <X size={18} />
        </button>
        <h2 id="install-modal-title">{copy.title}</h2>
        <ol>
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="muted">Some browsers do not support direct install prompts.</p>
        <button className="button primary" type="button" onClick={onClose}>
          Got it
        </button>
      </section>
    </div>
  );
}
