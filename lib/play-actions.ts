import { getYouTubeEmbedUrl } from "@/lib/format";
import { buildInAppBrowserHref, platformKeyFromText } from "@/lib/platformBehavior";
import { isKnownExternalWatchPageUrl, resolveWatchLinkTarget } from "@/lib/watch-links";
import type { Movie, MoviePlatformLink, Platform } from "@/types/watchfinder";

export type ResolvedPlayAction =
  | {
      type: "modal";
      videoEmbedUrl?: string | null;
      trailerUrl?: string | null;
      provider?: string | null;
      label: string;
    }
  | {
      type: "platform";
      href: string;
      label: string;
      platformName: string;
      target?: "_blank";
      note?: string;
    }
  | {
      type: "internal_link";
      href: string;
      label: string;
      note?: string;
    }
  | {
      type: "unavailable";
      label: string;
      note: string;
    };

function cleanProvider(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isPlayableProvider(value?: string | null) {
  const provider = cleanProvider(value);
  return !["external_ott_link", "none", "no_playable_video", "no playable video"].includes(provider);
}

function activeOfficialLinks(links?: MoviePlatformLink[] | null) {
  return (links || []).filter((link) => link.is_active !== false && link.is_official !== false);
}

function cleanUrl(value?: string | null) {
  return String(value || "").trim() || null;
}

function isYouTubeUrl(value?: string | null) {
  const url = cleanUrl(value);
  if (!url) return false;

  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com");
  } catch {
    return false;
  }
}

function getYouTubeSource(...urls: Array<string | null | undefined>) {
  const youtubeUrl = urls.find((url) => isYouTubeUrl(url));
  return youtubeUrl ? getYouTubeEmbedUrl(youtubeUrl) : null;
}

function firstLegalEmbedUrl(...urls: Array<string | null | undefined>) {
  return urls.map(cleanUrl).find((url) => url && !isKnownExternalWatchPageUrl(url)) || null;
}

function inferPlatformNameFromUrl(url?: string | null) {
  if (!url) return null;

  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("hotstar") || host.includes("jiohotstar")) return "JioHotstar";
    if (host.includes("netflix")) return "Netflix";
    if (host.includes("primevideo") || host.includes("amazon")) return "Prime Video";
    if (host.includes("zee5")) return "Zee5";
    if (host.includes("sonyliv")) return "SonyLIV";
    if (host.includes("aha.video")) return "Aha";
    if (host.includes("youtube") || host.includes("youtu.be")) return "YouTube";
  } catch {
    return null;
  }

  return null;
}

function movieRowPlatform(movie: Movie): Platform {
  const name =
    cleanUrl(movie.official_platform) ||
    cleanUrl(movie.platform_name) ||
    inferPlatformNameFromUrl(movie.watch_url) ||
    inferPlatformNameFromUrl(movie.video_url) ||
    inferPlatformNameFromUrl(movie.trailer_url) ||
    inferPlatformNameFromUrl(movie.video_embed_url) ||
    inferPlatformNameFromUrl(movie.platform_home_url) ||
    inferPlatformNameFromUrl(movie.platform_search_url) ||
    "Official Platform";

  return {
    id: `${movie.id}-row-platform`,
    name,
    slug: platformKeyFromText(name) || "official-platform",
    website_url: cleanUrl(movie.platform_home_url)
  };
}

function movieRowWatchLink(movie: Movie): MoviePlatformLink | null {
  const externalRowUrl = [
    movie.watch_url,
    movie.video_url,
    movie.trailer_url,
    movie.video_embed_url
  ].map(cleanUrl).find((url) => isKnownExternalWatchPageUrl(url));
  const rowWatchUrl = cleanUrl(movie.watch_url) || externalRowUrl || null;
  const hasAnyRowWatchTarget = Boolean(
    rowWatchUrl ||
      cleanUrl(movie.platform_home_url) ||
      cleanUrl(movie.platform_search_url) ||
      cleanUrl(movie.app_deeplink)
  );

  if (!hasAnyRowWatchTarget) return null;

  return {
    id: `${movie.id}-row-watch-link`,
    movie_id: movie.id,
    platform_id: `${movie.id}-row-platform`,
    watch_url: rowWatchUrl,
    platform_home_url: cleanUrl(movie.platform_home_url),
    platform_search_url: cleanUrl(movie.platform_search_url),
    app_deeplink: cleanUrl(movie.app_deeplink),
    app_store_url: cleanUrl(movie.app_store_url || movie.app_store_link),
    play_store_url: cleanUrl(movie.play_store_url || movie.play_store_link),
    fallback_note: cleanUrl(movie.fallback_note),
    mobile_web_supported: movie.mobile_web_supported || "unknown",
    desktop_web_supported: movie.desktop_web_supported || "unknown",
    app_required: Boolean(movie.app_required) || movie.mobile_web_supported === "no",
    link_type: rowWatchUrl
      ? "direct_title_page"
      : cleanUrl(movie.platform_search_url)
        ? "platform_search"
        : cleanUrl(movie.app_deeplink)
          ? "app_deeplink"
          : "platform_home",
    open_mode: movie.open_mode || "auto",
    availability_type: movie.availability_type || "unknown",
    language: movie.language || movie.primary_language || null,
    quality: movie.quality || null,
    notes: cleanUrl(movie.fallback_note),
    is_official: true,
    is_active: true,
    platforms: movieRowPlatform(movie)
  };
}

function toPlatformPlayAction(link: MoviePlatformLink, movie: Movie): ResolvedPlayAction | null {
  const target = resolveWatchLinkTarget(link, movie.title);
  if (!target.url) return null;

  return {
    type: "platform",
    href: target.openMode === "in_app_browser"
      ? buildInAppBrowserHref({
        platform: link.platforms,
        platformName: target.platformName,
        title: movie.title,
        url: target.url,
        movieSlug: movie.slug,
        appRequired: target.appRequired,
        appUrl: target.appUrl,
        appStoreUrl: target.appStoreUrl,
        playStoreUrl: target.playStoreUrl,
        fallbackNote: target.fallbackNote
      })
      : target.url,
    label: target.appRequired ? `Open ${target.platformName} App` : "Watch on Official Platform",
    platformName: target.platformName,
    target: target.openMode === "in_app_browser" ? undefined : "_blank",
    note: target.note
  };
}

export function resolveMoviePlayAction(movie: Movie): ResolvedPlayAction {
  const youtubeEmbedUrl = getYouTubeSource(
    movie.trailer_url,
    movie.video_embed_url,
    movie.video_url,
    movie.watch_url,
    ...activeOfficialLinks(movie.movie_platform_links).map((link) => link.watch_url)
  );
  const youtubeProvider = cleanProvider(movie.video_provider || movie.trailer_provider).includes("youtube")
    ? "youtube"
    : movie.trailer_provider || "youtube";

  if (youtubeEmbedUrl) {
    return {
      type: "modal",
      videoEmbedUrl: youtubeEmbedUrl,
      trailerUrl: null,
      provider: youtubeProvider,
      label: "Watch Trailer"
    };
  }

  if (cleanProvider(movie.video_provider).includes("youtube") && movie.video_id) {
    return {
      type: "modal",
      videoEmbedUrl: `https://www.youtube.com/embed/${movie.video_id}`,
      trailerUrl: null,
      provider: "youtube",
      label: "Watch Trailer"
    };
  }

  const legalEmbedUrl = firstLegalEmbedUrl(movie.video_embed_url, movie.video_url, movie.trailer_url);
  const provider = isPlayableProvider(movie.video_provider)
    ? cleanProvider(movie.video_provider || movie.trailer_provider) || "direct"
    : null;

  if (provider && legalEmbedUrl) {
    return {
      type: "modal",
      videoEmbedUrl: legalEmbedUrl,
      trailerUrl: null,
      provider,
      label: "Watch Trailer"
    };
  }

  const rowWatchLink = movieRowWatchLink(movie);
  const officialLinks = rowWatchLink
    ? [...activeOfficialLinks(movie.movie_platform_links), rowWatchLink]
    : activeOfficialLinks(movie.movie_platform_links);

  for (const link of officialLinks) {
    const action = toPlatformPlayAction(link, movie);
    if (action) return action;
  }

  return {
    type: "unavailable",
    label: "No official video",
    note: "No official trailer or watch link available yet."
  };
}
