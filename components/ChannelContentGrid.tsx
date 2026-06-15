"use client";

import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import { trackWatchLinkClick } from "@/lib/analytics";
import { movieQualities, readableAvailability } from "@/lib/discovery";
import { formatType } from "@/lib/format";
import { splitLanguages } from "@/lib/languages";
import { resolveWatchLinkTarget } from "@/lib/watch-links";
import type { ContentChannelItem } from "@/types/watchfinder";

function firstWatchLink(item: ContentChannelItem) {
  return item.movies?.movie_platform_links?.find((link) => link.is_active !== false && link.is_official !== false) ?? null;
}

function episodeLabel(item: ContentChannelItem) {
  const parts = [];
  if (item.season_number) parts.push(`Season ${item.season_number}`);
  if (item.episode_number) parts.push(`Episode ${item.episode_number}`);
  return parts.join(" • ");
}

function isDangerousHref(value?: string | null) {
  return /^(javascript|data|vbscript|intent|market):/i.test((value || "").trim());
}

function isBrowserHref(value?: string | null) {
  const href = (value || "").trim();
  if (!href || isDangerousHref(href)) return false;
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

export default function ChannelContentGrid({
  items,
  emptyTitle
}: {
  items: ContentChannelItem[];
  emptyTitle: string;
}) {
  if (!items.length) {
    return <div className="empty">{emptyTitle}</div>;
  }

  const hasEpisodes = items.some((item) => item.season_number || item.episode_number || item.episode_title || item.playlist_group);

  if (hasEpisodes) {
    const groups = new Map<string, ContentChannelItem[]>();
    for (const item of items) {
      const key = item.playlist_group || (item.season_number ? `Season ${item.season_number}` : "Episodes");
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }

    return (
      <div className="playlist-stack">
        {Array.from(groups.entries()).map(([group, groupItems]) => (
          <section className="playlist-group" key={group}>
            <div className="section-head compact">
              <h2>{group}</h2>
              <span className="platform-badge">{groupItems.length} titles</span>
            </div>
            <div className="channel-content-grid">
              {groupItems.map((item) => <ChannelContentCard item={item} key={item.id} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="channel-content-grid">
      {items.map((item) => <ChannelContentCard item={item} key={item.id} />)}
    </div>
  );
}

function ChannelContentCard({ item }: { item: ContentChannelItem }) {
  const movie = item.movies;
  if (!movie) return null;
  const watchLink = firstWatchLink(item);
  const watchTarget = watchLink ? resolveWatchLinkTarget(watchLink, movie.title) : null;
  const watchHref = isBrowserHref(watchTarget?.url) ? watchTarget?.url || null : null;
  const qualities = movieQualities(movie).slice(0, 2);
  const languages = splitLanguages(movie.language).slice(0, 2);
  const episode = episodeLabel(item);

  return (
    <article className="channel-content-card">
      <Link className="channel-content-poster" href={`/movie/${movie.slug}`}>
        {movie.poster_url || movie.banner_url ? <img src={movie.poster_url || movie.banner_url || ""} alt={movie.title} /> : <span>{movie.title.slice(0, 1)}</span>}
      </Link>
      <div className="channel-content-copy">
        <div className="meta-line">
          <span className="rating-badge">{formatType(movie.type)}</span>
          {episode ? <span>{episode}</span> : null}
        </div>
        <h3>{item.episode_title || movie.title}</h3>
        {item.episode_title ? <p className="muted">{movie.title}</p> : null}
        <div className="language-tags">
          {languages.map((language) => <span className="language-tag" key={language}>{language}</span>)}
          {qualities.map((quality) => <span className="language-tag" key={quality}>{quality}</span>)}
          {watchLink?.availability_type ? <span className="platform-badge">{readableAvailability(watchLink.availability_type)}</span> : null}
          {watchLink?.platforms?.name ? <span className="platform-badge">{watchLink.platforms.name}</span> : null}
        </div>
        <div className="channel-content-actions">
          <Link className="button primary" href={`/movie/${movie.slug}`}>View Details</Link>
          {watchTarget && watchHref ? (
            <a
              className="button"
              href={watchHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWatchLinkClick({ id: movie.id, slug: movie.slug }, watchTarget.platformName)}
            >
              <ExternalLink size={16} /> {watchTarget.label}
            </a>
          ) : movie.trailer_url ? (
            <Link className="button" href={`/movie/${movie.slug}#trailer`}>
              <Play size={16} /> Watch Trailer
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
