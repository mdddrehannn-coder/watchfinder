import ContentPosterCard from "@/components/ContentPosterCard";
import { languageBadge } from "@/lib/content-language";
import type { Series } from "@/types/watchfinder";

function countLabel(series: Series) {
  const seasons = series.season_count ?? series.seasons?.length ?? 0;
  const episodes = series.episode_count ?? series.seasons?.reduce((total, season) => total + (season.episodes?.length ?? 0), 0) ?? 0;
  if (seasons && episodes) return `${seasons}S ${episodes}E`;
  if (seasons) return `${seasons} ${seasons === 1 ? "Season" : "Seasons"}`;
  return null;
}

export default function SeriesCard({ series, sectionName = "Web Series" }: { series: Series; sectionName?: string }) {
  return (
    <ContentPosterCard
      item={{
        id: series.id,
        title: series.title,
        href: `/web-series/${series.slug}`,
        posterUrl: series.poster_url,
        bannerUrl: series.banner_url,
        contentType: "web_series",
        languageLabel: languageBadge(series.language),
        platformLabel: series.platform_name,
        updateBadge: countLabel(series)
      }}
      sectionName={sectionName}
    />
  );
}
