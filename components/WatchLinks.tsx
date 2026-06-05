"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import PlatformLogo from "@/components/PlatformLogo";
import { trackEvent, trackWatchLinkClick } from "@/lib/analytics";
import { splitLanguages } from "@/lib/languages";
import { buildInAppBrowserHref } from "@/lib/platformBehavior";
import { recordWatchHistory } from "@/lib/user-library";
import { availabilityLabels, isAppRequiredLink, resolveWatchLinkTarget, watchLinkTypeLabels } from "@/lib/watch-links";
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
  movie?: { id: string; slug: string; title?: string | null; posterUrl?: string | null; contentType?: string | null };
  title?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [appFallback, setAppFallback] = useState<{
    platformName: string;
    officialUrl?: string | null;
    appUrl?: string | null;
    appStoreUrl?: string | null;
    playStoreUrl?: string | null;
    note?: string | null;
  } | null>(null);
  const official = links.filter((link) => link.is_active !== false && link.is_official !== false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
          const appRequiredOnThisDevice = Boolean(link.app_required) || (isMobile && link.mobile_web_supported === "no");
          const href = target.url && !isDangerousHref(target.url) && target.openMode === "in_app_browser"
            ? buildInAppBrowserHref({
              platform: link.platforms,
              platformName: target.platformName,
              title: title || movie?.slug || "Official title",
              url: target.url,
              movieSlug: movie?.slug,
              appRequired: appRequiredOnThisDevice,
              appUrl: target.appUrl,
              appStoreUrl: target.appStoreUrl,
              playStoreUrl: target.playStoreUrl,
              fallbackNote: target.fallbackNote
            })
            : target.url && !isDangerousHref(target.url) ? target.url : null;
          const appFallbackNote = link.fallback_note || target.note || `This title is not supported on mobile web playback. Continue in the official ${target.platformName} app.`;
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
                {isAppRequiredLink(link) ? <span className="status-badge status-draft">App Required</span> : null}
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
              {isAppRequiredLink(link) ? (
                <span className="watch-link-note ott-external-note">
                  Playback is controlled by {target.platformName}. This title may not play on mobile web.
                </span>
              ) : null}
              <span className={href ? "button primary watch-link-button" : "button ghost watch-link-button disabled"}>
                {appRequiredOnThisDevice ? `Open ${target.platformName} App` : target.label}
              </span>
            </>
          );

          if (href && appRequiredOnThisDevice) {
            return (
              <button
                className="watch-link-card watch-link-card-button"
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
                  trackEvent({
                    event_type: "platform_app_required_shown",
                    movie_slug: movie?.slug || null,
                    platform_name: target.platformName,
                    metadata: { source: "watch_link_card" }
                  });
                  setAppFallback({
                    platformName: target.platformName,
                    officialUrl: target.url,
                    appUrl: target.appUrl || target.url,
                    appStoreUrl: target.appStoreUrl,
                    playStoreUrl: target.playStoreUrl,
                    note: appFallbackNote
                  });
                }}
                type="button"
              >
                {content}
              </button>
            );
          }

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
      {appFallback ? (
        <div className="admin-action-modal-backdrop" role="presentation" onMouseDown={() => setAppFallback(null)}>
          <section
            aria-labelledby="app-required-title"
            aria-modal="true"
            className="admin-action-modal app-required-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="section-head">
              <div>
                <p className="status-badge status-draft">App Required</p>
                <h2 id="app-required-title">Open in {appFallback.platformName} App</h2>
                <p className="muted">{appFallback.note || `This title is not supported on mobile web playback. Continue in the official ${appFallback.platformName} app.`}</p>
              </div>
            </div>
            <div className="save-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => {
                  trackEvent({
                    event_type: "platform_app_open_clicked",
                    movie_slug: movie?.slug || null,
                    platform_name: appFallback.platformName,
                    metadata: { source: "app_required_modal" }
                  });
                  if (movie) {
                    recordWatchHistory({
                      content_id: movie.id,
                      content_slug: movie.slug,
                      content_type: movie.contentType || "movie",
                      title: movie.title || title || movie.slug,
                      poster_url: movie.posterUrl || null,
                      platform_name: appFallback.platformName,
                      href: `/movie/${movie.slug}`
                    }, "platform_open", { platform_name: appFallback.platformName });
                  }
                  window.open(appFallback.appUrl || appFallback.officialUrl || "", "_blank", "noopener,noreferrer");
                }}
              >
                Open {appFallback.platformName} App
              </button>
              {appFallback.officialUrl ? (
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    trackEvent({
                      event_type: "platform_external_opened",
                      movie_slug: movie?.slug || null,
                      platform_name: appFallback.platformName,
                      metadata: { source: "app_required_modal_website" }
                    });
                    window.open(appFallback.officialUrl || "", "_blank", "noopener,noreferrer");
                  }}
                >
                  Open Official Website
                </button>
              ) : null}
              {appFallback.playStoreUrl ? <a className="button" href={appFallback.playStoreUrl} target="_blank" rel="noreferrer">Play Store</a> : null}
              {appFallback.appStoreUrl ? <a className="button" href={appFallback.appStoreUrl} target="_blank" rel="noreferrer">App Store</a> : null}
              <button className="button ghost" type="button" onClick={() => setAppFallback(null)}>
                Back to WatchFinder
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
