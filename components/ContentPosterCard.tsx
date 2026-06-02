"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export type PosterCardItem = {
  id: string;
  title: string;
  href: string;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  contentType?: string | null;
  languageLabel?: string | null;
  platformLabel?: string | null;
  updateBadge?: string | null;
};

function typeLabel(value?: string | null) {
  return String(value || "Movie")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ContentPosterCard({
  item,
  sectionName,
  compact = false
}: {
  item: PosterCardItem;
  sectionName?: string;
  compact?: boolean;
}) {
  const image = item.posterUrl || item.bannerUrl;

  return (
    <Link
      className={compact ? "content-poster-card content-poster-card-compact" : "content-poster-card"}
      href={item.href}
      onClick={() => trackEvent({
        event_type: "poster_card_click",
        page_path: "/",
        metadata: {
          section_name: sectionName || null,
          content_slug: item.href.split("/").filter(Boolean).at(-1) || item.id,
          content_type: item.contentType || null,
          platform_name: item.platformLabel || null
        }
      })}
    >
      <div className="content-poster-art">
        {image ? <img src={image} alt={`${item.title} poster`} /> : <span>{item.title.slice(0, 1)}</span>}
        {item.languageLabel ? <span className="content-poster-language">{item.languageLabel}</span> : null}
        {item.updateBadge ? <span className="content-poster-update">{item.updateBadge}</span> : null}
      </div>
      <div className="content-poster-copy">
        <strong title={item.title}>{item.title}</strong>
        {!compact ? (
          <div className="content-poster-meta">
            <span>{typeLabel(item.contentType)}</span>
            {item.platformLabel ? <span>{item.platformLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
