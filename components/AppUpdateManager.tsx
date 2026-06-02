"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VersionInfo = {
  version?: string;
  updatedAt?: string;
};

const VERSION_STORAGE_KEY = "watchfinder_app_version";
const DISMISSED_VERSION_KEY = "watchfinder_update_later_version";
const CHECK_INTERVAL = 5 * 60 * 1000;

async function clearWatchFinderCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("watchfinder")).map((name) => caches.delete(name)));
  }
}

export default function AppUpdateManager() {
  const [visible, setVisible] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [message, setMessage] = useState("Refresh to get the latest WatchFinder changes.");
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  const showUpdate = useCallback((version: string, nextMessage?: string) => {
    if (localStorage.getItem(DISMISSED_VERSION_KEY) === version) return;
    setUpdateVersion(version);
    setMessage(nextMessage || "Refresh to get the latest WatchFinder changes.");
    setVisible(true);
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-store" }
      });
      if (!response.ok) return;
      const data = (await response.json()) as VersionInfo;
      const serverVersion = data.version || data.updatedAt;
      if (!serverVersion) return;

      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
      if (!storedVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
        return;
      }

      if (storedVersion !== serverVersion) {
        showUpdate(serverVersion);
      }
    } catch {
      // Update checks should never interrupt browsing.
    }
  }, [showUpdate]);

  useEffect(() => {
    checkVersion();
    const interval = window.setInterval(checkVersion, CHECK_INTERVAL);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkVersion();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registrationRef: ServiceWorkerRegistration | null = null;

    function watchRegistration(registration: ServiceWorkerRegistration) {
      registrationRef = registration;
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorkerRef.current = registration.waiting;
        showUpdate(updateVersion || "service-worker-update", "New WatchFinder update is ready.");
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = registration.waiting || installingWorker;
            showUpdate(updateVersion || "service-worker-update", "New WatchFinder update is ready.");
          }
        });
      });
    }

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        watchRegistration(registration);
        return registration.update();
      })
      .catch(() => {
        // The PWA remains usable even when service worker registration is unavailable.
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingRef.current) window.location.reload();
    });

    const updateTimer = window.setInterval(() => {
      registrationRef?.update().catch(() => undefined);
    }, CHECK_INTERVAL);

    return () => {
      window.clearInterval(updateTimer);
    };
  }, [showUpdate, updateVersion]);

  async function updateNow() {
    reloadingRef.current = true;
    if (updateVersion && updateVersion !== "service-worker-update") {
      localStorage.setItem(VERSION_STORAGE_KEY, updateVersion);
      localStorage.removeItem(DISMISSED_VERSION_KEY);
    }
    try {
      await clearWatchFinderCaches();
      waitingWorkerRef.current?.postMessage({ type: "SKIP_WAITING" });
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_WATCHFINDER_CACHE" });
    } finally {
      window.setTimeout(() => window.location.reload(), 250);
    }
  }

  function later() {
    if (updateVersion) localStorage.setItem(DISMISSED_VERSION_KEY, updateVersion);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="app-update-banner" role="status" aria-live="polite">
      <div>
        <strong>New update available</strong>
        <p>{message}</p>
      </div>
      <div className="app-update-actions">
        <button className="button primary" type="button" onClick={updateNow}>
          Update now
        </button>
        <button className="button ghost" type="button" onClick={later}>
          Later
        </button>
      </div>
    </div>
  );
}
