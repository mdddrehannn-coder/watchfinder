import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getUserFavoriteMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "Favorites",
  description: "Your saved WatchFinder favorites."
};

export default async function FavoritesPage() {
  const movies = await getUserFavoriteMovies();
  return (
    <main className="page-inner">
      <h1>Favorites</h1>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
