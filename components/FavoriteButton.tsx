"use client";

import { Heart } from "lucide-react";
import { useMemo } from "react";
import { cx } from "@/lib/format";
import { type LibraryContent, useFavorites } from "@/lib/user-library";
import type { Movie } from "@/types/watchfinder";

function contentFromMovie(movie: Movie): LibraryContent {
  return {
    content_id: movie.id,
    content_slug: movie.slug,
    content_type: movie.content_type || movie.type || "movie",
    title: movie.title,
    poster_url: movie.poster_url || movie.banner_url || null,
    platform_name: movie.platform_name || null,
    href: `/movie/${movie.slug}`
  };
}

export default function FavoriteButton({
  movie,
  content,
  compact = false
}: {
  movie?: Movie;
  content?: LibraryContent;
  compact?: boolean;
}) {
  const favoriteContent = useMemo(() => content || (movie ? contentFromMovie(movie) : null), [content, movie]);
  const { favorite, loading, message, toggle } = useFavorites(favoriteContent);

  if (!favoriteContent) return null;

  return (
    <span className="favorite-action-wrap">
      <button
        aria-pressed={favorite}
        className={cx("button favorite-toggle", favorite && "favorite-toggle-active", compact && "favorite-toggle-compact")}
        disabled={loading}
        onClick={toggle}
        type="button"
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        {compact ? null : favorite ? "Remove from favorites" : "Add to favorites"}
      </button>
      {message ? <span className="favorite-toast">{message}</span> : null}
    </span>
  );
}
