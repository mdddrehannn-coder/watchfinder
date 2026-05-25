"use client";

import { X, ExternalLink } from "lucide-react";
import { trackWatchLinkClick } from "@/lib/analytics";

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
  if (!open || !source) return null;

  return (
    <div className="trailer-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-label={source.title}
        aria-modal="true"
        className="trailer-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="icon-button trailer-modal-close" type="button" onClick={onClose} aria-label="Close trailer">
          <X size={20} />
        </button>
        {source.kind === "embed" ? (
          <iframe
            className="trailer-modal-frame"
            src={source.src}
            title={source.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
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
