import type { Platform } from "@/types/watchfinder";

const PLATFORM_LOGOS: Record<string, string> = {
  netflix: "/platforms/netflix.svg",
  "prime video": "/platforms/prime-video.svg",
  prime: "/platforms/prime-video.svg",
  youtube: "/platforms/youtube.svg",
  zee5: "/platforms/zee5.svg",
  zee: "/platforms/zee5.svg",
  sonyliv: "/platforms/sonyliv.svg",
  "sony liv": "/platforms/sonyliv.svg",
  aha: "/platforms/aha.svg",
  "apple tv": "/platforms/apple-tv.svg",
  apple: "/platforms/apple-tv.svg",
  hotstar: "/platforms/hotstar.svg",
  jiohotstar: "/platforms/hotstar.svg",
  "jio hotstar": "/platforms/hotstar.svg",
  disney: "/platforms/hotstar.svg"
};

export function getPlatformLogo(platformName?: string | null) {
  const name = (platformName || "").toLowerCase();
  const key = Object.keys(PLATFORM_LOGOS).find((item) => name.includes(item));
  return key ? PLATFORM_LOGOS[key] : null;
}

export function platformLogoFor(platform: Platform) {
  return getPlatformLogo(platform.name) || platform.logo_url || null;
}
