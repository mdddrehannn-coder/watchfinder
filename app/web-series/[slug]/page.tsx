import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import HeroPlayBanner from "@/components/HeroPlayBanner";
import IntroductionDetailsSection from "@/components/IntroductionDetailsSection";
import SeriesSeasonBrowser from "@/components/SeriesSeasonBrowser";
import WebSeriesAnalyticsTracker from "@/components/WebSeriesAnalyticsTracker";
import { getPublishedSeries, getSeriesBySlug } from "@/lib/data";
import type { ResolvedPlayAction } from "@/lib/play-actions";

export const dynamic = "force-dynamic";

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return { title: "Series not found" };
  return {
    title: series.seo_title || series.title,
    description: series.seo_description || series.description || `Watch legal episodes of ${series.title} on WatchFinder.`
  };
}

export default async function WebSeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();

  const similar = (await getPublishedSeries(12))
    .filter((item) => item.id !== series.id && (item.genre === series.genre || item.language === series.language || item.platform_name === series.platform_name))
    .slice(0, 4);
  const seasons = series.seasons ?? [];
  const episodeCount = seasons.reduce((total, season) => total + (season.episodes?.length ?? 0), 0);
  const addedDate = formatDateLabel(series.created_at);
  const updatedDate = formatDateLabel(series.updated_at);
  const releaseUpdateSummary = [
    addedDate ? `Added ${addedDate}` : null,
    updatedDate ? `Updated ${updatedDate}` : null
  ].filter(Boolean).join(" - ");
  const firstPlayableSeason = seasons.find((season) => season.episodes?.length);
  const firstEpisode = firstPlayableSeason?.episodes?.[0];
  const heroPlayAction: ResolvedPlayAction = firstPlayableSeason && firstEpisode
    ? {
      type: "internal_link",
      href: `/web-series/${series.slug}/season/${firstPlayableSeason.season_number}/episode/${firstEpisode.episode_number}`,
      label: `Play Episode ${firstEpisode.episode_number}`
    }
    : {
      type: "unavailable",
      label: "No episode available",
      note: "No official episode available yet."
    };

  return (
    <main className="page-inner">
      <WebSeriesAnalyticsTracker seriesSlug={series.slug} />
      <section className="series-detail-hero">
        <HeroPlayBanner
          action={heroPlayAction}
          className="series-detail-bg"
          imageUrl={series.banner_url || series.poster_url}
          title={series.title}
        />
        <div className="series-detail-content">
          <div className="series-detail-poster">
            {series.poster_url ? <img src={series.poster_url} alt={`${series.title} poster`} /> : <span>{series.title.slice(0, 1)}</span>}
          </div>
          <div className="series-detail-copy">
            <p className="rating-badge">Web Series</p>
            <h1>{series.title}</h1>
            <div className="smart-badge-row">
              {series.genre ? <span className="smart-badge">{series.genre}</span> : null}
              {series.language ? <span className="smart-badge">{series.language}</span> : null}
              {series.platform_name ? <span className="smart-badge">{series.platform_name}</span> : null}
              {series.release_year ? <span className="smart-badge">{series.release_year}</span> : null}
              {series.rating ? <span className="smart-badge">{series.rating}</span> : null}
              <span className="smart-badge">{series.status === "published" ? "Published" : "Preview"}</span>
            </div>
            {series.description ? <p className="series-description">{series.description}</p> : null}
            <div className="meta-line">
              <span>{seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}</span>
              <span>{episodeCount} {episodeCount === 1 ? "Episode" : "Episodes"}</span>
            </div>
          </div>
        </div>
      </section>

      <IntroductionDetailsSection
        description={series.description}
        items={[
          { label: "Title", value: series.title },
          { label: "Content type", value: "Web Series" },
          { label: "Language", value: series.language },
          { label: "Category / Genre", value: series.genre },
          { label: "Platform / Source", value: series.platform_name },
          { label: "Release year", value: series.release_year },
          { label: "Rating", value: series.rating },
          { label: "Series status", value: series.status === "published" ? "Published" : series.status },
          { label: "Seasons", value: seasons.length ? `${seasons.length} ${seasons.length === 1 ? "Season" : "Seasons"}` : null },
          { label: "Episodes", value: episodeCount ? `${episodeCount} ${episodeCount === 1 ? "Episode" : "Episodes"}` : null },
          { label: "Release / Update info", value: releaseUpdateSummary }
        ]}
        tags={[
          series.genre || "",
          series.language || "",
          series.platform_name || ""
        ]}
      />

      <SeriesSeasonBrowser series={series} />

      <section className="section">
        <div className="watch-guide-card">
          <h2>Legal playback note</h2>
          <p className="muted">WatchFinder only lists official, licensed, self-owned, public-domain, or creator-permitted series content. Do not add unauthorized streams.</p>
        </div>
      </section>

      {similar.length ? (
        <section className="section">
          <div className="section-head">
            <h2>Similar legal series</h2>
            <Link className="muted" href="/web-series">View all</Link>
          </div>
          <div className="grid">
            {similar.map((item) => (
              <Link className="quick-action-card" href={`/web-series/${item.slug}`} key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.genre || item.language || item.platform_name || "Web Series"}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
