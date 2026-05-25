"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { trackTrailerOpen, trackVideoComplete, trackVideoPlay, trackVideoProgress, trackWatchLinkClick } from "@/lib/analytics";
import { cx, getYouTubeEmbedUrl } from "@/lib/format";
import { isKnownExternalWatchPageUrl } from "@/lib/watch-links";
import TrailerModal, { type TrailerModalSource } from "@/components/TrailerModal";

function appendAutoplay(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("autoplay", "1");
    parsed.searchParams.set("rel", "0");
    parsed.searchParams.set("modestbranding", "1");
    return parsed.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
  }
}

function resolveModalSource({
  videoEmbedUrl,
  trailerUrl,
  officialWatchUrl,
  officialPlatformName,
  officialActionLabel,
  officialNote,
  title
}: {
  videoEmbedUrl?: string | null;
  trailerUrl?: string | null;
  officialWatchUrl?: string | null;
  officialPlatformName?: string | null;
  officialActionLabel?: string | null;
  officialNote?: string | null;
  title: string;
}): TrailerModalSource | null {
  const directEmbed = isKnownExternalWatchPageUrl(videoEmbedUrl)
    ? null
    : getYouTubeEmbedUrl(videoEmbedUrl) || videoEmbedUrl;
  if (directEmbed) {
    return {
      kind: "embed",
      src: appendAutoplay(directEmbed),
      title: `${title} official video`
    };
  }

  const trailerEmbed = getYouTubeEmbedUrl(trailerUrl);
  if (trailerEmbed) {
    return {
      kind: "embed",
      src: appendAutoplay(trailerEmbed),
      title: `${title} official trailer`
    };
  }

  if (officialWatchUrl) {
    return {
      kind: "official_link",
      url: officialWatchUrl,
      platformName: officialPlatformName || "Official platform",
      actionLabel: officialActionLabel || undefined,
      note: officialNote || undefined,
      title
    };
  }

  return null;
}

export default function TrailerModalTrigger({
  trailerUrl,
  videoEmbedUrl,
  officialWatchUrl,
  officialPlatformName,
  officialActionLabel,
  officialNote,
  movieId,
  movieSlug,
  provider = "youtube",
  title,
  className,
  showUnavailableMessage = false,
  buttonLabel,
  children
}: {
  trailerUrl?: string | null;
  videoEmbedUrl?: string | null;
  officialWatchUrl?: string | null;
  officialPlatformName?: string | null;
  officialActionLabel?: string | null;
  officialNote?: string | null;
  movieId: string;
  movieSlug: string;
  provider?: string | null;
  title: string;
  className?: string;
  showUnavailableMessage?: boolean;
  buttonLabel?: string;
  children: React.ReactNode;
}) {
  const source = resolveModalSource({ videoEmbedUrl, trailerUrl, officialWatchUrl, officialPlatformName, officialActionLabel, officialNote, title });
  const hasEmbedSource = source?.kind === "embed";
  const [open, setOpen] = useState(false);
  const modalOpenTrackedRef = useRef(false);
  const trackingStartedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const trackModalOpen = useCallback(function trackModalOpen() {
    if (modalOpenTrackedRef.current || !source) return;
    modalOpenTrackedRef.current = true;
    const movie = { id: movieId, slug: movieSlug };
    const videoProvider = source.kind === "official_link" ? source.platformName : provider || "youtube";
    trackTrailerOpen(movie, videoProvider);
    if (source.kind === "embed") {
      trackWatchLinkClick(movie, videoEmbedUrl ? "Official video" : "Official trailer");
    }
  }, [movieId, movieSlug, provider, source, videoEmbedUrl]);

  const startTracking = useCallback(function startTracking() {
    if (trackingStartedRef.current) return;
    if (!hasEmbedSource) return;
    trackingStartedRef.current = true;
    trackModalOpen();
    const movie = { id: movieId, slug: movieSlug };
    const videoProvider = provider || "youtube";
    trackVideoPlay(movie, videoProvider);
    timersRef.current = [
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 15, 25), 15000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 30, 50), 30000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 45, 75), 45000),
      window.setTimeout(() => trackVideoComplete(movie, videoProvider, 60), 60000)
    ];
  }, [hasEmbedSource, movieId, movieSlug, provider, trackModalOpen]);

  function openModal() {
    if (!source) return;
    setOpen(true);
    trackModalOpen();
    if (hasEmbedSource) startTracking();
  }

  const closeModal = useCallback(function closeModal() {
    setOpen(false);
    clearTimers();
    modalOpenTrackedRef.current = false;
    trackingStartedRef.current = false;
  }, [clearTimers]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal, open]);

  useEffect(() => clearTimers, [clearTimers]);

  if (!source) {
    if (buttonLabel) return null;
    return (
      <div className={cx(className, "detail-media-trigger-no-trailer")}>
        {children}
        {showUnavailableMessage ? <span className="detail-video-unavailable">No official video available yet.</span> : null}
      </div>
    );
  }

  return (
    <>
      <button className={buttonLabel ? cx(className, "detail-action-trigger") : cx(className, "detail-media-trigger")} type="button" onClick={openModal} aria-label={buttonLabel || `Watch ${title}`}>
        {children}
        {!buttonLabel ? (
          <span className="detail-play-overlay" aria-hidden="true">
            <span className="detail-play-button">
              <Play size={28} fill="currentColor" />
            </span>
          </span>
        ) : null}
      </button>
      <TrailerModal open={open} onClose={closeModal} source={source} movie={{ id: movieId, slug: movieSlug }} />
    </>
  );
}
