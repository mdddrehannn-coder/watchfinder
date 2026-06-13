import Link from "next/link";
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
  getMovies,
  getPlatforms,
  getPublishedSeries,
} from "@/lib/data";
import { filterDiscoveryMovies } from "@/lib/discovery";
import type { Movie } from "@/types/watchfinder";

export const dynamic = "force-dynamic";

function uniqueMovies(movies: Movie[]) {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    const key = [
      movie.tmdb_id ? `tmdb:${movie.tmdb_id}` : "",
      movie.official_watch_url ? `watch:${movie.official_watch_url}` : "",
      movie.slug ? `slug:${movie.slug}` : "",
      movie.id ? `id:${movie.id}` : ""
    ].find(Boolean) || movie.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contentTypeMatches(movie: Movie, type: string) {
  return movie.content_type === type || movie.type === type;
}

export default async function HomePage() {
  const [
    ads,
    platforms,
    heroMovies,
    allMovies,
    trendingMovies,
    latestMovies,
    channelCartoons,
    channelTvShows,
    webSeries
  ] = await Promise.all([
    getAdSlots("home"),
    getPlatforms(),
    getHomepageHeroMovies(),
    getMovies({ limit: 120, createdDesc: true }),
    getMovies({ trending: true, limit: 24, createdDesc: true }),
    getMovies({ latest: true, limit: 24, createdDesc: true }),
    getChannelLinkedMovies("cartoon", 12),
    getChannelLinkedMovies("tv_show", 12),
    getPublishedSeries(12)
  ]);

  const trending = uniqueMovies(trendingMovies.length ? trendingMovies : allMovies).slice(0, 12);
  const recentlyAdded = uniqueMovies(allMovies).slice(0, 12);
  const ottReleases = uniqueMovies(latestMovies.length ? latestMovies : allMovies).slice(0, 12);
  const hindiDubbed = filterDiscoveryMovies(allMovies, { hindiDubbed: true }).slice(0, 12);
  const freeLegal = filterDiscoveryMovies(allMovies, { freeLegal: true }).slice(0, 12);
  const officialYouTube = filterDiscoveryMovies(allMovies, { officialYouTube: true }).slice(0, 12);
  const popularCartoons = uniqueMovies([
    ...channelCartoons,
    ...allMovies.filter((movie) => contentTypeMatches(movie, "cartoon"))
  ]).slice(0, 12);
  const popularTvShows = uniqueMovies([
    ...channelTvShows,
    ...allMovies.filter((movie) => contentTypeMatches(movie, "tv_show"))
  ]).slice(0, 12);

  const quickActions = [
    {
      title: "Free Legal Movies",
      text: "Licensed and public-domain picks.",
      href: "/free-movies"
    },
    {
      title: "Hindi Dubbed Finder",
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
