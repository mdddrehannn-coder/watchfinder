import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getMovies } from "@/lib/data";

export const metadata: Metadata = {
  title: "TV Shows",
  description: "Find web series and TV shows with official platform links."
};

export default async function TvShowsPage() {
  const movies = await getMovies({ type: "tv_show", limit: 60 });
  return (
    <main className="page-inner">
      <h1>TV Shows</h1>
      <p className="muted">Explore web series and OTT updates from official sources.</p>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
