"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function HomepageSectionTracker({
  sectionName,
  itemCount
}: {
  sectionName: string;
  itemCount: number;
}) {
  useEffect(() => {
    trackEvent({
      event_type: "homepage_section_view",
      page_path: "/",
      metadata: { section_name: sectionName, item_count: itemCount }
    });
  }, [itemCount, sectionName]);

  return null;
}
