import { NextResponse } from "next/server";
import { matchesDiscoveryQuery } from "@/lib/discovery";
import { getMovies } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const movies = await getMovies({ limit: 300 });
  const results = movies
    .filter((movie) => matchesDiscoveryQuery(movie, query))
    .slice(0, 8)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      slug: movie.slug,
      poster_url: movie.poster_url,
      release_year: movie.release_year,
      language: movie.language
    }));

  return NextResponse.json({ results });
}
