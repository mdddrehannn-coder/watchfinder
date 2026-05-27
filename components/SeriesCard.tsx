import Link from "next/link";
import type { Series } from "@/types/watchfinder";

function countLabel(series: Series) {
  const seasons = series.season_count ?? series.seasons?.length ?? 0;
  const episodes = series.episode_count ?? series.seasons?.reduce((total, season) => total + (season.episodes?.length ?? 0), 0) ?? 0;
  const seasonLabel = `${seasons} ${seasons === 1 ? "Season" : "Seasons"}`;
  const episodeLabel = `${episodes} ${episodes === 1 ? "Episode" : "Episodes"}`;
  return `${seasonLabel} - ${episodeLabel}`;
}

export default function SeriesCard({ series }: { series: Series }) {
  return (
    <Link className="movie-card series-card" href={`/web-series/${series.slug}`}>
      <div className="poster-frame">
        {series.poster_url ? <img src={series.poster_url} alt={`${series.title} poster`} /> : null}
        <span className="series-card-badge">Series</span>
      </div>
      <div className="movie-body">
        <p className="movie-title" title={series.title}>{series.title}</p>
        <div className="meta-line">
          <span className="movie-type-text">Web Series</span>
        </div>
        <div className="language-tags compact">
          {series.language ? <span className="language-tag">{series.language}</span> : null}
          {series.release_year ? <span className="language-tag quality-tag">{series.release_year}</span> : null}
          {series.rating ? <span className="language-tag quality-tag">{series.rating}</span> : null}
        </div>
        <div className="smart-badge-row">
          <span className="smart-badge">{countLabel(series)}</span>
          {series.genre ? <span className="smart-badge">{series.genre}</span> : null}
        </div>
      </div>
    </Link>
  );
}
