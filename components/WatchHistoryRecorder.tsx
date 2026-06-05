"use client";

import { useEffect } from "react";
import { recordWatchHistory, type LibraryContent } from "@/lib/user-library";
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

export default function WatchHistoryRecorder({
  movie,
  content,
  action = "detail_view"
}: {
  movie?: Movie;
  content?: LibraryContent;
  action?: string;
}) {
  useEffect(() => {
    const historyContent = content || (movie ? contentFromMovie(movie) : null);
    if (!historyContent?.content_slug) return;
    recordWatchHistory(historyContent, action);
  }, [action, content, movie]);

  return null;
}
