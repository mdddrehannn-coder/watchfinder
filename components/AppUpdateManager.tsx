"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePWAInstall } from "@/components/PWAInstallManager";
import { isAppInstalledOrStandalone } from "@/lib/pwa";

type VersionInfo = {
  version?: string;
  updatedAt?: string;
};

const VERSION_STORAGE_KEY = "watchfinder_app_version";
const UPDATE_LATER_UNTIL_KEY = "watchfinder_update_later_until";
const CHECK_INTERVAL = 5 * 60 * 1000;
const UPDATE_LATER_MS = 6 * 60 * 60 * 1000;

async function clearWatchFinderCaches() {
  if (!("caches" in window)) return;

  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("watchfinder")).map((name) => caches.delete(name)));
}

function laterIsActive() {
  return Number(localStorage.getItem(UPDATE_LATER_UNTIL_KEY) || 0) > Date.now();
}

export default function AppUpdateManager() {
  const { installed } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const versionRef = useRef<string | null>(null);
  const reloadingRef = useRef(false);
  const installedRef = useRef(false);

  useEffect(() => {
    installedRef.current = installed || isAppInstalledOrStandalone();
    if (!installedRef.current) setVisible(false);
  }, [installed]);

  const showUpdate = useCallback((version?: string | null) => {
    if (!installedRef.current || !waitingWorkerRef.current) return;
    if (laterIsActive()) return;

    const nextVersion = version || versionRef.current || "service-worker-update";
    setUpdateVersion(nextVersion);
    setVisible(true);
  }, []);

  const checkVersion = useCallback(async () => {
    if (!installedRef.current) return;

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-store" }
      });
      if (!response.ok) return;

      const data = (await response.json()) as VersionInfo;
      const serverVersion = data.version || data.updatedAt;
      if (!serverVersion) return;

      versionRef.current = serverVersion;
      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
      if (!storedVersion) {
        localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
        return;
      }

      if (storedVersion !== serverVersion && waitingWorkerRef.current) {
        showUpdate(serverVersion);
      }
    } catch {
      // Update checks should never interrupt browsing.
    }
  }, [showUpdate]);

  useEffect(() => {
    if (!installed) return undefined;

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
  }, [checkVersion, installed]);

  useEffect(() => {
    if (!installed || !("serviceWorker" in navigator)) return undefined;

    let registrationRef: ServiceWorkerRegistration | null = null;
    let disposed = false;
    const updateFoundCleanups: Array<() => void> = [];

    function watchRegistration(registration: ServiceWorkerRegistration) {
      registrationRef = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorkerRef.current = registration.waiting;
        showUpdate(versionRef.current);
      }

      function handleUpdateFound() {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        const worker: ServiceWorker = installingWorker;

        function handleStateChange() {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = registration.waiting || worker;
            showUpdate(versionRef.current);
          }
        }

        worker.addEventListener("statechange", handleStateChange);
        updateFoundCleanups.push(() => worker.removeEventListener("statechange", handleStateChange));
      }

      registration.addEventListener("updatefound", handleUpdateFound);
      updateFoundCleanups.push(() => registration.removeEventListener("updatefound", handleUpdateFound));
    }

    function handleControllerChange() {
      if (reloadingRef.current) window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    navigator.serviceWorker.ready
      .then((registration) => {
        if (disposed) return;
        watchRegistration(registration);
        registration.update().catch(() => undefined);
      })
      .catch(() => {
        // The PWA remains usable even when service worker update checks are unavailable.
      });

    const updateTimer = window.setInterval(() => {
      registrationRef?.update().catch(() => undefined);
    }, CHECK_INTERVAL);

    return () => {
      disposed = true;
      window.clearInterval(updateTimer);
      updateFoundCleanups.forEach((cleanup) => cleanup());
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [installed, showUpdate]);

  async function updateNow() {
    reloadingRef.current = true;
    localStorage.removeItem(UPDATE_LATER_UNTIL_KEY);
    if (updateVersion && updateVersion !== "service-worker-update") {
      localStorage.setItem(VERSION_STORAGE_KEY, updateVersion);
    }

    try {
      await clearWatchFinderCaches();
      waitingWorkerRef.current?.postMessage({ type: "SKIP_WAITING" });
    } finally {
      window.setTimeout(() => window.location.reload(), 350);
    }
  }

  function later() {
    localStorage.setItem(UPDATE_LATER_UNTIL_KEY, String(Date.now() + UPDATE_LATER_MS));
    setVisible(false);
  }

  if (!visible || !installed) return null;

  return (
    <div className="app-update-banner" role="status" aria-live="polite">
      <div>
        <strong>Update available</strong>
        <p>A new version of WatchFinder is ready.</p>
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
