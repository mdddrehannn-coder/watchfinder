import type { Metadata } from "next";
import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import MovieSlider from "@/components/MovieSlider";
import PlatformLogo from "@/components/PlatformLogo";
import { getBlogPosts, getMovies, getPlatforms } from "@/lib/data";
import { isHindiFriendly } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "New OTT Releases - WatchFinder",
  description: "Track new movies and web series available on legal streaming platforms with Hindi and South release guides."
};

export default async function OttReleasesPage() {
  const [platforms, latest, allMovies, posts] = await Promise.all([
    getPlatforms(),
    getMovies({ latest: true, limit: 60 }),
    getMovies({ limit: 120 }),
    getBlogPosts(24)
  ]);

  const latestAdded = latest.length ? latest : allMovies.slice(0, 36);
  const thisWeek = latestAdded.slice(0, 12);
  const hindiReleases = latestAdded.filter(isHindiFriendly).slice(0, 12);
  const southReleases = latestAdded
    .filter((movie) => ["Tamil", "Telugu", "Malayalam", "Kannada"].some((language) => movie.language?.includes(language)))
    .slice(0, 12);
  const ottPosts = posts.filter((post) => post.category?.toLowerCase().includes("ott"));

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">OTT guide</p>
        <h1>New OTT Releases</h1>
        <p className="muted">Track new movies and web series available on legal streaming platforms.</p>
      </section>

      <MovieSlider title="This Week" movies={thisWeek} />
      <MovieSlider title="Latest Added" movies={latestAdded.slice(0, 18)} />

      <section className="section">
        <div className="section-head">
          <h2>Platform-wise releases</h2>
          <Link className="muted" href="/platforms">View platforms</Link>
        </div>
        <div className="platform-grid">
          {platforms.slice(0, 8).map((platform) => (
            <Link className="platform-card" href={`/platform/${platform.slug}`} key={platform.id}>
              <PlatformLogo platform={platform} />
              <strong>{platform.name}</strong>
              <p className="muted">Official OTT availability</p>
            </Link>
          ))}
        </div>
      </section>

      <MovieSlider title="Hindi releases" movies={hindiReleases} href="/hindi-dubbed" />
      <MovieSlider title="South releases" movies={southReleases} />

      <section className="section">
        <div className="section-head">
          <h2>OTT guides</h2>
          <Link className="muted" href="/blog">Read blog</Link>
        </div>
        {ottPosts.length ? (
          <div className="grid">
            {ottPosts.slice(0, 6).map((post) => (
              <Link className="blog-card" href={`/blog/${post.slug}`} key={post.id}>
                {post.featured_image_url ? <img src={post.featured_image_url} alt={post.title} /> : null}
                <p className="rating-badge">{post.category || "OTT Releases"}</p>
                <h2>{post.title}</h2>
                <p className="muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        ) : (
          <MovieGrid movies={[]} />
        )}
      </section>
    </main>
  );
}
