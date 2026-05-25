"use client";

import { useCallback, useEffect, useRef } from "react";
import { trackTrailerOpen, trackVideoComplete, trackVideoPlay, trackVideoProgress, trackWatchLinkClick } from "@/lib/analytics";
import { getYouTubeEmbedUrl } from "@/lib/format";

export default function TrailerPlayer({
  trailerUrl,
  movieId,
  movieSlug,
  provider = "youtube"
}: {
  trailerUrl?: string | null;
  movieId?: string;
  movieSlug?: string;
  provider?: string | null;
}) {
  const embedUrl = getYouTubeEmbedUrl(trailerUrl);
  const startedRef = useRef(false);
  const openedRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const markTrailerOpened = useCallback(function markTrailerOpened() {
    if (!movieId || !movieSlug || openedRef.current) return;
    openedRef.current = true;
    const movie = { id: movieId, slug: movieSlug };
    const videoProvider = provider || "youtube";
    trackTrailerOpen(movie, videoProvider);
    trackWatchLinkClick(movie, "Official trailer");
  }, [movieId, movieSlug, provider]);

  const startTracking = useCallback(function startTracking() {
    if (!movieId || !movieSlug || startedRef.current) return;
    startedRef.current = true;
    markTrailerOpened();
    const movie = { id: movieId, slug: movieSlug };
    const videoProvider = provider || "youtube";
    trackVideoPlay(movie, videoProvider);
    timersRef.current = [
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 15, 25), 15000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 30, 50), 30000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 45, 75), 45000),
      window.setTimeout(() => trackVideoComplete(movie, videoProvider, 60), 60000)
    ];
  }, [markTrailerOpened, movieId, movieSlug, provider]);

  useEffect(() => {
    if (!movieId || !movieSlug || !embedUrl) return undefined;
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45)) return;
      markTrailerOpened();
      startTracking();
      observer.disconnect();
    }, { threshold: [0.45] });
    observer.observe(section);
    return () => {
      observer.disconnect();
    };
  }, [embedUrl, markTrailerOpened, movieId, movieSlug, startTracking]);

  if (!embedUrl) {
    return (
      <section className="section" id="trailer">
        <div className="section-head">
          <h2>Official Trailer</h2>
        </div>
        <div className="empty">No official trailer available yet.</div>
      </section>
    );
  }

  return (
    <section className="section" id="trailer" ref={sectionRef}>
      <div className="section-head">
        <h2>Official Trailer</h2>
      </div>
      <iframe
        className="embed"
        src={embedUrl}
        title="Official trailer"
        onLoad={markTrailerOpened}
        onFocus={startTracking}
        onPointerDown={startTracking}
        onTouchStart={startTracking}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </section>
  );
}
