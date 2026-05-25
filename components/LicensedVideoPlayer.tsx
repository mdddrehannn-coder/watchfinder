"use client";

import { useCallback, useEffect, useRef } from "react";
import { trackVideoComplete, trackVideoPlay, trackVideoProgress } from "@/lib/analytics";
import type { Movie } from "@/types/watchfinder";

function sourceFor(movie: Movie) {
  if (movie.video_embed_url) return movie.video_embed_url;
  if (!movie.video_id || !movie.video_provider) return null;

  if (movie.video_provider === "cloudflare_stream") {
    return `https://iframe.videodelivery.net/${movie.video_id}`;
  }
  if (movie.video_provider === "vimeo") {
    return `https://player.vimeo.com/video/${movie.video_id}`;
  }
  if (movie.video_provider === "youtube_embed") {
    return `https://www.youtube.com/embed/${movie.video_id}`;
  }
  return null;
}

export default function LicensedVideoPlayer({
  movie,
  hasProof
}: {
  movie: Movie;
  hasProof: boolean;
}) {
  const src = sourceFor(movie);
  const hasRequiredLicenseFields = Boolean(movie.license_type && movie.license_owner_name && movie.video_provider);
  const startedRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const startTracking = useCallback(function startTracking() {
    if (startedRef.current) return;
    startedRef.current = true;
    const videoProvider = movie.video_provider || "licensed_video";
    trackVideoPlay(movie, videoProvider, true);
    timersRef.current = [
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 15, 25, true), 15000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 30, 50, true), 30000),
      window.setTimeout(() => trackVideoProgress(movie, videoProvider, 45, 75, true), 45000),
      window.setTimeout(() => trackVideoComplete(movie, videoProvider, 60, true), 60000)
    ];
  }, [movie]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!src || !section || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45)) return;
      startTracking();
      observer.disconnect();
    }, { threshold: [0.45] });
    observer.observe(section);
    return () => observer.disconnect();
  }, [src, movie.id, startTracking]);

  if (!movie.has_licensed_video || !src || !hasProof || !hasRequiredLicenseFields) return null;

  return (
    <section className="section" ref={sectionRef}>
      <div className="section-head">
        <div>
          <h2>Play Licensed Video</h2>
          <span className="legal-badge">Licensed / Permission Verified</span>
        </div>
      </div>
      <iframe
        className="embed"
        src={src}
        title={`${movie.title} licensed video`}
        onLoad={startTracking}
        onFocus={startTracking}
        onPointerDown={startTracking}
        onTouchStart={startTracking}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </section>
  );
}
