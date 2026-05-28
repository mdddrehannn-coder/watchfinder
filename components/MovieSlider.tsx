import Link from "next/link";
import HomepageSectionTracker from "@/components/HomepageSectionTracker";
import MovieCard from "@/components/MovieCard";
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
  if (!movies.length) return null;

  return (
    <section className="section poster-row-section">
      <HomepageSectionTracker sectionName={title} itemCount={movies.length} />
      <div className="section-head">
        <h2>{title}</h2>
        {href ? (
          <Link className="muted" href={href}>
            More
          </Link>
        ) : null}
      </div>
      <div className="slider poster-app-row">
        {movies.map((movie) => (
          <MovieCard movie={movie} key={movie.id} sectionName={title} />
        ))}
      </div>
    </section>
  );
}
