import Link from "next/link";
import HomepageHeroSlider from "@/components/HomepageHeroSlider";
import MovieSlider from "@/components/MovieSlider";
import PlatformLogo from "@/components/PlatformLogo";
import PromotionBanner from "@/components/PromotionBanner";
import AdSlot from "@/components/AdSlot";
import {
  getAdSlots,
  getBlogPosts,
  getChannelLinkedMovies,
  getHomepageHeroMovies,
  getMovies,
  getPlatforms,
  getPromotions
} from "@/lib/data";
import { filterDiscoveryMovies, hasOfficialYouTube, isHindiFriendly } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    middlePromotions,
    ads,
    platforms,
    heroMovies,
    allMovies,
    trending,
    latest,
    posts,
    popularCartoons,
    popularTvShows
  ] = await Promise.all([
    getPromotions("home_middle"),
    getAdSlots("home"),
    getPlatforms(),
    getHomepageHeroMovies(),
    getMovies({ limit: 120 }),
    getMovies({ trending: true, limit: 12 }),
    getMovies({ latest: true, limit: 18 }),
    getBlogPosts(6),
    getChannelLinkedMovies("cartoon", 12),
    getChannelLinkedMovies("tv_show", 12)
  ]);

  const fallbackByPopularity = [...allMovies]
    .sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0))
    .slice(0, 12);
  const freeLegal = filterDiscoveryMovies(allMovies, { freeLegal: true }).slice(0, 12);
  const hindiDubbed = allMovies.filter(isHindiFriendly).slice(0, 12);
  const officialYouTube = allMovies.filter(hasOfficialYouTube).slice(0, 12);
  const newOttReleases = latest.length ? latest : allMovies.slice(0, 12);
  const trendingMovies = trending.length ? trending : fallbackByPopularity;

  const quickActions = [
    {
      title: "Free Legal Movies",
      text: "Public-domain, licensed and official free titles.",
      href: "/free-movies"
    },
    {
      title: "Hindi Dubbed Finder",
      text: "Find South, Hollywood and anime titles in Hindi.",
      href: "/hindi-dubbed"
    },
    {
      title: "New OTT Releases",
      text: "Track legal streaming availability.",
      href: "/ott-releases"
    },
    {
      title: "Official Trailers",
      text: "Watch trailers and then choose official platforms.",
      href: "/search?q=trailer"
    }
  ];

  return (
    <main className="page-inner">
      <HomepageHeroSlider movies={heroMovies} />

      <section className="section quick-action-grid">
        {quickActions.map((action) => (
          <Link className="quick-action-card" href={action.href} key={action.title}>
            <strong>{action.title}</strong>
            <span>{action.text}</span>
          </Link>
        ))}
      </section>

      <MovieSlider title="Free Legal Movies" movies={freeLegal} href="/free-movies" />
      <MovieSlider title="Hindi Dubbed Picks" movies={hindiDubbed} href="/hindi-dubbed" />
      <MovieSlider title="New OTT Releases" movies={newOttReleases} href="/ott-releases" />
      <MovieSlider title="Trending Now" movies={trendingMovies} href="/movies?trending=true" />
      <MovieSlider title="Official YouTube Movies" movies={officialYouTube} href="/free-movies?platform=youtube" />
      <MovieSlider title="Popular Cartoons" movies={popularCartoons} href="/cartoons" />
      <MovieSlider title="Popular TV Shows" movies={popularTvShows} href="/tv-shows" />
      <PromotionBanner promotion={middlePromotions[0]} />
      <AdSlot slot={ads[0]} />

      <section className="section">
        <div className="section-head">
          <h2>Popular Platforms</h2>
          <Link className="muted" href="/platforms">
            View all
          </Link>
        </div>
        {platforms.length ? (
          <div className="platform-grid">
            {platforms.slice(0, 8).map((platform) => (
              <Link className="platform-card" href={`/platform/${platform.slug}`} key={platform.id}>
                <PlatformLogo platform={platform} />
                <strong>{platform.name}</strong>
                <p className="muted">Official titles and watch links</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Add platforms from admin panel to display this section.</div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Guides and OTT Updates</h2>
          <Link className="muted" href="/blog">Read blog</Link>
        </div>
        {posts.length ? (
          <div className="grid">
            {posts.map((post) => (
              <Link className="blog-card" href={`/blog/${post.slug}`} key={post.id}>
                {post.featured_image_url ? <img src={post.featured_image_url} alt={post.title} /> : null}
                <p className="rating-badge">{post.category || "Movie Guide"}</p>
                <h2>{post.title}</h2>
                <p className="muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Add content from admin panel to display this section.</div>
        )}
      </section>
    </main>
  );
}
