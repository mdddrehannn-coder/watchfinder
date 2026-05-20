import type { Metadata } from "next";
import SearchFilters from "@/components/SearchFilters";
import SearchHistory from "@/components/SearchHistory";
import MovieGrid from "@/components/MovieGrid";
import { getGenres, getMovies, getPlatforms, getPopularSearches } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search",
  description: "Search movies, web series, anime, genres and streaming platforms on WatchFinder."
};

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [genres, platforms, popular, results] = await Promise.all([
    getGenres(),
    getPlatforms(),
    getPopularSearches(),
    getMovies({
      search: params.q,
      type: params.type,
      language: params.language,
      genreSlug: params.genre,
      platformSlug: params.platform,
      year: params.year,
      limit: 72
    })
  ]);

  return (
    <main className="page-inner">
      <h1>Search WatchFinder</h1>
      <form className="section form-grid" action="/search">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={params.q || ""} placeholder="Animal, Netflix, anime, Hindi..." />
        </div>
        <SearchFilters genres={genres} platforms={platforms} />
      </form>
      <SearchHistory currentQuery={params.q} />
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
      <section className="section">
        <h2>{params.q ? `Results for "${params.q}"` : "Recommended Results"}</h2>
        <MovieGrid movies={results} />
      </section>
    </main>
  );
}
