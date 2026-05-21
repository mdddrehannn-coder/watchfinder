"use client";

import { useEffect } from "react";
import { trackMovieView } from "@/lib/analytics";

export default function MovieAnalyticsTracker({ movieId, slug }: { movieId: string; slug: string }) {
  useEffect(() => {
    trackMovieView({ id: movieId, slug });
  }, [movieId, slug]);

  return null;
}
