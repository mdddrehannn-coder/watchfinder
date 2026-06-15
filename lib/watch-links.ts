import type { MoviePlatformLink, Platform } from "@/types/watchfinder";

export const WATCH_LINK_TYPES = [
  "direct_title_page",
  "platform_search",
  "platform_home",
  "app_deeplink"
] as const;

export type WatchLinkType = (typeof WATCH_LINK_TYPES)[number];

export const watchLinkTypeLabels: Record<WatchLinkType, string> = {
  direct_title_page: "Direct title page",
  platform_search: "Platform search",
  platform_home: "Platform home",
  app_deeplink: "App deeplink"
};

export const availabilityLabels: Record<string, string> = {
  subscription: "Subscription",
  rent: "Rent",
  buy: "Buy",
  free: "Free",
  official: "Official",
  unknown: "Unknown"
};

export function isAppRequiredLink(link: MoviePlatformLink) {
  return Boolean(link.app_required) || link.mobile_web_supported === "no";
}

type PlatformFallback = {
  home: string;
  search?: string;
};

const platformFallbacks: Record<string, PlatformFallback> = {
  hotstar: {
    home: "https://www.hotstar.com/",
    search: "https://www.hotstar.com/in/search?q={query}"
  },
  jiohotstar: {
    home: "https://www.hotstar.com/",
    search: "https://www.hotstar.com/in/search?q={query}"
  },
  "jio-hotstar": {
    home: "https://www.hotstar.com/",
    search: "https://www.hotstar.com/in/search?q={query}"
  },
  "disney-hotstar": {
    home: "https://www.hotstar.com/",
    search: "https://www.hotstar.com/in/search?q={query}"
  },
  "disney-plus-hotstar": {
    home: "https://www.hotstar.com/",
    search: "https://www.hotstar.com/in/search?q={query}"
  },
  youtube: {
    home: "https://www.youtube.com/",
    search: "https://www.youtube.com/results?search_query={query}"
  },
  netflix: {
    home: "https://www.netflix.com/",
    search: "https://www.netflix.com/search?q={query}"
  },
  "prime-video": {
    home: "https://www.primevideo.com/",
    search: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={query}"
  },
  primevideo: {
    home: "https://www.primevideo.com/",
    search: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={query}"
  },
  zee5: {
    home: "https://www.zee5.com/",
    search: "https://www.zee5.com/search?q={query}"
  },
  sonyliv: {
    home: "https://www.sonyliv.com/",
    search: "https://www.sonyliv.com/search?q={query}"
  },
  "sony-liv": {
    home: "https://www.sonyliv.com/",
    search: "https://www.sonyliv.com/search?q={query}"
  },
  aha: {
    home: "https://www.aha.video/",
    search: "https://www.aha.video/search?q={query}"
  },
  "apple-tv": {
    home: "https://tv.apple.com/",
    search: "https://tv.apple.com/search?term={query}"
  }
};

function platformKey(platform?: Platform | null) {
  return `${platform?.slug || ""} ${platform?.name || ""}`
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function platformFallback(platform?: Platform | null) {
  const key = platformKey(platform);
  return platformFallbacks[key] || Object.entries(platformFallbacks).find(([fallbackKey]) => key.includes(fallbackKey))?.[1] || null;
}

export function getPlatformHomeUrl(platform?: Platform | null) {
  return platform?.website_url || platformFallback(platform)?.home || null;
}

export function getPlatformSearchUrl(platform: Platform | null | undefined, title: string) {
  const fallback = platformFallback(platform);
  if (!fallback?.search) return null;
  return fallback.search.replace("{query}", encodeURIComponent(title));
}

export function normalizeWatchLinkType(value?: string | null): WatchLinkType {
  return WATCH_LINK_TYPES.includes(value as WatchLinkType) ? (value as WatchLinkType) : "direct_title_page";
}

export function isExternalOnlyPlatform(platform?: Platform | null) {
  const key = platformKey(platform);
  return [
    "hotstar",
    "jiohotstar",
    "jio-hotstar",
    "disney-hotstar",
    "disney-plus-hotstar",
    "netflix",
    "prime-video",
    "primevideo",
    "zee5",
    "sonyliv",
    "sony-liv"
  ].some((token) => key.includes(token));
}

export function isKnownExternalWatchPageUrl(url?: string | null) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return [
      "hotstar.com",
      "jiohotstar.com",
      "netflix.com",
      "primevideo.com",
      "zee5.com",
      "sonyliv.com",
      "aha.video"
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function browserSafeUrl(url?: string | null) {
  const value = (url || "").trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveWatchLinkTarget(link: MoviePlatformLink, title: string) {
  const platformName = link.platforms?.name || "Official platform";
  const linkType = normalizeWatchLinkType(link.link_type);
  const browserLinkType = linkType === "app_deeplink" ? "direct_title_page" : linkType;
  const exactUrl = browserSafeUrl(link.watch_url);
  const externalOnly = isExternalOnlyPlatform(link.platforms);
  const openMode = "external";

  if (exactUrl) {
    return {
      url: exactUrl,
      label: `Watch on ${platformName}`,
      note: link.fallback_note || link.notes || (externalOnly
        ? `${platformName} opens in your browser. Login may be required. WatchFinder does not host or embed OTT videos.`
        : "Opens the official title page in your browser."),
      type: browserLinkType,
      platformName,
      externalOnly,
      openMode,
      appRequired: false,
      appUrl: null,
      appStoreUrl: null,
      playStoreUrl: null,
      fallbackNote: link.fallback_note
    };
  }

  const searchUrl = browserSafeUrl(link.platform_search_url) || browserSafeUrl(getPlatformSearchUrl(link.platforms, title));
  const homeUrl = browserSafeUrl(link.platform_home_url) || browserSafeUrl(getPlatformHomeUrl(link.platforms));

  if (browserLinkType === "platform_search" && searchUrl) {
    return {
      url: searchUrl,
      label: externalOnly ? `Open ${platformName}` : `Search on ${platformName}`,
      note: link.notes || `Search this title on ${platformName}. Exact title link is not available.`,
      type: browserLinkType,
      platformName,
      externalOnly,
      openMode,
      appRequired: false,
      appUrl: null,
      appStoreUrl: null,
      playStoreUrl: null,
      fallbackNote: link.fallback_note
    };
  }

  if (homeUrl) {
    return {
      url: homeUrl,
      label: `Open ${platformName}`,
      note: link.notes || `Search this title on ${platformName}. Exact title link is not available.`,
      type: "platform_home" as WatchLinkType,
      platformName,
      externalOnly,
      openMode,
      appRequired: false,
      appUrl: null,
      appStoreUrl: null,
      playStoreUrl: null,
      fallbackNote: link.fallback_note
    };
  }

  return {
    url: null,
    label: `Open ${platformName}`,
    note: link.notes || `Exact title link is not available. Search this title on ${platformName}.`,
    type: browserLinkType,
    platformName,
    externalOnly,
    openMode,
    appRequired: false,
    appUrl: null,
    appStoreUrl: null,
    playStoreUrl: null,
    fallbackNote: link.fallback_note
  };
}
