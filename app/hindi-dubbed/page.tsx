import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getMovies, getPlatforms } from "@/lib/data";
import { filterDiscoveryMovies, isLegalFreeMovie, platformMatches } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Hindi Dubbed Movie Finder - WatchFinder",
  description: "Find South, Hollywood, anime and OTT titles available in Hindi with official trailers and legal watch links."
};

export default async function HindiDubbedPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [platforms, movies] = await Promise.all([getPlatforms(), getMovies({ limit: 120 })]);
  let filtered = filterDiscoveryMovies(movies, {
    hindiDubbed: true,
    platform: params.platform,
    quality: params.quality
  });

  if (params.quick === "south") {
    filtered = filtered.filter((movie) =>
      ["Tamil", "Telugu", "Malayalam", "Kannada"].some((language) => movie.language?.includes(language))
    );
  }
  if (params.quick === "hollywood") filtered = filtered.filter((movie) => movie.language?.includes("English"));
  if (params.quick === "anime") filtered = filtered.filter((movie) => movie.type === "anime");
  if (params.quick === "free") filtered = filtered.filter(isLegalFreeMovie);
  if (params.platform) {
    filtered = filtered.filter((movie) => movie.movie_platform_links?.some((link) => platformMatches(link, params.platform)));
  }

  const quickFilters = [
    ["south", "South Hindi Dubbed"],
    ["hollywood", "Hollywood Hindi Dubbed"],
    ["anime", "Anime Hindi Dubbed"],
    ["free", "Free Hindi Dubbed"]
  ];

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">Hindi-friendly</p>
        <h1>Hindi Dubbed Movie Finder</h1>
        <p className="muted">Find South, Hollywood, anime and OTT titles available in Hindi.</p>
      </section>

      <form className="section panel form-grid" action="/hindi-dubbed">
        <div className="chip-row">
          {quickFilters.map(([value, label]) => (
            <label className="chip" key={value}>
              <input name="quick" type="radio" value={value} defaultChecked={params.quick === value} /> {label}
            </label>
          ))}
        </div>
        <div className="form-grid two">
          <div className="field">
            <label htmlFor="platform">Platform</label>
            <select id="platform" name="platform" defaultValue={params.platform || ""}>
              <option value="">All platforms</option>
              {platforms.map((platform) => (
                <option value={platform.slug} key={platform.id}>{platform.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="quality">Quality</label>
            <select id="quality" name="quality" defaultValue={params.quality || ""}>
              <option value="">Any quality</option>
              <option value="720p HD">720p HD</option>
              <option value="1080p Full HD">1080p Full HD</option>
              <option value="2160p 4K">2160p 4K</option>
              <option value="HDR">HDR</option>
            </select>
          </div>
        </div>
        <button className="button primary" type="submit">Find Hindi titles</button>
      </form>

      <section className="section">
        <div className="section-head">
          <h2>Hindi dubbed picks</h2>
          <p className="muted">{filtered.length} titles</p>
        </div>
        <MovieGrid movies={filtered} />
      </section>
    </main>
  );
}
