import ContentPosterCard from "@/components/ContentPosterCard";
import { languageBadge } from "@/lib/content-language";
import type { Movie } from "@/types/watchfinder";

export default function MovieCard({ movie, sectionName }: { movie: Movie; sectionName?: string }) {
  const compact = Boolean(sectionName);

  return (
    <ContentPosterCard
      item={{
        id: movie.id,
        title: movie.title,
        href: `/movie/${movie.slug}`,
        posterUrl: movie.poster_url,
        bannerUrl: movie.banner_url,
        contentType: movie.content_type || movie.type,
        languageLabel: languageBadge(movie.language, movie.primary_language, Array.isArray(movie.available_languages) ? movie.available_languages : null),
        platformLabel: null,
        updateBadge: null
      }}
      compact={compact}
      sectionName={sectionName}
    />
  );
}
