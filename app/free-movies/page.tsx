import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import SearchFilters from "@/components/SearchFilters";
import { getGenres, getMovies, getPlatforms } from "@/lib/data";
import { filterDiscoveryMovies } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Free Legal Movies to Watch Online - WatchFinder",
  description: "Find legally available free movies, public-domain classics, official YouTube titles and licensed videos on WatchFinder."
};

export const dynamic = "force-dynamic";

export default async function FreeMoviesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [genres, platforms, movies] = await Promise.all([
    getGenres(),
    getPlatforms(),
    getMovies({ limit: 120 })
  ]);

  const filtered = filterDiscoveryMovies(movies, {
    freeLegal: true,
    language: params.language,
    genre: params.genre,
    quality: params.quality,
    licenseType: params.licenseType,
    platform: params.platform
  });

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">Legal discovery</p>
        <h1>Free Legal Movies</h1>
        <p className="muted">Watch legally available movies, public-domain classics and official free titles.</p>
      </section>

      <form className="section panel form-grid" action="/free-movies">
        <SearchFilters genres={genres} platforms={platforms} defaults={params} showDiscoveryFilters />
        <div className="field">
          <label htmlFor="licenseType">License type</label>
          <select id="licenseType" name="licenseType" defaultValue={params.licenseType || ""}>
            <option value="">Any legal source</option>
            <option value="public_domain">Public domain</option>
            <option value="creator_permission">Creator permission</option>
            <option value="self_owned">Self owned</option>
            <option value="purchased_license">Purchased license</option>
          </select>
        </div>
      </form>

      <section className="section">
        <div className="section-head">
          <h2>Legal free picks</h2>
          <p className="muted">{filtered.length} titles</p>
        </div>
        <MovieGrid movies={filtered} />
      </section>
    </main>
  );
}
