import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "Anime",
  description: "Discover anime titles with trailers and official watch links."
};

export default async function AnimePage() {
  const movies = await getMovies({ type: "anime", limit: 60 });
  return (
    <main className="page-inner">
      <h1>Anime</h1>
      <p className="muted">Legal anime discovery across streaming platforms.</p>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
