"use client";

import { ExternalLink } from "lucide-react";
import { trackWatchLinkClick } from "@/lib/analytics";
import { splitLanguages } from "@/lib/languages";
import type { MoviePlatformLink } from "@/types/watchfinder";

const availabilityLabels: Record<string, string> = {
  subscription: "Subscription",
  rent: "Rent",
  buy: "Buy",
  free: "Free",
  official: "Official"
};

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function WatchLinks({
  links = [],
  movie
}: {
  links?: MoviePlatformLink[];
  movie?: { id: string; slug: string };
}) {
  const official = links.filter((link) => link.watch_url && link.is_official !== false);
  if (!official.length) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Where to Watch Legally</h2>
      </div>
      <div className="watch-link-grid">
        {official.map((link) => (
          <a
            className="watch-link-card"
            href={link.watch_url || "#"}
            target="_blank"
            rel="noreferrer"
            key={link.id}
            onClick={() => {
              if (movie) trackWatchLinkClick(movie, link.platforms?.name || "Official link");
            }}
          >
            <span className="watch-link-title">
              {link.platforms?.name || "Official link"} <ExternalLink size={16} />
            </span>
            <span className="watch-link-meta">
              {link.availability_type ? (
                <span className="platform-badge">{availabilityLabels[link.availability_type] || link.availability_type}</span>
              ) : null}
              {splitCsv(link.quality).map((quality) => (
                <span className="language-tag" key={quality}>{quality}</span>
              ))}
              {splitLanguages(link.language).map((language) => (
                <span className="language-tag" key={language}>{language}</span>
              ))}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
