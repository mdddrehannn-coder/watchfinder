import type { Metadata } from "next";
import Link from "next/link";
import ContentPosterCard from "@/components/ContentPosterCard";
import EmptyState from "@/components/EmptyState";
import PlatformLogo from "@/components/PlatformLogo";
import { accessTypeMeta, normalizeAccessType } from "@/lib/access-type";
import { languageBadge } from "@/lib/content-language";
import { getMovies, getPlatformBySlug } from "@/lib/data";
import type { Movie } from "@/types/watchfinder";

export const dynamic = "force-dynamic";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isSeries(movie: Movie) {
  return movie.content_type === "web_series" || movie.type === "web_series";
}

function contentHref(movie: Movie) {
  return isSeries(movie) ? `/web-series/${movie.slug}` : `/movie/${movie.slug}`;
}

function platformContentCard(movie: Movie, sectionName: string) {
  return (
    <ContentPosterCard
      key={`${sectionName}-${movie.id}`}
      sectionName={sectionName}
      compact
      item={{
        id: movie.id,
        title: movie.title,
        href: contentHref(movie),
        posterUrl: movie.poster_url,
        bannerUrl: movie.banner_url,
        contentType: movie.content_type || movie.type,
        languageLabel: languageBadge(movie.language, movie.primary_language, Array.isArray(movie.available_languages) ? movie.available_languages : null),
        platformLabel: movie.official_platform || movie.platform_name,
        accessType: movie.access_type
      }}
    />
  );
}

function uniqueById(items: Movie[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function SectionRow({
  title,
  href,
  items,
  emptyMessage
}: {
  title: string;
  href?: string;
  items: Movie[];
  emptyMessage?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="section poster-row-section platform-content-section">
      <div className="section-head">
        <h2>{title}</h2>
        {href ? <Link className="muted" href={href}>More</Link> : null}
      </div>
      <div className="poster-app-row">
        {items.map((movie) => platformContentCard(movie, title))}
      </div>
      {emptyMessage && !items.length ? <p className="muted">{emptyMessage}</p> : null}
    </section>
  );
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const platform = await getPlatformBySlug(slug);
  const name = platform?.name || titleFromSlug(slug);
  return {
    title: `${name} Movies and Web Series`,
    description: `Find official ${name} movies, web series, trailers, and legal watch links on WatchFinder.`
  };
}

export default async function PlatformDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [platform, allMovies] = await Promise.all([
    getPlatformBySlug(slug),
    getMovies({ platformSlug: slug, limit: 160, createdDesc: true })
  ]);

  const platformName = platform?.name || titleFromSlug(slug);
  const content = uniqueById(allMovies);
  const webSeries = content.filter(isSeries);
  const movies = content.filter((movie) => !isSeries(movie));
  const trending = content.filter((movie) => movie.is_trending || movie.homepage_placement === "trending" || movie.primary_section === "trending");
  const recent = content.slice(0, 14);
  const accessCounts = content.reduce((counts, movie) => {
    const access = normalizeAccessType(movie.access_type);
    counts[access] = (counts[access] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const topAccess = (["free", "premium", "rent"] as const)
    .map((access) => ({ access, count: accessCounts[access] || 0, meta: accessTypeMeta(access) }))
    .filter((item) => item.count > 0);

  return (
    <main className="page-inner platform-detail-page">
      <section className="platform-detail-head panel">
        {platform ? <PlatformLogo platform={platform} /> : <span className="platform-logo platform-logo-fallback">{platformName.slice(0, 1)}</span>}
        <div>
          <p className="rating-badge">Official Platform</p>
          <h1>{platformName}</h1>
          <p className="muted">{platform?.description || `Movies and web series imported from ${platformName}, sorted with latest content first.`}</p>
          <div className="smart-badge-row">
            <span className="smart-badge">{content.length} Titles</span>
            <span className="smart-badge">{movies.length} Movies</span>
            <span className="smart-badge">{webSeries.length} Web Series</span>
            {topAccess.map(({ access, count, meta }) => (
              <span className={meta.className} key={access}>{meta.label}: {count}</span>
            ))}
          </div>
        </div>
      </section>

      {content.length ? (
        <>
          <section className="section platform-stat-grid">
            <article className="stat-card"><strong>{content.length}</strong><span>Total titles</span></article>
            <article className="stat-card"><strong>{recent.length}</strong><span>Recently added</span></article>
            <article className="stat-card"><strong>{trending.length}</strong><span>Trending</span></article>
            <article className="stat-card"><strong>{webSeries.length}</strong><span>Web series</span></article>
          </section>

          <SectionRow title="Recently Added" items={recent} />
          <SectionRow title="Trending on Platform" items={(trending.length ? trending : content).slice(0, 14)} />
          <SectionRow title="Web Series" href="/web-series" items={webSeries.slice(0, 14)} />
          <SectionRow title="Movies" href="/movies" items={movies.slice(0, 18)} />

          <section className="section">
            <div className="section-head">
              <h2>All {platformName} Titles</h2>
            </div>
            <div className="grid">
              {content.map((movie) => platformContentCard(movie, "All Platform Titles"))}
            </div>
          </section>
        </>
      ) : (
        <section className="section">
          <EmptyState
            title={`No ${platformName} titles yet`}
            message="Published movies and web series with this platform in their official link or platform field will appear here."
          />
        </section>
      )}
    </main>
  );
}
