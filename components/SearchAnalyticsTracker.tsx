"use client";

import { useEffect } from "react";
import { trackSearch } from "@/lib/analytics";

export default function SearchAnalyticsTracker({
  query,
  resultCount
}: {
  query?: string;
  resultCount: number;
}) {
  useEffect(() => {
    if (query?.trim()) trackSearch(query, { source: "search_page", result_count: resultCount });
  }, [query, resultCount]);

  return null;
}
