import Link from "next/link";
import HeroCarousel from "@/components/HeroCarousel";
import MovieSlider from "@/components/MovieSlider";
import PromotionBanner from "@/components/PromotionBanner";
import AdSlot from "@/components/AdSlot";
import {
  getAdSlots,
  getMovies,
  getPlatforms,
  getPromotions
} from "@/lib/data";

export default async function HomePage() {
  const [
    heroPromotions,
    middlePromotions,
    ads,
    platforms,
    trending,
    latest,
    featured,
    hindi,
    bollywood,
    hollywood,
    southIndian,
    webSeries,
    anime
  ] = await Promise.all([
    getPromotions("home_hero"),
    getPromotions("home_middle"),
    getAdSlots("home"),
    getPlatforms(),
    getMovies({ trending: true, limit: 12 }),
    getMovies({ latest: true, limit: 12 }),
    getMovies({ featured: true, limit: 12 }),
    getMovies({ language: "Hindi", limit: 12 }),
    getMovies({ language: "Hindi", type: "movie", limit: 12 }),
    getMovies({ language: "English", type: "movie", limit: 12 }),
    getMovies({ language: "Tamil", limit: 12 }),
    getMovies({ type: "tv_show", limit: 12 }),
    getMovies({ type: "anime", limit: 12 })
  ]);

  return (
    <main className="page-inner">
      <HeroCarousel promotions={heroPromotions} />

      <section className="section">
        <div className="tabs">
          <Link className="tab" href="/search">
            Recommend
          </Link>
          <Link className="tab" href="/movies">
            Movies
          </Link>
          <Link className="tab" href="/tv-shows">
            TV Shows
          </Link>
          <Link className="tab" href="/anime">
            Anime
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Streaming Platforms</h2>
          <Link className="muted" href="/platforms">
            View all
          </Link>
        </div>
        <div className="platform-grid">
          {platforms.slice(0, 8).map((platform) => (
            <Link className="platform-card" href={`/platform/${platform.slug}`} key={platform.id}>
              <div className="platform-logo">
                {platform.logo_url ? <img src={platform.logo_url} alt={platform.name} /> : platform.name.slice(0, 1)}
              </div>
              <strong>{platform.name}</strong>
              <p className="muted">Official titles and watch links</p>
            </Link>
          ))}
        </div>
      </section>

      <MovieSlider title="Trending Now" movies={trending} href="/categories?trending=true" />
      <MovieSlider title="Latest Releases" movies={latest} href="/categories?latest=true" />
      <MovieSlider title="Featured" movies={featured} />
      <PromotionBanner promotion={middlePromotions[0]} />
      <AdSlot slot={ads[0]} />
      <MovieSlider title="Hindi Dubbed" movies={hindi} />
      <MovieSlider title="Bollywood" movies={bollywood} />
      <MovieSlider title="Hollywood" movies={hollywood} />
      <MovieSlider title="South Indian" movies={southIndian} />
      <MovieSlider title="Web Series" movies={webSeries} href="/tv-shows" />
      <MovieSlider title="Anime" movies={anime} href="/anime" />
    </main>
  );
}
