import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getUserWatchHistoryMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "Watch History",
  description: "Your WatchFinder browsing history."
};

export default async function HistoryPage() {
  const movies = await getUserWatchHistoryMovies();
  return (
    <main className="page-inner">
      <h1>Watch History</h1>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
