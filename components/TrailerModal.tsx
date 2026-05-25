"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, X, ExternalLink } from "lucide-react";
import { trackWatchLinkClick } from "@/lib/analytics";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

function getLockableOrientation() {
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
  movie
}: {
  open: boolean;
  onClose: () => void;
  source: TrailerModalSource | null;
  movie: { id: string; slug: string };
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const enteredFullscreenRef = useRef(false);
  const [fullscreenHint, setFullscreenHint] = useState(false);

  const enterFullscreen = useCallback(async function enterFullscreen() {
    const element = modalRef.current;
    if (!element) return;

    try {
      if (!document.fullscreenElement && element.requestFullscreen) {
        await element.requestFullscreen();
        enteredFullscreenRef.current = true;
      }
    } catch {
      setFullscreenHint(true);
    }

    try {
      await getLockableOrientation()?.lock?.("landscape");
    } catch {
      setFullscreenHint(true);
    }
  }, []);

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
      enteredFullscreenRef.current = false;
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    setFullscreenHint(false);
    if (source?.kind === "embed" && window.matchMedia("(max-width: 720px)").matches) {
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

  if (!open || !source) return null;

  return (
    <div className="trailer-modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <div
        aria-label={source.title}
        aria-modal="true"
        className="trailer-modal"
        ref={modalRef}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="icon-button trailer-modal-close" type="button" onClick={closeModal} aria-label="Close trailer">
          <X size={20} />
        </button>
        {source.kind === "embed" ? (
          <div className="trailer-modal-player-shell">
            <button className="button trailer-fullscreen-button" type="button" onClick={enterFullscreen}>
              <Maximize2 size={16} /> Fullscreen
            </button>
            <iframe
              className="trailer-modal-frame"
              src={source.src}
              title={source.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
            {fullscreenHint ? <p className="trailer-modal-hint">Tap fullscreen icon for best viewing.</p> : null}
          </div>
        ) : (
          <div className="trailer-modal-official-link">
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
