import Link from "next/link";
import { Star } from "lucide-react";
import { firstPlatformLabel } from "@/lib/data";
import { movieSmartBadges } from "@/lib/discovery";
import { formatType } from "@/lib/format";
import LanguageTags from "@/components/LanguageTags";
import type { Movie } from "@/types/watchfinder";

export default function MovieCard({ movie }: { movie: Movie }) {
  const platform = firstPlatformLabel(movie);
  const badges = movieSmartBadges(movie);

  return (
    <Link className="movie-card" href={`/movie/${movie.slug}`}>
      <div className="poster-frame">
        {movie.poster_url ? <img src={movie.poster_url} alt={`${movie.title} poster`} /> : null}
      </div>
      <div className="movie-body">
        <p className="movie-title">{movie.title}</p>
        <div className="meta-line">
          {movie.rating ? (
            <span className="rating-badge">
              <Star size={13} fill="currentColor" /> {movie.rating}
            </span>
          ) : null}
          <span>{formatType(movie.type)}</span>
        </div>
        <LanguageTags value={movie.language} compact />
        <div className="smart-badge-row">
          {badges.map((badge) => (
            <span className="smart-badge" key={badge}>{badge}</span>
          ))}
        </div>
        {platform ? <span className="platform-badge">{platform}</span> : null}
      </div>
    </Link>
  );
}
