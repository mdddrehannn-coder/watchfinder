"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import {
  hasOfficialLink,
  isHindiFriendly,
  isLegalFreeMovie,
  movieQualities
} from "@/lib/discovery";
import { formatType, getYouTubeEmbedUrl } from "@/lib/format";
import { splitLanguages } from "@/lib/languages";
import type { Movie } from "@/types/watchfinder";

function firstPlatform(movie: Movie) {
  return movie.movie_platform_links?.find((link) => link.platforms)?.platforms?.name ?? null;
}

function slideBadges(movie: Movie) {
  return [
    formatType(movie.type),
    splitLanguages(movie.language)[0] || null,
    movieQualities(movie)[0] || null,
    !movie.has_licensed_video ? "Trailer Only" : null,
    hasOfficialLink(movie) ? "Official" : null,
    isLegalFreeMovie(movie) ? "Free Legal" : null,
    isHindiFriendly(movie) ? "Hindi Dubbed" : null
  ].filter(Boolean).slice(0, 3) as string[];
}

function getPreviewSrc(trailerUrl?: string | null) {
  const embedUrl = getYouTubeEmbedUrl(trailerUrl);
  if (!embedUrl || !embedUrl.includes("youtube.com/embed/")) return null;
  const videoId = embedUrl.split("/embed/")[1]?.split("?")[0];
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "0",
    playsinline: "1",
    rel: "0",
    modestbranding: "1"
  });
  if (videoId) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  return `${embedUrl}?${params.toString()}`;
}

export default function HomepageHeroSlider({ movies }: { movies: Movie[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewAllowed, setPreviewAllowed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const slides = useMemo(() => movies.slice(0, 6), [movies]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 719px)");

    function updatePreviewPermission() {
      setPreviewAllowed(!reducedMotion.matches && !mobile.matches && document.visibilityState === "visible");
    }

    updatePreviewPermission();
    reducedMotion.addEventListener("change", updatePreviewPermission);
    mobile.addEventListener("change", updatePreviewPermission);
    document.addEventListener("visibilitychange", updatePreviewPermission);

    return () => {
      reducedMotion.removeEventListener("change", updatePreviewPermission);
      mobile.removeEventListener("change", updatePreviewPermission);
      document.removeEventListener("visibilitychange", updatePreviewPermission);
    };
  }, []);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  useEffect(() => {
    if (slides.length && active >= slides.length) setActive(0);
  }, [active, slides.length]);

  useEffect(() => {
    setPreviewReady(false);
    if (!previewAllowed) return;
    const timer = window.setTimeout(() => setPreviewReady(true), 3000);
    return () => window.clearTimeout(timer);
  }, [active, previewAllowed]);

  function previous() {
    setActive((current) => (current === 0 ? slides.length - 1 : current - 1));
  }

  function next() {
    setActive((current) => (current + 1) % slides.length);
  }

  function handleTouchEnd(clientX: number) {
    if (touchStart === null) return;
    const delta = touchStart - clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) next();
      else previous();
    }
    setTouchStart(null);
  }

  if (!slides.length) {
    return (
      <section className="home-movie-hero empty-home-hero">
        <p className="rating-badge">Featured Updates</p>
        <p>Add published movies from admin panel to show homepage slider.</p>
      </section>
    );
  }

  return (
    <section
      className="home-movie-hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      <div className="hero-slide-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {slides.map((movie, index) => {
          const image = movie.banner_url || movie.poster_url;
          const badges = slideBadges(movie);
          const previewSrc = active === index && previewReady ? getPreviewSrc(movie.trailer_url) : null;

          return (
            <article className="hero-movie-slide" key={movie.id}>
              <Link className="hero-slide-link" href={`/movie/${movie.slug}`} aria-label={`View ${movie.title}`} />
              <div className={movie.banner_url ? "hero-movie-image" : "hero-movie-image poster-backdrop"}>
                {image ? <img src={image} alt={movie.title} /> : null}
              </div>
              {previewSrc ? (
                <iframe
                  className="hero-trailer-preview"
                  src={previewSrc}
                  title={`${movie.title} muted trailer preview`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  aria-hidden="true"
                />
              ) : null}
              <div className="hero-movie-content">
                <p className="hero-kicker">Latest on WatchFinder</p>
                <h1>{movie.title}</h1>
                {movie.description ? <p className="hero-movie-description">{movie.description}</p> : null}
                <div className="smart-badge-row hero-badge-row">
                  {badges.map((badge) => (
                    <span className="smart-badge" key={badge}>{badge}</span>
                  ))}
                </div>
                <div className="hero-actions">
                  <Link className="button primary" href={`/movie/${movie.slug}`}>
                    View Details
                  </Link>
                  {movie.trailer_url ? (
                    <Link className="button hero-secondary-button" href={`/movie/${movie.slug}#trailer`}>
                      <Play size={16} /> Watch Trailer
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {slides.length > 1 ? (
        <>
          <button className="hero-arrow hero-arrow-left" type="button" onClick={previous} aria-label="Previous slide">
            <ChevronLeft size={22} />
          </button>
          <button className="hero-arrow hero-arrow-right" type="button" onClick={next} aria-label="Next slide">
            <ChevronRight size={22} />
          </button>
          <div className="hero-dots" aria-label="Slider navigation">
            {slides.map((movie, index) => (
              <button
                aria-label={`Show ${movie.title}`}
                className={active === index ? "hero-dot active" : "hero-dot"}
                key={movie.id}
                onClick={() => setActive(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
