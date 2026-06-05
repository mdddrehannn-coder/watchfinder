"use client";

import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import TrailerModalTrigger from "@/components/TrailerModalTrigger";
import { trackEvent, trackWatchLinkClick } from "@/lib/analytics";
import { cx } from "@/lib/format";
import type { ResolvedPlayAction } from "@/lib/play-actions";
import { recordWatchHistory } from "@/lib/user-library";

type HeroMovie = {
  id: string;
  slug: string;
  title?: string | null;
  posterUrl?: string | null;
  contentType?: string | null;
};

export default function HeroPlayBanner({
  action,
  imageUrl,
  title,
  movie,
  className
}: {
  action: ResolvedPlayAction;
  imageUrl?: string | null;
  title: string;
  movie?: HeroMovie;
  className?: string;
}) {
  const playButton = (
    <span className="hero-play-button" aria-hidden="true">
      <Play size={34} fill="currentColor" />
    </span>
  );

  return (
    <div className={cx(className, "hero-play-banner")} aria-label={`${title} banner`}>
      {imageUrl ? <img src={imageUrl} alt={title} /> : null}
      {action.type === "modal" && movie ? (
        <TrailerModalTrigger
          className="hero-play-button-trigger"
          trailerUrl={action.trailerUrl}
          videoEmbedUrl={action.videoEmbedUrl}
          movieId={movie.id}
          movieSlug={movie.slug}
          posterUrl={movie.posterUrl}
          contentType={movie.contentType}
          provider={action.provider}
          title={title}
          buttonLabel={action.label}
        >
          {playButton}
          <span className="hero-play-label">{action.label}</span>
        </TrailerModalTrigger>
      ) : null}
      {action.type === "platform" && movie ? (
        <a
          className="hero-play-button-trigger"
          href={action.href}
          target={action.target}
          rel={action.target ? "noreferrer" : undefined}
          aria-label={action.label}
          onClick={() => {
            trackEvent({
              event_type: "platform_open_attempt",
              movie_id: movie.id,
              movie_slug: movie.slug,
              platform_name: action.platformName,
              metadata: { source: "hero_play_banner" }
            });
            trackWatchLinkClick(movie, action.platformName);
            recordWatchHistory({
              content_id: movie.id,
              content_slug: movie.slug,
              content_type: movie.contentType || "movie",
              title: movie.title || title,
              poster_url: movie.posterUrl || null,
              platform_name: action.platformName,
              href: `/movie/${movie.slug}`
            }, "platform_open", { platform_name: action.platformName });
          }}
        >
          {playButton}
          <span className="hero-play-label">
            {action.label} {action.target ? <ExternalLink size={16} /> : null}
          </span>
        </a>
      ) : null}
      {action.type === "internal_link" ? (
        <Link className="hero-play-button-trigger" href={action.href} aria-label={action.label}>
          {playButton}
          <span className="hero-play-label">{action.label}</span>
        </Link>
      ) : null}
      {action.type === "unavailable" ? (
        <span className="hero-play-unavailable">{action.note}</span>
      ) : null}
    </div>
  );
}
