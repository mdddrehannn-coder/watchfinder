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
import { splitLanguages } from "@/lib/languages";
import type { Movie } from "@/types/watchfinder";

function firstPlatform(movie: Movie) {
  return movie.movie_platform_links?.find((link) => link.platforms)?.platforms?.name ?? null;
}

function slideBadges(movie: Movie) {
  return [
    isLegalFreeMovie(movie) ? "Free Legal" : null,
    isHindiFriendly(movie) ? "Hindi Dubbed" : null,
    !movie.has_licensed_video ? "Trailer Only" : null,
    hasOfficialLink(movie) ? "Official" : null
  ].filter(Boolean).slice(0, 2) as string[];
}

export default function HomepageHeroSlider({ movies }: { movies: Movie[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const slides = useMemo(() => movies.slice(0, 6), [movies]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

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
        <p>Add featured or latest movies from admin panel to show homepage slider.</p>
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
        {slides.map((movie) => {
          const image = movie.banner_url || movie.poster_url;
          const languages = splitLanguages(movie.language).slice(0, 3);
          const quality = movieQualities(movie)[0];
          const platform = firstPlatform(movie);
          const badges = slideBadges(movie);

          return (
            <article className="hero-movie-slide" key={movie.id}>
              <div className={movie.banner_url ? "hero-movie-image" : "hero-movie-image poster-backdrop"}>
                {image ? <img src={image} alt={movie.title} /> : null}
              </div>
              <div className="hero-movie-content">
                <p className="rating-badge">Latest on WatchFinder</p>
                <h1>{movie.title}</h1>
                {movie.description ? <p className="hero-movie-description">{movie.description}</p> : null}
                <div className="language-tags">
                  {languages.map((language) => (
                    <span className="language-tag" key={language}>{language}</span>
                  ))}
                  {quality ? <span className="language-tag quality-tag">{quality}</span> : null}
                  {platform ? <span className="platform-badge">{platform}</span> : null}
                </div>
                <div className="smart-badge-row">
                  {badges.map((badge) => (
                    <span className="smart-badge" key={badge}>{badge}</span>
                  ))}
                </div>
                <div className="hero-actions">
                  <Link className="button primary" href={`/movie/${movie.slug}`}>
                    View Details
                  </Link>
                  {movie.trailer_url ? (
                    <a className="button ghost" href={movie.trailer_url} target="_blank" rel="noreferrer">
                      <Play size={16} /> Watch Trailer
                    </a>
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
