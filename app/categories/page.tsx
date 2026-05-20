import type { Metadata } from "next";
import Link from "next/link";
import MovieGrid from "@/components/MovieGrid";
import { getGenres, getMovies, getPlatforms } from "@/lib/data";

export const metadata: Metadata = {
  title: "Categories",
  description: "Filter movies, TV shows, anime and short films by genre, year, platform and language."
};

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [genres, platforms, movies] = await Promise.all([
    getGenres(),
    getPlatforms(),
    getMovies({
      type: params.type,
      language: params.language,
      year: params.year,
      genreSlug: params.genre,
      platformSlug: params.platform,
      trending: params.trending === "true",
      latest: params.latest === "true",
      topRated: params.topRated === "true",
      limit: 72
    })
  ]);

  return (
    <main className="page-inner">
      <h1>Categories</h1>
      <div className="chip-row">
        <Link className="chip" href="/categories?type=movie">Movie</Link>
        <Link className="chip" href="/categories?type=tv_show">TV Shows</Link>
        <Link className="chip" href="/categories?type=anime">Anime</Link>
        <Link className="chip" href="/categories?type=short_film">Short Film</Link>
        <Link className="chip" href="/categories?latest=true">Latest</Link>
        <Link className="chip" href="/categories?trending=true">Trending</Link>
        <Link className="chip" href="/categories?topRated=true">Top Rated</Link>
      </div>
      <section className="section">
        <h2>Genres</h2>
        <div className="chip-row">
          {genres.map((genre) => (
            <Link className="chip" href={`/category/${genre.slug}`} key={genre.id}>
              {genre.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <h2>Platforms</h2>
        <div className="chip-row">
          {platforms.map((platform) => (
            <Link className="chip" href={`/platform/${platform.slug}`} key={platform.id}>
              {platform.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <MovieGrid movies={movies} />
      </section>
    </main>
  );
}
