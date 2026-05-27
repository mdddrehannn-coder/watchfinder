"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCw, X } from "lucide-react";
import {
  trackTrailerClose,
  trackTrailerFullscreenClicked,
  trackWatchLinkClick
} from "@/lib/analytics";
import YouTubePremiumPlayer, { getYouTubeVideoIdFromUrl, type YouTubeViewMode } from "@/components/YouTubePremiumPlayer";

type PlayerMode = YouTubeViewMode;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function getLockableOrientation() {
  if (typeof screen === "undefined") return undefined;
  return screen.orientation as LockableOrientation | undefined;
}

export type TrailerModalSource =
  | {
      kind: "embed";
      src: string;
      title: string;
    }
  | {
      kind: "official_link";
      url: string;
      platformName: string;
      title: string;
      actionLabel?: string;
      note?: string;
    };

export default function TrailerModal({
  open,
  onClose,
  source,
  movie,
  provider
}: {
  open: boolean;
  onClose: () => void;
  source: TrailerModalSource | null;
  movie: { id: string; slug: string };
  provider?: string | null;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const openStartedAtRef = useRef<number | null>(null);
  const enteredFullscreenRef = useRef(false);
  const modeToastTimerRef = useRef<number | null>(null);
  const [fullscreenHint, setFullscreenHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("fit");
  const [modeToast, setModeToast] = useState<string | null>(null);

  const showModeToast = useCallback(function showModeToast(label: string) {
    if (modeToastTimerRef.current) {
      window.clearTimeout(modeToastTimerRef.current);
    }
    setModeToast(label);
    modeToastTimerRef.current = window.setTimeout(() => setModeToast(null), 1200);
  }, []);

  const enterFullscreen = useCallback(async function enterFullscreen(trackClick = false) {
    const element = modalRef.current;
    if (!element) return;

    if (trackClick) {
      trackTrailerFullscreenClicked(movie, provider || (source?.kind === "official_link" ? source.platformName : "youtube"));
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        enteredFullscreenRef.current = false;
        setIsFullscreen(false);
        showModeToast("Window mode");
        try {
          getLockableOrientation()?.unlock?.();
        } catch {
          // Orientation unlock is not supported in every browser.
        }
        return;
      }

      if (element.requestFullscreen) {
        await element.requestFullscreen();
        enteredFullscreenRef.current = true;
        setIsFullscreen(true);
        showModeToast("Fullscreen");
      }
    } catch {
      setFullscreenHint(true);
    }

    try {
      await getLockableOrientation()?.lock?.("landscape");
    } catch {
      setFullscreenHint(true);
    }
  }, [movie, provider, showModeToast, source]);

  const closeModal = useCallback(async function closeModal() {
    try {
      getLockableOrientation()?.unlock?.();
    } catch {
      // Orientation unlock is not supported in every browser.
    }

    try {
      if (enteredFullscreenRef.current && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Closing the modal should still work if fullscreen exit is rejected.
    } finally {
      if (source?.kind === "embed" && openStartedAtRef.current) {
        const watchSeconds = Math.max(0, Math.round((Date.now() - openStartedAtRef.current) / 1000));
        trackTrailerClose(movie, provider || "youtube", watchSeconds);
      }
      enteredFullscreenRef.current = false;
      openStartedAtRef.current = null;
      setIsFullscreen(false);
      onClose();
    }
  }, [movie, onClose, provider, source]);

  useEffect(() => {
    if (!open) return undefined;
    setFullscreenHint(false);
    openStartedAtRef.current = Date.now();

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    setPlayerMode(isMobile && isLandscape ? "fill" : "fit");

    if (source?.kind === "embed" && isMobile) {
      enterFullscreen();
    }

    return () => {
      try {
        getLockableOrientation()?.unlock?.();
      } catch {
        // Best effort cleanup.
      }
    };
  }, [enterFullscreen, open, source?.kind]);

  useEffect(() => {
    if (!open) return undefined;

    function handleFullscreenChange() {
      const active = document.fullscreenElement === modalRef.current;
      enteredFullscreenRef.current = active;
      setIsFullscreen(active);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [open]);

  useEffect(() => {
    return () => {
      if (modeToastTimerRef.current) {
        window.clearTimeout(modeToastTimerRef.current);
      }
    };
  }, []);

  if (!open || !source) return null;

  const modalClassName = `trailer-modal ${source.kind === "embed" ? "trailer-modal-embed" : "trailer-modal-link"}`;
  const youtubeVideoId = source.kind === "embed" ? getYouTubeVideoIdFromUrl(source.src) : null;
  const modeLabel = playerMode === "center" ? "Fit" : playerMode === "fit" ? "Fill" : "Center";

  function cyclePlayerMode() {
    if (playerMode === "center") {
      setPlayerMode("fit");
      showModeToast("Fit mode");
      return;
    }

    if (playerMode === "fit") {
      setPlayerMode("fill");
      showModeToast("Fill mode");
      return;
    }

    if (!isFullscreen) {
      enterFullscreen(true);
      return;
    }

    setPlayerMode("center");
    showModeToast("Center mode");
  }

  return (
    <div className="trailer-modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <div
        aria-label={source.title}
        aria-modal="true"
        className={modalClassName}
        ref={modalRef}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        {source.kind === "embed" ? (
          <>
            <div className={`trailer-modal-player-shell trailer-player-${playerMode}`}>
              {youtubeVideoId ? (
                <YouTubePremiumPlayer
                  src={source.src}
                  title={source.title}
                  mode={playerMode}
                  modeToast={modeToast}
                  fullscreenHint={fullscreenHint}
                  isFullscreen={isFullscreen}
                  onClose={closeModal}
                  onCycleMode={cyclePlayerMode}
                  onFullscreen={() => enterFullscreen(true)}
                />
              ) : (
                <>
                  <div className="trailer-modal-controls" aria-label="Video controls">
                    <button className="trailer-control-button" type="button" onClick={closeModal} aria-label="Close trailer">
                      <X size={20} />
                    </button>
                    <div className="trailer-control-group">
                      <button
                        className="trailer-control-button trailer-mode-button"
                        type="button"
                        onClick={cyclePlayerMode}
                        aria-label={`Switch video to ${modeLabel} mode`}
                      >
                        {modeLabel}
                      </button>
                      <button
                        className="trailer-control-button"
                        type="button"
                        onClick={() => enterFullscreen(true)}
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                      >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                    </div>
                  </div>
                  <iframe
                    className="trailer-modal-frame"
                    src={source.src}
                    title={source.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </>
              )}
            </div>
            {!youtubeVideoId ? (
              <div className="trailer-modal-bottom-hint">
                <RotateCw size={15} />
                {fullscreenHint ? "Rotate your phone or tap fullscreen for best view." : "Center / Fit / Fill changes how the video fills your screen."}
              </div>
            ) : null}
          </>
        ) : (
          <div className="trailer-modal-official-link">
            <button className="icon-button trailer-modal-close" type="button" onClick={closeModal} aria-label="Close trailer">
              <X size={20} />
            </button>
            <p className="rating-badge">Official watch link</p>
            <h2>{source.title}</h2>
            <p className="muted">{source.note || "This title opens on the official platform. WatchFinder does not host unauthorized movies."}</p>
            <a
              className="button primary"
              href={source.url}
              rel="noreferrer"
              target="_blank"
              onClick={() => trackWatchLinkClick(movie, source.platformName)}
            >
              {source.actionLabel || `Watch on ${source.platformName}`} <ExternalLink size={16} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
