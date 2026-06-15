"use client";

import { ExternalLink } from "lucide-react";
import PlatformLogo from "@/components/PlatformLogo";
import { accessTypeFromAvailability, accessTypeMeta } from "@/lib/access-type";
import { trackWatchLinkClick } from "@/lib/analytics";
import { splitLanguages } from "@/lib/languages";
import { recordWatchHistory } from "@/lib/user-library";
import { availabilityLabels, resolveWatchLinkTarget, watchLinkTypeLabels } from "@/lib/watch-links";
import type { MoviePlatformLink } from "@/types/watchfinder";

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isBrowserHref(value?: string | null) {
  const href = (value || "").trim();
  if (!href || /^(javascript|data|vbscript|intent|market):/i.test(href)) return false;
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

export default function WatchLinks({
  links = [],
  movie,
  title
}: {
  links?: MoviePlatformLink[];
  movie?: { id: string; slug: string; title?: string | null; posterUrl?: string | null; contentType?: string | null; accessType?: string | null };
  title?: string;
}) {
  const official = links.filter((link) => link.is_active !== false && link.is_official !== false);

  if (!official.length) return null;

  return (
    <section className="section watch-legally-section">
      <div className="section-head">
        <div>
          <h2>Watch Legally</h2>
          <p className="muted">Available on official platforms. OTT links open in your browser; WatchFinder does not launch apps or store videos.</p>
        </div>
      </div>
      <div className="watch-link-grid">
        {official.map((link) => {
          const target = resolveWatchLinkTarget(link, title || movie?.slug || "");
          const href = isBrowserHref(target.url) ? target.url : null;
          const access = accessTypeMeta(movie?.accessType || accessTypeFromAvailability(link.availability_type));
          const content = (
            <>
              <span className="watch-link-head">
                {link.platforms ? <PlatformLogo platform={link.platforms} /> : <span className="watch-link-platform-fallback">W</span>}
                <span className="watch-link-title">
                  {link.platforms?.name || "Official link"} {target.url ? <ExternalLink size={16} /> : null}
                </span>
              </span>
              <span className="watch-link-meta">
                <span className={access.className}>{access.label}</span>
                {link.availability_type ? (
                  <span className="platform-badge">{availabilityLabels[link.availability_type] || link.availability_type}</span>
                ) : null}
                <span className="platform-badge">{watchLinkTypeLabels[target.type] || target.type}</span>
                {splitCsv(link.quality).map((quality) => (
                  <span className="language-tag" key={quality}>{quality}</span>
                ))}
                {splitLanguages(link.language).map((language) => (
                  <span className="language-tag" key={language}>{language}</span>
                ))}
              </span>
              <span className="watch-link-note">
                Watch on {target.platformName || link.platforms?.name || "official platform"} - {access.detail}.
              </span>
              <span className="watch-link-note">{target.note}</span>
              {target.externalOnly ? (
                <span className="watch-link-note ott-external-note">
                  Official platform page. Login may be required. Playback is controlled by {target.platformName} in the browser.
                </span>
              ) : null}
              <span className={href ? "button primary watch-link-button" : "button ghost watch-link-button disabled"}>
                {target.label}
              </span>
            </>
          );

          if (!href) {
            return <div className="watch-link-card" key={link.id}>{content}</div>;
          }

          return (
            <a
              className="watch-link-card"
              href={href}
              target="_blank"
              rel="noreferrer"
              key={link.id}
              onClick={() => {
                if (movie) trackWatchLinkClick(movie, target.platformName);
                if (movie) {
                  recordWatchHistory({
                    content_id: movie.id,
                    content_slug: movie.slug,
                    content_type: movie.contentType || "movie",
                    title: movie.title || title || movie.slug,
                    poster_url: movie.posterUrl || null,
                    platform_name: target.platformName,
                    href: `/movie/${movie.slug}`
                  }, "platform_open", { platform_name: target.platformName });
                }
              }}
            >
              {content}
            </a>
          );
        })}
      </div>
    </section>
  );
}
