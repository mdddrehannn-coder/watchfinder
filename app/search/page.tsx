import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import SearchFilters from "@/components/SearchFilters";
import SearchHistory from "@/components/SearchHistory";
import MovieGrid from "@/components/MovieGrid";
import SearchAnalyticsTracker from "@/components/SearchAnalyticsTracker";
import SeriesCard from "@/components/SeriesCard";
import { getGenres, getMovies, getPlatforms, getPopularSearches, getPublishedSeries, getSearchChannels } from "@/lib/data";
import {
  filterDiscoveryMovies,
  hasOfficialYouTube,
  matchesDiscoveryQuery
} from "@/lib/discovery";
import { splitLanguages } from "@/lib/languages";

export const metadata: Metadata = {
  title: "Search",
  description: "Search movies, web series, anime, genres and streaming platforms on WatchFinder."
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [genres, platforms, popular, movies, channels, webSeries] = await Promise.all([
    getGenres(),
    getPlatforms(),
    getPopularSearches(),
    getMovies({
      type: params.type,
      language: params.language,
      genreSlug: params.genre,
      platformSlug: params.platform,
      year: params.year,
      limit: 300
    }),
    getSearchChannels(params.q || ""),
    getPublishedSeries(120)
  ]);
  let results = movies.filter((movie) => matchesDiscoveryQuery(movie, params.q));
  const normalizedQuery = String(params.q || "").trim().toLowerCase();
  const seriesResults = normalizedQuery
    ? webSeries.filter((series) => `${series.title} ${series.slug} ${series.description || ""} ${series.genre || ""} ${series.language || ""} ${series.platform_name || ""}`.toLowerCase().includes(normalizedQuery))
    : webSeries.slice(0, 12);
  const episodeResults = normalizedQuery
    ? webSeries
      .flatMap((series) => (series.seasons ?? []).flatMap((season) => (season.episodes ?? []).map((episode) => ({ series, season, episode }))))
      .filter(({ series, season, episode }) => `${series.title} ${season.title || ""} ${episode.title} ${episode.description || ""} ${episode.language || series.language || ""}`.toLowerCase().includes(normalizedQuery))
    : [];
  results = filterDiscoveryMovies(results, {
    availability: params.availability,
    freeLegal: params.quick === "freeLegal",
    hindiDubbed: params.quick === "hindiDubbed",
    latest: params.quick === "ottRelease",
    quality: params.quality
  });
  if (params.quick === "officialYouTube") results = results.filter(hasOfficialYouTube);
  if (params.quick === "publicDomain") results = results.filter((movie) => movie.license_type === "public_domain");
  if (params.quick === "movies") results = results.filter((movie) => movie.type === "movie" || movie.content_type === "movie");
  if (params.quick === "webSeries") results = [];
  if (params.quick === "cartoons") results = results.filter((movie) => movie.type === "cartoon" || movie.primary_section === "cartoon");
  if (params.quick === "tvShows") results = results.filter((movie) => movie.type === "tv_show" || movie.primary_section === "tv_show");
  if (params.quick === "hindi") results = results.filter((movie) => splitLanguages(movie.language).some((language) => language.toLowerCase().includes("hindi")));
  if (params.quick === "multilingual") results = results.filter((movie) => splitLanguages(movie.language).length > 1);

  return (
    <main className="page-inner">
      <SearchAnalyticsTracker query={params.q} resultCount={results.length + seriesResults.length + episodeResults.length + channels.length} />
      <section className="search-hero">
        <h1>Search WatchFinder</h1>
        <form className="simple-search-form" action="/search">
          <input name="q" defaultValue={params.q || ""} placeholder="Search by movie, language, genre, platform..." />
          <button className="button primary" type="submit">Search</button>
        </form>
      </section>
      <details className="section panel advanced-filters">
        <summary className="button">Filters</summary>
        <form className="form-grid" action="/search">
          <input type="hidden" name="q" defaultValue={params.q || ""} />
          <SearchFilters genres={genres} platforms={platforms} defaults={params} showDiscoveryFilters />
          <div className="chip-row">
            <a className="chip" href="/search?quick=freeLegal">Free Legal</a>
            <a className="chip" href="/search?quick=hindiDubbed">Hindi Dubbed</a>
            <a className="chip" href="/search?quick=ottRelease">OTT Release</a>
            <a className="chip" href="/search?quick=officialYouTube">Official YouTube</a>
            <a className="chip" href="/search?quick=publicDomain">Public Domain</a>
            <a className="chip" href="/search?quick=movies">Movies</a>
            <a className="chip" href="/search?quick=webSeries">Web Series</a>
            <a className="chip" href="/search?quick=cartoons">Cartoons</a>
            <a className="chip" href="/search?quick=tvShows">TV Shows</a>
            <a className="chip" href="/platforms">Platforms</a>
            <a className="chip" href="/search?quick=hindi">Hindi</a>
            <a className="chip" href="/search?quick=multilingual">Multilingual</a>
          </div>
        </form>
      </details>
      <SearchHistory currentQuery={params.q} />
      {!params.q && !params.quick ? (
        <section className="section">
          <h2>Popular Searches</h2>
          <div className="chip-row">
            {popular.map((term) => (
              <a className="chip" href={`/search?q=${encodeURIComponent(term)}`} key={term}>
                {term}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section className="section search-results-section">
        <div className="section-head">
          <h2>{params.q ? `Results for "${params.q}"` : "Recommended Results"}</h2>
          <p className="muted">{results.length} found</p>
        </div>
        <MovieGrid
          movies={results}
          emptyTitle="No movies found"
          emptyMessage="Try another title, language, or platform."
        />
      </section>
      {seriesResults.length ? (
        <section className="section search-results-section">
          <div className="section-head">
            <h2>Web Series</h2>
            <p className="muted">{seriesResults.length} found</p>
          </div>
          <div className="grid">
            {seriesResults.slice(0, 12).map((series) => <SeriesCard series={series} key={series.id} />)}
          </div>
        </section>
      ) : null}
      {episodeResults.length ? (
        <section className="section search-results-section">
          <div className="section-head">
            <h2>Episodes</h2>
            <p className="muted">{episodeResults.length} found</p>
          </div>
          <div className="grid">
            {episodeResults.slice(0, 12).map(({ series, season, episode }) => (
              <a className="quick-action-card" href={`/web-series/${series.slug}/season/${season.season_number}/episode/${episode.episode_number}`} key={episode.id}>
                <strong>{episode.title}</strong>
                <span>{series.title} - S{season.season_number} E{episode.episode_number}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {channels.length ? (
        <section className="section">
          <div className="section-head">
            <h2>Matching Channels</h2>
            <p className="muted">{channels.length} found</p>
          </div>
          <div className="channel-grid">
            {channels.map((channel) => (
              <ChannelCard
                channel={channel}
                fallbackText={channel.channel_type === "cartoon" ? "Cartoon shows and official links" : "TV shows and official links"}
                href={channel.channel_type === "cartoon" ? `/cartoons/${channel.slug}` : `/tv-shows/${channel.slug}`}
                key={channel.id}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
