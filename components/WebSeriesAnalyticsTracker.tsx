"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function WebSeriesAnalyticsTracker({
  seriesSlug
}: {
  seriesSlug: string;
}) {
  useEffect(() => {
    trackEvent({
      event_type: "web_series_view",
      metadata: { series_slug: seriesSlug }
    });
  }, [seriesSlug]);

  return null;
}
