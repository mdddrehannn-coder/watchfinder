import Link from "next/link";
import { Star } from "lucide-react";
import { firstPlatformLabel } from "@/lib/data";
import { formatType } from "@/lib/format";
import type { Movie } from "@/types/watchfinder";

export default function MovieCard({ movie }: { movie: Movie }) {
  const platform = firstPlatformLabel(movie);

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
          <span>{movie.language || "Multi"}</span>
          <span>{formatType(movie.type)}</span>
        </div>
        {platform ? <span className="platform-badge">{platform}</span> : null}
      </div>
    </Link>
  );
}
