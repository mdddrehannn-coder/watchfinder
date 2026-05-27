"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import type { Series } from "@/types/watchfinder";

export default function SeriesSeasonBrowser({ series }: { series: Series }) {
  const seasons = useMemo(() => series.seasons ?? [], [series.seasons]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(seasons[0]?.id ?? "");
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? seasons[0] ?? null;

  if (!seasons.length) {
    return <div className="empty">No episodes added yet.</div>;
  }

  return (
    <section className="section series-episodes-section">
      <div className="section-head">
        <div>
          <h2>Episodes</h2>
          <p className="muted">Choose a season and play official episodes.</p>
        </div>
      </div>
      <div className="season-tabs" aria-label="Season selector">
        {seasons.map((season) => (
          <button
            className={selectedSeason?.id === season.id ? "chip active" : "chip"}
            key={season.id}
            onClick={() => {
              setSelectedSeasonId(season.id);
              trackEvent({
                event_type: "season_selected",
                metadata: {
                  series_slug: series.slug,
                  season_number: season.season_number
                }
              });
            }}
            type="button"
          >
            Season {season.season_number}
          </button>
        ))}
      </div>

      {selectedSeason ? (
        <div className="episode-grid">
          {(selectedSeason.episodes ?? []).map((episode) => (
            <article className="episode-card" key={episode.id}>
              <div className="episode-thumb">
                {episode.thumbnail_url || series.banner_url || series.poster_url ? (
                  <img src={episode.thumbnail_url || series.banner_url || series.poster_url || ""} alt={episode.title} />
                ) : null}
              </div>
              <div className="episode-body">
                <p className="rating-badge">Episode {episode.episode_number}</p>
                <h3>{episode.title}</h3>
                <div className="meta-line">
                  {episode.duration ? <span>{episode.duration}</span> : null}
                  {episode.release_date ? <span>{new Date(episode.release_date).getFullYear()}</span> : null}
                </div>
                {episode.description ? <p className="muted">{episode.description}</p> : null}
                <Link
                  className="button primary"
                  href={`/web-series/${series.slug}/season/${selectedSeason.season_number}/episode/${episode.episode_number}`}
                  onClick={() => trackEvent({
                    event_type: "episode_view",
                    metadata: {
                      series_slug: series.slug,
                      season_number: selectedSeason.season_number,
                      episode_number: episode.episode_number
                    }
                  })}
                >
                  <Play size={16} /> Play Episode
                </Link>
              </div>
            </article>
          ))}
          {!selectedSeason.episodes?.length ? <div className="empty">No episodes added yet.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
