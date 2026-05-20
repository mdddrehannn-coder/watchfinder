import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import EmptyState from "@/components/EmptyState";
import type { Movie } from "@/types/watchfinder";

export default function MovieSlider({
  title,
  movies,
  href
}: {
  title: string;
  movies: Movie[];
  href?: string;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {href ? (
          <Link className="muted" href={href}>
            View all
          </Link>
        ) : null}
      </div>
      {movies.length ? (
        <div className="slider">
          {movies.map((movie) => (
            <MovieCard movie={movie} key={movie.id} />
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      )}
    </section>
  );
}
