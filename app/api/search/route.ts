import { NextResponse } from "next/server";
import { matchesDiscoveryQuery } from "@/lib/discovery";
import { getMovies, getPublishedSeries, getSearchChannels } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json({ results: [] });
  }

  const [movies, channels, series] = await Promise.all([
    getMovies({ limit: 300 }),
    getSearchChannels(query),
    getPublishedSeries(120)
  ]);
  const movieResults = movies
    .filter((movie) => matchesDiscoveryQuery(movie, query))
    .slice(0, 6)
    .map((movie) => ({
      id: movie.id,
      kind: movie.type === "cartoon" ? "cartoon" : movie.type === "tv_show" ? "tv_show" : "movie",
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

  const normalizedQuery = query.trim().toLowerCase();
  const seriesResults = series
    .filter((item) => `${item.title} ${item.slug} ${item.description || ""} ${item.genre || ""} ${item.language || ""} ${item.platform_name || ""}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 4)
    .map((item) => ({
      id: item.id,
      kind: "web_series",
      title: item.title,
      slug: item.slug,
      href: `/web-series/${item.slug}`,
      poster_url: item.poster_url,
      release_year: item.release_year,
      language: item.language || "Web Series"
    }));

  const episodeResults = series
    .flatMap((item) => (item.seasons ?? []).flatMap((season) => (season.episodes ?? []).map((episode) => ({ item, season, episode }))))
    .filter(({ item, season, episode }) => `${item.title} ${season.title || ""} ${episode.title} ${episode.description || ""} ${episode.language || item.language || ""}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 4)
    .map(({ item, season, episode }) => ({
      id: episode.id,
      kind: "episode",
      title: `${item.title}: ${episode.title}`,
      slug: item.slug,
      href: `/web-series/${item.slug}/season/${season.season_number}/episode/${episode.episode_number}`,
      poster_url: episode.poster_url || episode.banner_url || item.poster_url,
      release_year: item.release_year,
      language: `S${season.season_number} E${episode.episode_number}`
    }));

  return NextResponse.json({ results: [...movieResults, ...seriesResults, ...episodeResults, ...channelResults].slice(0, 8) });
}
