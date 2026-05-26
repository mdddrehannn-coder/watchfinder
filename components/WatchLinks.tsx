"use client";

import { ExternalLink } from "lucide-react";
import PlatformLogo from "@/components/PlatformLogo";
import { trackWatchLinkClick } from "@/lib/analytics";
import { splitLanguages } from "@/lib/languages";
import { buildInAppBrowserHref } from "@/lib/platformBehavior";
import { availabilityLabels, resolveWatchLinkTarget, watchLinkTypeLabels } from "@/lib/watch-links";
import type { MoviePlatformLink } from "@/types/watchfinder";

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isDangerousHref(value?: string | null) {
  return /^(javascript|data|vbscript):/i.test((value || "").trim());
}

export default function WatchLinks({
  links = [],
  movie,
  title
}: {
  links?: MoviePlatformLink[];
  movie?: { id: string; slug: string };
  title?: string;
}) {
  const official = links.filter((link) => link.is_active !== false && link.is_official !== false);
  if (!official.length) return null;

  return (
    <section className="section watch-legally-section">
      <div className="section-head">
        <div>
          <h2>Watch Legally</h2>
          <p className="muted">Available on official platforms. OTT playback opens on the official app/site, not inside WatchFinder.</p>
        </div>
      </div>
      <div className="watch-link-grid">
        {official.map((link) => {
          const target = resolveWatchLinkTarget(link, title || movie?.slug || "");
          const href = target.url && !isDangerousHref(target.url) && target.openMode === "in_app_browser"
            ? buildInAppBrowserHref({
              platform: link.platforms,
              platformName: target.platformName,
              title: title || movie?.slug || "Official title",
              url: target.url,
              movieSlug: movie?.slug
            })
            : target.url && !isDangerousHref(target.url) ? target.url : null;
          const content = (
            <>
              <span className="watch-link-head">
                {link.platforms ? <PlatformLogo platform={link.platforms} /> : <span className="watch-link-platform-fallback">W</span>}
                <span className="watch-link-title">
                  {link.platforms?.name || "Official link"} {target.url ? <ExternalLink size={16} /> : null}
                </span>
              </span>
              <span className="watch-link-meta">
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
              <span className="watch-link-note">{target.note}</span>
              {target.externalOnly ? (
                <span className="watch-link-note ott-external-note">
                  Official platform page. Login may be required. Playback is controlled by {target.platformName}.
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
              target={target.openMode === "in_app_browser" ? undefined : "_blank"}
              rel={target.openMode === "in_app_browser" ? undefined : "noreferrer"}
              key={link.id}
              onClick={() => {
                if (movie) trackWatchLinkClick(movie, target.platformName);
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
