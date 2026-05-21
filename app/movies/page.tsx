import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import SearchFilters from "@/components/SearchFilters";
import { getGenres, getMovies, getPlatforms } from "@/lib/data";
import { filterDiscoveryMovies } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Movies and Shows - WatchFinder",
  description: "Browse legal movie listings, Hindi dubbed titles, free legal movies, trailers and official OTT availability."
};

export default async function MoviesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [genres, platforms, movies] = await Promise.all([
    getGenres(),
    getPlatforms(),
    getMovies({
      search: params.q,
      year: params.year,
      limit: 120
    })
  ]);

  const filtered = filterDiscoveryMovies(movies, {
    type: params.type,
    language: params.language,
    genre: params.genre,
    platform: params.platform,
    quality: params.quality,
    availability: params.availability,
    freeLegal: params.freeLegal === "on",
    hindiDubbed: params.hindiDubbed === "on",
    latest: params.latest === "on",
    trending: params.trending === "on"
  });

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">Browse</p>
        <h1>Movies and Shows</h1>
        <p className="muted">Browse legal trailers, free listings, Hindi dubbed picks and official OTT watch links.</p>
      </section>

      <form className="section panel form-grid" action="/movies">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" defaultValue={params.q || ""} placeholder="Title, platform, Hindi, free..." />
        </div>
        <SearchFilters genres={genres} platforms={platforms} defaults={params} showDiscoveryFilters />
        <div className="chip-row">
          <label className="chip"><input name="freeLegal" type="checkbox" defaultChecked={params.freeLegal === "on"} /> Free Legal</label>
          <label className="chip"><input name="hindiDubbed" type="checkbox" defaultChecked={params.hindiDubbed === "on"} /> Hindi Dubbed</label>
          <label className="chip"><input name="latest" type="checkbox" defaultChecked={params.latest === "on"} /> Latest</label>
          <label className="chip"><input name="trending" type="checkbox" defaultChecked={params.trending === "on"} /> Trending</label>
        </div>
      </form>

      <section className="section">
        <div className="section-head">
          <h2>Browse results</h2>
          <p className="muted">{filtered.length} titles</p>
        </div>
        <MovieGrid movies={filtered} />
      </section>
    </main>
  );
}
