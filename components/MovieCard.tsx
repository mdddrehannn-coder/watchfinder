import ContentPosterCard from "@/components/ContentPosterCard";
import { firstPlatformLabel } from "@/lib/data";
import { languageBadge } from "@/lib/content-language";
import type { Movie } from "@/types/watchfinder";

export default function MovieCard({ movie, sectionName }: { movie: Movie; sectionName?: string }) {
  return (
    <ContentPosterCard
      item={{
        id: movie.id,
        title: movie.title,
        href: `/movie/${movie.slug}`,
        posterUrl: movie.poster_url,
        bannerUrl: movie.banner_url,
        contentType: movie.content_type || movie.type,
        languageLabel: languageBadge(movie.language, movie.primary_language),
        platformLabel: movie.platform_name || firstPlatformLabel(movie),
        updateBadge: movie.show_in_hero ? "Hero" : null
      }}
      sectionName={sectionName}
    />
  );
}
