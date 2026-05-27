"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Copy, ExternalLink, RefreshCw, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { isAllowedPlatformHost, isSafeLauncherUrl, platformBehaviorFor } from "@/lib/platformBehavior";

type BrowserState = "loading" | "loaded" | "blocked" | "invalid";

export default function InAppBrowser({
  platform,
  platformName,
  title,
  url,
  movieSlug,
  appRequired = false,
  appUrl,
  appStoreUrl,
  playStoreUrl,
  fallbackNote
}: {
  platform: string;
  platformName: string;
  title: string;
  url: string;
  movieSlug?: string | null;
  appRequired?: boolean;
  appUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  fallbackNote?: string | null;
}) {
  const router = useRouter();
  const behavior = useMemo(() => platformBehaviorFor(platform || platformName), [platform, platformName]);
  const safeUrl = useMemo(() => isSafeLauncherUrl(url), [url]);
  const hostMatches = useMemo(() => safeUrl && isAllowedPlatformHost(url, platform || platformName), [platform, platformName, safeUrl, url]);
  const safeAppUrl = useMemo(() => isSafeLauncherUrl(appUrl || url), [appUrl, url]);
  const shouldTryIframe = !appRequired && safeUrl && hostMatches && behavior.allowIframe;
  const [state, setState] = useState<BrowserState>(() => safeUrl && hostMatches ? (shouldTryIframe ? "loading" : "blocked") : "invalid");
  const [frameKey, setFrameKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const trackedOpenRef = useRef(false);
  const trackedInitialBlockedRef = useRef(false);

  useEffect(() => {
    if (trackedOpenRef.current) return;
    trackedOpenRef.current = true;
    trackEvent({
      event_type: "platform_open_attempt",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform, urlSafe: safeUrl, hostMatches, iframeAttempted: shouldTryIframe, appRequired }
    });
  }, [appRequired, hostMatches, movieSlug, platform, platformName, safeUrl, shouldTryIframe]);

  useEffect(() => {
    if (!appRequired) return;
    trackEvent({
      event_type: "platform_app_required_shown",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform }
    });
    trackEvent({
      event_type: "platform_mobile_web_blocked",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform, source: "admin_app_required_flag" }
    });
  }, [appRequired, movieSlug, platform, platformName]);

  useEffect(() => {
    if (trackedInitialBlockedRef.current || shouldTryIframe || state === "loaded" || state === "loading") return;
    trackedInitialBlockedRef.current = true;
    trackEvent({
      event_type: "platform_iframe_blocked",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: {
        platform,
        reason: safeUrl && hostMatches ? "known_platform_blocks_iframe" : "invalid_or_mismatched_url"
      }
    });
  }, [hostMatches, movieSlug, platform, platformName, safeUrl, shouldTryIframe, state]);

  useEffect(() => {
    if (!shouldTryIframe || state !== "loading") return undefined;
    const timer = window.setTimeout(() => {
      setState("blocked");
      trackEvent({
        event_type: "platform_iframe_blocked",
        movie_slug: movieSlug || null,
        platform_name: platformName,
        metadata: { platform, reason: "timeout_or_csp" }
      });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [frameKey, movieSlug, platform, platformName, shouldTryIframe, state]);

  function refresh() {
    if (!shouldTryIframe) {
      setState(safeUrl && hostMatches ? "blocked" : "invalid");
      return;
    }
    setState("loading");
    setFrameKey((current) => current + 1);
  }

  function iframeLoaded() {
    setState("loaded");
    trackEvent({
      event_type: "platform_iframe_loaded",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform }
    });
  }

  function iframeBlocked(reason: string) {
    setState("blocked");
    trackEvent({
      event_type: "platform_iframe_blocked",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform, reason }
    });
  }

  function openExternal() {
    if (!safeUrl) return;
    trackEvent({
      event_type: "platform_external_opened",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform }
    });
    trackEvent({
      event_type: "watch_link_click",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { source: "in_app_browser_external_button" }
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openApp() {
    const target = appUrl || url;
    if (!safeAppUrl) return;
    trackEvent({
      event_type: "platform_app_open_clicked",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform }
    });
    trackEvent({
      event_type: "platform_external_opened",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform, source: "app_required_button" }
    });
    window.open(target, "_blank", "noopener,noreferrer");
  }

  function reportPlaybackIssue() {
    trackEvent({
      event_type: "platform_mobile_web_blocked",
      movie_slug: movieSlug || null,
      platform_name: platformName,
      metadata: { platform, source: "user_report" }
    });
  }

  async function copyLink() {
    if (!safeUrl) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const reason = appRequired
    ? (fallbackNote || `This title is not supported on mobile web playback. Continue in the official ${platformName} app.`)
    : !safeUrl
    ? "This URL is blocked because it is not a safe HTTPS official link."
    : !hostMatches
      ? "This URL domain does not match the selected platform."
      : behavior.knownBlocksIframe
        ? "This platform may block in-app embedding."
        : "This platform does not allow in-app embedding here.";

  return (
    <main className="in-app-browser-page">
      <header className="in-app-browser-topbar">
        <button className="icon-button" type="button" onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <div className="in-app-browser-title">
          <strong>{platformName}</strong>
          <span>{title}</span>
        </div>
        <button className="icon-button" type="button" onClick={refresh} aria-label="Refresh official page">
          <RefreshCw size={19} />
        </button>
        <button className="button primary in-app-browser-external" type="button" onClick={openExternal} disabled={!safeUrl}>
          <ExternalLink size={17} /> {appRequired ? "Open website" : "Open external"}
        </button>
        {appRequired || behavior.knownBlocksIframe ? (
          <button className="button in-app-browser-external" type="button" onClick={openApp} disabled={!safeAppUrl}>
            Open in App
          </button>
        ) : null}
        <button className="icon-button" type="button" onClick={() => router.push(movieSlug ? `/movie/${movieSlug}` : "/")} aria-label="Close">
          <X size={20} />
        </button>
      </header>

      <section className="in-app-browser-content">
        {shouldTryIframe ? (
          <div className="in-app-browser-frame-shell">
            {state === "loading" ? <div className="in-app-browser-loading">Loading official platform...</div> : null}
            <iframe
              key={frameKey}
              allow="fullscreen; encrypted-media; autoplay; picture-in-picture"
              className={state === "blocked" ? "in-app-browser-frame hidden" : "in-app-browser-frame"}
              onError={() => iframeBlocked("iframe_error")}
              onLoad={iframeLoaded}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
              src={url}
              title={`${platformName} official page`}
            />
          </div>
        ) : null}

        {state === "blocked" || state === "invalid" ? (
          <div className="in-app-browser-fallback">
            <p className="rating-badge">Official platform</p>
            <h1>{appRequired ? `Open in ${platformName} App` : "Open on official platform"}</h1>
            <p>{reason} Continue on the official site/app to watch, sign in, rent, buy, or subscribe.</p>
            <p className="muted">Login session is managed by {platformName} and may require re-login. WatchFinder never captures your credentials.</p>
            <div className="save-actions">
              {appRequired ? (
                <button className="button primary" type="button" onClick={openApp} disabled={!safeAppUrl}>
                  <ExternalLink size={18} /> Open {platformName} App
                </button>
              ) : null}
              <button className="button primary" type="button" onClick={openExternal} disabled={!safeUrl}>
                <ExternalLink size={18} /> Open Official Site
              </button>
              {playStoreUrl ? (
                <a className="button" href={playStoreUrl} target="_blank" rel="noreferrer">Play Store</a>
              ) : null}
              {appStoreUrl ? (
                <a className="button" href={appStoreUrl} target="_blank" rel="noreferrer">App Store</a>
              ) : null}
              <button className="button" type="button" onClick={copyLink} disabled={!safeUrl}>
                <Copy size={18} /> {copied ? "Copied" : "Copy Link"}
              </button>
              <button className="button ghost" type="button" onClick={reportPlaybackIssue}>
                <AlertTriangle size={18} /> Report playback issue
              </button>
              <button className="button ghost" type="button" onClick={() => router.push(movieSlug ? `/movie/${movieSlug}` : "/")}>
                Back to WatchFinder
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
