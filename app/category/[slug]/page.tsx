import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getGenres, getMovies } from "@/lib/data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const genres = await getGenres();
  const genre = genres.find((item) => item.slug === slug);
  return {
    title: genre ? `${genre.name} Movies and Shows` : "Category",
    description: `Explore ${genre?.name || slug} titles on WatchFinder.`
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [genres, movies] = await Promise.all([getGenres(), getMovies({ genreSlug: slug, limit: 72 })]);
  const genre = genres.find((item) => item.slug === slug);

  return (
    <main className="page-inner">
      <h1>{genre?.name || "Category"}</h1>
      <p className="muted">Published titles matched to this category.</p>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
