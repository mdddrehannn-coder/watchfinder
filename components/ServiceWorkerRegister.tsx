"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => undefined);
    }).catch(() => {
      // PWA install still falls back to browser instructions if registration fails.
    });
  }, []);

  return null;
}
