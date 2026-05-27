import { getYouTubeEmbedUrl } from "@/lib/format";
import { buildInAppBrowserHref } from "@/lib/platformBehavior";
import { isKnownExternalWatchPageUrl, resolveWatchLinkTarget } from "@/lib/watch-links";
import type { Movie, MoviePlatformLink } from "@/types/watchfinder";

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
  return !["external_ott_link", "none", "no_playable_video"].includes(provider);
}

function activeOfficialLinks(links?: MoviePlatformLink[] | null) {
  return (links || []).filter((link) => link.is_active !== false && link.is_official !== false);
}

export function resolveMoviePlayAction(movie: Movie): ResolvedPlayAction {
  const legalEmbedUrl = movie.video_embed_url && !isKnownExternalWatchPageUrl(movie.video_embed_url)
    ? movie.video_embed_url
    : null;
  const provider = isPlayableProvider(movie.video_provider) ? movie.video_provider || movie.trailer_provider || "youtube" : null;

  if ((provider && legalEmbedUrl) || getYouTubeEmbedUrl(movie.trailer_url)) {
    return {
      type: "modal",
      videoEmbedUrl: provider ? legalEmbedUrl : null,
      trailerUrl: movie.trailer_url,
      provider: provider || movie.trailer_provider || "youtube",
      label: "Watch Trailer"
    };
  }

  for (const link of activeOfficialLinks(movie.movie_platform_links)) {
    const target = resolveWatchLinkTarget(link, movie.title);
    if (!target.url) continue;

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
      label: target.label,
      platformName: target.platformName,
      target: target.openMode === "in_app_browser" ? undefined : "_blank",
      note: target.note
    };
  }

  return {
    type: "unavailable",
    label: "No official video",
    note: "No official trailer or watch link available yet."
  };
}
