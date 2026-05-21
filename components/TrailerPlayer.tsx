"use client";

import { useEffect, useRef } from "react";
import { trackVideoComplete, trackVideoPlay, trackVideoProgress } from "@/lib/analytics";
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
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function startTracking() {
    if (!movieId || !movieSlug || startedRef.current) return;
    startedRef.current = true;
    const movie = { id: movieId, slug: movieSlug };
    const videoProvider = provider || "youtube";
    trackVideoPlay(movie, videoProvider);
    timersRef.current = [
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 15, 25), 15000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 30, 50), 30000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 45, 75), 45000),
      window.setTimeout(() => trackVideoComplete(movie, videoProvider, 60), 60000)
    ];
  }

  if (!embedUrl) return null;

  return (
    <section className="section" id="trailer">
      <div className="section-head">
        <h2>Official Trailer</h2>
      </div>
      <iframe
        className="embed"
        src={embedUrl}
        title="Official trailer"
        onFocus={startTracking}
        onPointerDown={startTracking}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </section>
  );
}
