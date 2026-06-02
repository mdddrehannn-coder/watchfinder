import Link from "next/link";
import HomeCategoryTabs from "@/components/HomeCategoryTabs";
import HomepageHeroSlider from "@/components/HomepageHeroSlider";
import HomepageSectionTracker from "@/components/HomepageSectionTracker";
import MovieSlider from "@/components/MovieSlider";
import SeriesCard from "@/components/SeriesCard";
import StreamingPlatformRow from "@/components/StreamingPlatformRow";
import AdSlot from "@/components/AdSlot";
import {
  getAdSlots,
  getChannelLinkedMovies,
  getHomepageHeroMovies,
  getHomepageSectionMovies,
  getPlatforms,
  getPublishedSeries,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    ads,
    platforms,
    heroMovies,
    trending,
    recentlyAdded,
    ottReleases,
    hindiDubbed,
    freeLegal,
    officialYouTube,
    popularCartoons,
    popularTvShows,
    webSeries
  ] = await Promise.all([
    getAdSlots("home"),
    getPlatforms(),
    getHomepageHeroMovies(),
    getHomepageSectionMovies("trending", 12),
    getHomepageSectionMovies("recently_added", 12),
    getHomepageSectionMovies("ott_release", 12),
    getHomepageSectionMovies("hindi_dubbed", 12),
    getHomepageSectionMovies("free_legal", 12),
    getHomepageSectionMovies("official_youtube", 12),
    getHomepageSectionMovies("cartoon", 12).then((items) => items.length ? items : getChannelLinkedMovies("cartoon", 12)),
    getHomepageSectionMovies("tv_show", 12).then((items) => items.length ? items : getChannelLinkedMovies("tv_show", 12)),
    getPublishedSeries(12)
  ]);

  const quickActions = [
    {
      title: "Free Legal Movies",
      text: "Licensed and public-domain picks.",
      href: "/free-movies"
    },
    {
      title: "Hindi Dubbed",
      text: "Hindi audio and dubbed titles.",
      href: "/hindi-dubbed"
    },
    {
      title: "New OTT Releases",
      text: "Latest legal platform updates.",
      href: "/ott-releases"
    },
    {
      title: "Official Trailers",
      text: "Trailers and official clips.",
      href: "/search?q=trailer"
    }
  ];

  return (
    <main className="page-inner streaming-home">
      <HomeCategoryTabs />
      <HomepageHeroSlider movies={heroMovies} />
      <StreamingPlatformRow platforms={platforms} />
      <section className="section homepage-shortcut-strip" aria-label="Quick content shortcuts">
        {quickActions.map((action) => (
          <Link className="quick-action-card" href={action.href} key={action.title}>
            <strong>{action.title}</strong>
            <span>{action.text}</span>
          </Link>
        ))}
      </section>

      <MovieSlider title="Trending Now" movies={trending} href="/movies?section=trending" />
      <MovieSlider title="Recently Added" movies={recentlyAdded} href="/movies?section=recently_added" />
      {webSeries.length ? (
        <section className="section poster-row-section">
          <HomepageSectionTracker sectionName="Web Series" itemCount={webSeries.length} />
          <div className="section-head">
            <h2>Web Series</h2>
            <Link className="muted" href="/web-series">More</Link>
          </div>
          <div className="slider poster-app-row">
            {webSeries.map((series) => <SeriesCard series={series} key={series.id} sectionName="Web Series" />)}
          </div>
        </section>
      ) : null}
      <MovieSlider title="New OTT Releases" movies={ottReleases} href="/ott-releases" />
      <MovieSlider title="Hindi Dubbed" movies={hindiDubbed} href="/hindi-dubbed" />
      <MovieSlider title="Free Legal Movies" movies={freeLegal} href="/free-movies" />
      <MovieSlider title="Official YouTube Movies" movies={officialYouTube} href="/free-movies?platform=youtube" />
      <MovieSlider title="Popular Cartoons" movies={popularCartoons} href="/cartoons" />
      <MovieSlider title="Popular TV Shows" movies={popularTvShows} href="/tv-shows" />
      <AdSlot slot={ads[0]} />
    </main>
  );
}
