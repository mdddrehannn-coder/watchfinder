"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock, Heart, Play, RotateCcw, Trash2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { useFavorites, useWatchHistory, type FavoriteRecord, type WatchHistoryRecord } from "@/lib/user-library";

function formatType(value?: string | null) {
  return String(value || "movie").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Recently";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "Recently";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function progressPercent(item: WatchHistoryRecord) {
  if (!item.duration_seconds) return 0;
  return Math.min(100, Math.max(0, Math.round((item.progress_seconds / item.duration_seconds) * 100)));
}

function analyticsMovieId(value?: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function LibraryPoster({
  item
}: {
  item: FavoriteRecord | WatchHistoryRecord;
}) {
  return (
    <div className="library-poster-art">
      {item.poster_url ? <img src={item.poster_url} alt={`${item.title || item.content_slug} poster`} /> : <span>{(item.title || item.content_slug).slice(0, 1)}</span>}
    </div>
  );
}

export function FavoritesClient() {
  const { favorites, loading, remove } = useFavorites();

  if (loading) return <div className="profile-library-grid"><div className="panel skeleton-card" /></div>;

  if (!favorites.length) {
    return (
      <div className="panel profile-empty-state">
        <Heart size={28} />
        <h2>No favorites yet</h2>
        <p className="muted">Add movies or shows to see them here.</p>
        <Link className="button primary" href="/movies">Browse movies</Link>
      </div>
    );
  }

  return (
    <div className="profile-library-grid">
      {favorites.map((item) => (
        <article className="profile-library-card" key={`${item.source}-${item.id}-${item.content_slug}`}>
          <Link className="profile-library-main" href={item.href || `/movie/${item.content_slug}`}>
            <LibraryPoster item={item} />
            <div>
              <span className="status-badge">{formatType(item.content_type)}</span>
              <h2>{item.title || item.content_slug}</h2>
              <p className="muted">Saved {formatRelativeTime(item.created_at)}</p>
            </div>
          </Link>
          <button className="button ghost profile-library-remove" type="button" onClick={() => remove(item)}>
            <Trash2 size={16} /> Remove
          </button>
        </article>
      ))}
    </div>
  );
}

export function WatchHistoryClient() {
  const { history, loading, remove, clear } = useWatchHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  async function clearAll() {
    await clear();
    setConfirmClear(false);
  }

  if (loading) return <div className="profile-library-grid"><div className="panel skeleton-card" /></div>;

  if (!history.length) {
    return (
      <div className="panel profile-empty-state">
        <Clock size={28} />
        <h2>No watch history yet</h2>
        <p className="muted">Start watching to see your activity here.</p>
        <Link className="button primary" href="/movies">Browse movies</Link>
      </div>
    );
  }

  return (
    <div className="profile-library-stack">
      <div className="profile-library-toolbar">
        <div>
          <strong>{history.length} recently watched</strong>
          <p className="muted">Continue watching and recent activity are stored on this profile.</p>
        </div>
        {confirmClear ? (
          <div className="save-actions">
            <button className="button danger" type="button" onClick={clearAll}>Confirm clear all</button>
            <button className="button ghost" type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button className="button ghost" type="button" onClick={() => setConfirmClear(true)}>
            <Trash2 size={16} /> Clear all history
          </button>
        )}
      </div>
      <div className="profile-library-grid">
        {history.map((item) => {
          const percent = progressPercent(item);
          const actionLabel = item.progress_seconds && item.duration_seconds ? "Resume" : "Open again";
          return (
            <article className="profile-library-card" key={`${item.source}-${item.id}-${item.content_slug}`}>
              <Link
                className="profile-library-main"
                href={item.href || `/movie/${item.content_slug}`}
                onClick={() => trackEvent({
                  event_type: "continue_watching_clicked",
                  movie_id: analyticsMovieId(item.content_id),
                  movie_slug: item.content_slug,
                  platform_name: item.platform_name || null,
                  metadata: { content_type: item.content_type, action: item.last_action || null }
                })}
              >
                <LibraryPoster item={item} />
                <div>
                  <span className="status-badge">{formatType(item.content_type)}</span>
                  <h2>{item.title || item.content_slug}</h2>
                  <p className="muted">Last watched {formatRelativeTime(item.last_watched_at)}</p>
                  <div className="profile-history-badges">
                    {item.platform_name ? <span className="platform-badge">{item.platform_name}</span> : null}
                    {item.last_action ? <span className="language-tag">{item.last_action.replace(/_/g, " ")}</span> : null}
                    <span className="language-tag">{item.watch_count}x</span>
                  </div>
                  {percent ? (
                    <div className="continue-progress" aria-label={`${percent}% watched`}>
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  ) : null}
                  <span className="button primary profile-resume-button">
                    {percent ? <Play size={16} /> : <RotateCcw size={16} />}
                    {actionLabel}
                  </span>
                </div>
              </Link>
              <button className="button ghost profile-library-remove" type="button" onClick={() => remove(item)}>
                <Trash2 size={16} /> Remove
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
