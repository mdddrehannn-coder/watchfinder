import type { Metadata } from "next";
import MovieGrid from "@/components/MovieGrid";
import { getMovies, getPlatformBySlug } from "@/lib/data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const platform = await getPlatformBySlug(slug);
  return {
    title: platform ? `${platform.name} Titles` : "Platform",
    description: `Find official ${platform?.name || slug} watch links on WatchFinder.`
  };
}

export default async function PlatformDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [platform, movies] = await Promise.all([
    getPlatformBySlug(slug),
    getMovies({ platformSlug: slug, limit: 72 })
  ]);

  return (
    <main className="page-inner">
      <h1>{platform?.name || "Platform"}</h1>
      <p className="muted">Published titles linked to this official platform.</p>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
