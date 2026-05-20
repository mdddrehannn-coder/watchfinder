import EmptyState from "@/components/EmptyState";
import MovieCard from "@/components/MovieCard";
import type { Movie } from "@/types/watchfinder";

export default function MovieGrid({ movies }: { movies: Movie[] }) {
  if (!movies.length) return <EmptyState title="No titles found" />;

  return (
    <div className="grid">
      {movies.map((movie) => (
        <MovieCard movie={movie} key={movie.id} />
      ))}
    </div>
  );
}
