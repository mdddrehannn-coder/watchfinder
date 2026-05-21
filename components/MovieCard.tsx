import Link from "next/link";
import { firstPlatformLabel } from "@/lib/data";
import { hasOfficialLink, isHindiFriendly, isLegalFreeMovie, movieQualities } from "@/lib/discovery";
import { formatType } from "@/lib/format";
import { splitLanguages } from "@/lib/languages";
import type { Movie } from "@/types/watchfinder";

export default function MovieCard({ movie }: { movie: Movie }) {
  const platform = firstPlatformLabel(movie);
  const languages = splitLanguages(movie.language).slice(0, 2);
  const qualities = movieQualities(movie).slice(0, 2);
  const allBadges = [
    !movie.has_licensed_video ? "Trailer Only" : null,
    isLegalFreeMovie(movie) ? "Free Legal" : null,
    hasOfficialLink(movie) ? "Official" : null,
    isHindiFriendly(movie) ? "Hindi Dubbed" : null
  ].filter(Boolean) as string[];
  const visibleBadges = allBadges.slice(0, 2);
  const moreCount = allBadges.length - visibleBadges.length;

  return (
    <Link className="movie-card" href={`/movie/${movie.slug}`}>
      <div className="poster-frame">
        {movie.poster_url ? <img src={movie.poster_url} alt={`${movie.title} poster`} /> : null}
      </div>
      <div className="movie-body">
        <p className="movie-title" title={movie.title}>{movie.title}</p>
        <div className="meta-line">
          <span className="movie-type-text">{formatType(movie.type)}</span>
        </div>
        <div className="language-tags compact">
          {languages.map((language) => (
            <span className="language-tag" key={language}>{language}</span>
          ))}
          {qualities.map((quality) => (
            <span className="language-tag quality-tag" key={quality}>{quality}</span>
          ))}
        </div>
        <div className="smart-badge-row">
          {visibleBadges.map((badge) => (
            <span className="smart-badge" key={badge}>{badge}</span>
          ))}
          {moreCount > 0 ? <span className="smart-badge more-badge">+{moreCount} more</span> : null}
        </div>
        {platform ? <span className="platform-badge">{platform}</span> : null}
      </div>
    </Link>
  );
}
