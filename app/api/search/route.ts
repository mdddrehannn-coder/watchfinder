import { NextResponse } from "next/server";
import { matchesDiscoveryQuery } from "@/lib/discovery";
import { getMovies, getSearchChannels } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const [movies, channels] = await Promise.all([
    getMovies({ limit: 300 }),
    getSearchChannels(query)
  ]);
  const movieResults = movies
    .filter((movie) => matchesDiscoveryQuery(movie, query))
    .slice(0, 6)
    .map((movie) => ({
      id: movie.id,
      kind: "movie",
      title: movie.title,
      slug: movie.slug,
      href: `/movie/${movie.slug}`,
      poster_url: movie.poster_url,
      release_year: movie.release_year,
      language: movie.language
    }));

  const channelResults = channels.slice(0, 4).map((channel) => ({
    id: channel.id,
    kind: "channel",
    title: channel.name,
    slug: channel.slug,
    href: channel.channel_type === "cartoon" ? `/cartoons/${channel.slug}` : `/tv-shows/${channel.slug}`,
    poster_url: channel.logo_url,
    release_year: null,
    language: channel.channel_type === "cartoon" ? "Cartoon channel" : "TV show channel"
  }));

  return NextResponse.json({ results: [...movieResults, ...channelResults].slice(0, 8) });
}
