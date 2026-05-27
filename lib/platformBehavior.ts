import type { Platform } from "@/types/watchfinder";

export type PlatformOpenMode = "trailer_modal" | "in_app_browser" | "external";

export type PlatformBehavior = {
  internalMode: "embed" | "in_app_browser_try" | "external_only";
  fallback: "external_official";
  allowIframe: boolean;
  knownBlocksIframe?: boolean;
  allowedHosts: string[];
};

const platformBehaviors: Record<string, PlatformBehavior> = {
  youtube: {
    internalMode: "embed",
    fallback: "external_official",
    allowIframe: true,
    allowedHosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"]
  },
  hotstar: ottBehavior(["hotstar.com", "jiohotstar.com"]),
  jiohotstar: ottBehavior(["hotstar.com", "jiohotstar.com"]),
  "jio-hotstar": ottBehavior(["hotstar.com", "jiohotstar.com"]),
  "disney-hotstar": ottBehavior(["hotstar.com", "jiohotstar.com"]),
  "disney-plus-hotstar": ottBehavior(["hotstar.com", "jiohotstar.com"]),
  netflix: ottBehavior(["netflix.com"]),
  "prime-video": ottBehavior(["primevideo.com", "amazon.com"]),
  primevideo: ottBehavior(["primevideo.com", "amazon.com"]),
  zee5: ottBehavior(["zee5.com"]),
  sonyliv: ottBehavior(["sonyliv.com"]),
  "sony-liv": ottBehavior(["sonyliv.com"])
};

function ottBehavior(hosts: string[]): PlatformBehavior {
  return {
    internalMode: "in_app_browser_try",
    fallback: "external_official",
    allowIframe: true,
    knownBlocksIframe: true,
    allowedHosts: hosts
  };
}

export function platformKeyFromText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function platformKey(platform?: Platform | null) {
  return platformKeyFromText(`${platform?.slug || ""} ${platform?.name || ""}`);
}

export function platformBehaviorFor(platform?: Platform | string | null): PlatformBehavior {
  const key = typeof platform === "string" ? platformKeyFromText(platform) : platformKey(platform);
  const match = platformBehaviors[key] || Object.entries(platformBehaviors).find(([token]) => key.includes(token))?.[1];
  return match || {
    internalMode: "in_app_browser_try",
    fallback: "external_official",
    allowIframe: true,
    allowedHosts: []
  };
}

export function shouldUseInAppBrowser(platform?: Platform | null, openMode?: string | null) {
  if (openMode === "external" || openMode === "trailer_modal") return false;
  if (openMode === "in_app_browser") return true;
  return platformBehaviorFor(platform).internalMode === "in_app_browser_try";
}

export function buildInAppBrowserHref({
  platform,
  platformName,
  title,
  url,
  movieSlug,
  appRequired,
  appUrl,
  appStoreUrl,
  playStoreUrl,
  fallbackNote
}: {
  platform?: Platform | null;
  platformName?: string | null;
  title: string;
  url: string;
  movieSlug?: string | null;
  appRequired?: boolean;
  appUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  fallbackNote?: string | null;
}) {
  const slug = platform?.slug || platformKeyFromText(platformName || "official-platform") || "official-platform";
  const params = new URLSearchParams({
    url,
    title,
    platformName: platformName || platform?.name || "Official platform"
  });
  if (movieSlug) params.set("movie", movieSlug);
  if (appRequired) params.set("appRequired", "1");
  if (appUrl) params.set("appUrl", appUrl);
  if (appStoreUrl) params.set("appStoreUrl", appStoreUrl);
  if (playStoreUrl) params.set("playStoreUrl", playStoreUrl);
  if (fallbackNote) params.set("fallbackNote", fallbackNote);
  return `/watch/${encodeURIComponent(slug)}?${params.toString()}`;
}

export function isAllowedPlatformHost(url: string, platform?: string | null) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const behavior = platformBehaviorFor(platform);
    if (!behavior.allowedHosts.length) return true;
    return behavior.allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

export function isSafeLauncherUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}
