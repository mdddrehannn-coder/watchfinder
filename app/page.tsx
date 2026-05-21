import Link from "next/link";
import { Search } from "lucide-react";
import MovieSlider from "@/components/MovieSlider";
import PromotionBanner from "@/components/PromotionBanner";
import AdSlot from "@/components/AdSlot";
import {
  getAdSlots,
  getBlogPosts,
  getMovies,
  getPlatforms,
  getPromotions
} from "@/lib/data";
import { filterDiscoveryMovies, hasOfficialYouTube, isHindiFriendly } from "@/lib/discovery";

export default async function HomePage() {
  const [
    middlePromotions,
    ads,
    platforms,
    allMovies,
    trending,
    latest,
    posts
  ] = await Promise.all([
    getPromotions("home_middle"),
    getAdSlots("home"),
    getPlatforms(),
    getMovies({ limit: 120 }),
    getMovies({ trending: true, limit: 12 }),
    getMovies({ latest: true, limit: 18 }),
    getBlogPosts(6)
  ]);

  const freeLegal = filterDiscoveryMovies(allMovies, { freeLegal: true }).slice(0, 12);
  const hindiDubbed = allMovies.filter(isHindiFriendly).slice(0, 12);
  const officialYouTube = allMovies.filter(hasOfficialYouTube).slice(0, 12);

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
      <section className="home-hero">
        <div>
          <p className="rating-badge">Legal OTT discovery</p>
          <h1>Find free legal movies, Hindi dubbed titles, trailers and OTT availability in one place.</h1>
          <p className="muted">
            WatchFinder helps you discover official trailers, where-to-watch links, Hindi-friendly listings and legally available free movies.
          </p>
          <form className="hero-search" action="/search">
            <Search size={20} />
            <input name="q" placeholder="Search Hindi dubbed, free legal, Netflix, anime..." />
            <button className="button primary" type="submit">Search</button>
          </form>
        </div>
      </section>

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
      <MovieSlider title="New OTT Releases" movies={latest} href="/ott-releases" />
      <MovieSlider title="Trending Now" movies={trending} href="/movies?trending=true" />
      <MovieSlider title="Official YouTube Movies" movies={officialYouTube} href="/free-movies?platform=youtube" />
      <PromotionBanner promotion={middlePromotions[0]} />
      <AdSlot slot={ads[0]} />

      <section className="section">
        <div className="section-head">
          <h2>Popular Platforms</h2>
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
