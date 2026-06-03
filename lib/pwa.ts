const INSTALLED_KEY = "watchfinder_pwa_installed";

export function isRunningAsPWA() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function hasInstalledFlag() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAppInstalled() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Install state is still detectable from standalone mode in supported browsers.
  }
}

export function isAppInstalledOrStandalone() {
  return isRunningAsPWA() || hasInstalledFlag();
}
