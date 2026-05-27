"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function EpisodeAnalyticsTracker({
  seriesSlug,
  seasonNumber,
  episodeNumber,
  eventType = "episode_view"
}: {
  seriesSlug: string;
  seasonNumber: number;
  episodeNumber: number;
  eventType?: "episode_view" | "episode_play";
}) {
  useEffect(() => {
    trackEvent({
      event_type: eventType,
      metadata: {
        series_slug: seriesSlug,
        season_number: seasonNumber,
        episode_number: episodeNumber
      }
    });
  }, [episodeNumber, eventType, seasonNumber, seriesSlug]);

  return null;
}
