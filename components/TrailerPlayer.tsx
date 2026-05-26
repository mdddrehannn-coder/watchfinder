"use client";

import { Play } from "lucide-react";
import TrailerModalTrigger from "@/components/TrailerModalTrigger";
import { getYouTubeEmbedUrl } from "@/lib/format";

export default function TrailerPlayer({
  trailerUrl,
  movieId,
  movieSlug,
  provider = "youtube",
  title = "WatchFinder"
}: {
  trailerUrl?: string | null;
  movieId?: string;
  movieSlug?: string;
  provider?: string | null;
  title?: string;
}) {
  const embedUrl = getYouTubeEmbedUrl(trailerUrl);

  if (!embedUrl || !movieId || !movieSlug) {
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
    <section className="section official-trailer-panel" id="trailer">
      <div className="section-head">
        <h2>Official Trailer</h2>
      </div>
      <TrailerModalTrigger
        className="official-trailer-launch"
        trailerUrl={trailerUrl}
        movieId={movieId}
        movieSlug={movieSlug}
        provider={provider}
        title={title}
        buttonLabel="Open Official Trailer"
      >
        <span className="official-trailer-launch-icon" aria-hidden="true">
          <Play size={28} fill="currentColor" />
        </span>
        <span className="official-trailer-copy">
          <strong>Watch Official Trailer</strong>
          <span>Open the fullscreen WatchFinder player.</span>
        </span>
        <span className="official-trailer-cta">Play</span>
      </TrailerModalTrigger>
    </section>
  );
}
