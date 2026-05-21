import EmptyState from "@/components/EmptyState";
import MovieCard from "@/components/MovieCard";
import type { Movie } from "@/types/watchfinder";

export default function MovieGrid({
  movies,
  emptyTitle = "No titles found",
  emptyMessage = "Add content from admin panel to display this section."
}: {
  movies: Movie[];
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (!movies.length) return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <div className="grid">
      {movies.map((movie) => (
        <MovieCard movie={movie} key={movie.id} />
      ))}
    </div>
  );
}
