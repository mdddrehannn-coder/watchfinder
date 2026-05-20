import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "Movies",
  description: "Discover published movies and official OTT watch links on WatchFinder."
};

export default async function MoviesPage() {
  const movies = await getMovies({ type: "movie", limit: 60 });
  return (
    <main className="page-inner">
      <h1>Movies</h1>
      <p className="muted">Browse legal movie listings, trailers, reviews and OTT availability.</p>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
