import { NextResponse } from "next/server";
import { slugify } from "@/lib/format";
import { requireAdminProfile } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { AiImportDraft, AiImportMode, AiImportResult, AiImportedCredit, AiImportedImage, AiImportedSeason } from "@/lib/ai-import-types";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const MAX_BULK_ITEMS = 50;

type ImportRequest = {
  mode?: AiImportMode;
  input?: string;
  mediaType?: "auto" | "movie" | "tv";
  includeSeasons?: boolean;
};

function tmdbAuthHeaders(): Record<string, string> {
  const token = process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_READ_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function tmdbApiKey() {
  return process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
}

function hasTmdbConfig() {
  return Boolean(tmdbApiKey() || Object.keys(tmdbAuthHeaders()).length);
}

function titleCase(value?: string | null) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function compactText(value?: string | null, max = 155) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}...`;
}

function imageUrl(path?: string | null, size = "w780") {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

function parseImdbId(input: string) {
  return input.match(/tt\d{6,12}/i)?.[0] ?? null;
}

function parseTmdbFromUrl(input: string) {
  const match = input.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i) || input.match(/\b(movie|tv)[:/\s-]+(\d{2,})\b/i);
  if (!match) return null;
  return { mediaType: match[1].toLowerCase() as "movie" | "tv", id: Number(match[2]) };
}

function parsePlainTmdbId(input: string, mediaType?: "auto" | "movie" | "tv") {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return { mediaType: mediaType === "tv" ? "tv" : "movie", id: Number(trimmed) };
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (!hasTmdbConfig()) throw new Error("TMDb API key is not configured. Add TMDB_API_KEY or TMDB_ACCESS_TOKEN.");
  const url = new URL(`${TMDB_API_BASE}${path}`);
  const key = tmdbApiKey();
  if (key) url.searchParams.set("api_key", key);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });
  const response = await fetch(url, { headers: tmdbAuthHeaders(), next: { revalidate: 60 * 60 } });
  if (!response.ok) throw new Error(`TMDb request failed (${response.status}) for ${path}`);
  return response.json() as Promise<T>;
}

function youtubeTrailer(videos?: { results?: any[] }) {
  const list = videos?.results ?? [];
  const officialTrailer =
    list.find((video) => video.site === "YouTube" && video.official && video.type === "Trailer") ||
    list.find((video) => video.site === "YouTube" && video.type === "Trailer") ||
    list.find((video) => video.site === "YouTube" && ["Teaser", "Clip"].includes(video.type));
  return officialTrailer
    ? {
        url: `https://www.youtube.com/watch?v=${officialTrailer.key}`,
        name: officialTrailer.name || "Official Trailer"
      }
    : { url: null, name: null };
}

function tmdbImages(item: any): AiImportedImage[] {
  return [
    item.poster_path ? { kind: "poster", label: "Poster", url: imageUrl(item.poster_path, "w500") } : null,
    item.backdrop_path ? { kind: "backdrop", label: "Backdrop", url: imageUrl(item.backdrop_path, "w1280") } : null,
    item.backdrop_path ? { kind: "banner", label: "Desktop Banner", url: imageUrl(item.backdrop_path, "original") } : null,
    item.poster_path ? { kind: "thumbnail", label: "Portrait Thumbnail", url: imageUrl(item.poster_path, "w342") } : null
  ].filter(Boolean) as AiImportedImage[];
}

function people(credits: any, job: string, limit = 8) {
  return (credits?.crew ?? [])
    .filter((person: any) => person.job === job)
    .slice(0, limit)
    .map((person: any) => person.name)
    .filter(Boolean);
}

function castCredits(credits: any): AiImportedCredit[] {
  return (credits?.cast ?? []).slice(0, 18).map((person: any) => ({
    name: person.name,
    character: person.character || null,
    role: "Cast",
    imageUrl: imageUrl(person.profile_path, "w185")
  }));
}

function crewCredits(credits: any): AiImportedCredit[] {
  return (credits?.crew ?? []).slice(0, 24).map((person: any) => ({
    name: person.name,
    role: person.job || person.department || "Crew",
    imageUrl: imageUrl(person.profile_path, "w185")
  }));
}

function ageRating(item: any, mediaType: "movie" | "tv") {
  const list = mediaType === "movie" ? item.release_dates?.results : item.content_ratings?.results;
  const preferred = list?.find((entry: any) => entry.iso_3166_1 === "US") || list?.[0];
  if (!preferred) return null;
  if (mediaType === "movie") return preferred.release_dates?.find((entry: any) => entry.certification)?.certification || null;
  return preferred.rating || null;
}

function missingFields(draft: Partial<AiImportDraft>) {
  return [
    !draft.title ? "Title" : null,
    !draft.description ? "Description" : null,
    !draft.posterUrl ? "Poster" : null,
    !draft.bannerUrl ? "Banner/backdrop" : null,
    !draft.trailerUrl ? "Official trailer" : null,
    !draft.genres?.length ? "Genres" : null
  ].filter(Boolean) as string[];
}

async function duplicateWarnings(draft: Pick<AiImportDraft, "title" | "releaseYear" | "contentType" | "tmdbId" | "imdbId">) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [] as string[];
  const warnings: string[] = [];
  const title = draft.title.trim();
  if (!title) return warnings;

  if (draft.tmdbId || draft.imdbId) {
    const exactMovieMatch = await supabase
      .from("movies")
      .select("title, slug, status, tmdb_id, imdb_id")
      .or([
        draft.tmdbId ? `tmdb_id.eq.${draft.tmdbId}` : "",
        draft.imdbId ? `imdb_id.eq.${draft.imdbId}` : ""
      ].filter(Boolean).join(","))
      .limit(3);
    if (!exactMovieMatch.error && exactMovieMatch.data?.length) {
      warnings.push(`Exact external ID match already exists: ${exactMovieMatch.data[0].title} (${exactMovieMatch.data[0].slug})`);
    }
  }

  const movieMatch = await supabase
    .from("movies")
    .select("title, slug, status, release_year")
    .ilike("title", title)
    .limit(5);
  if (!movieMatch.error && movieMatch.data?.length) {
    const sameYear = movieMatch.data.find((item: any) => item.release_year === draft.releaseYear);
    warnings.push(sameYear ? `Possible duplicate movie: ${sameYear.title} (${sameYear.slug})` : `Similar movie title already exists: ${movieMatch.data[0].title}`);
  }

  if (draft.contentType === "web_series") {
    const seriesMatch = await supabase
      .from("web_series")
      .select("title, slug, status, release_year")
      .ilike("title", title)
      .limit(5);
    if (!seriesMatch.error && seriesMatch.data?.length) {
      warnings.push(`Similar web series title already exists: ${seriesMatch.data[0].title} (${seriesMatch.data[0].slug})`);
    }
  }
  return warnings;
}

function seoDescription(title: string, description?: string | null) {
  return compactText(description || `Watch official trailers and legal availability for ${title} on WatchFinder.`, 155);
}

function baseDraft(item: any, mediaType: "movie" | "tv", sourceInput: string): AiImportDraft {
  const title = item.title || item.name || item.original_title || item.original_name || sourceInput;
  const originalTitle = item.original_title || item.original_name || title;
  const releaseDate = item.release_date || item.first_air_date || null;
  const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;
  const trailer = youtubeTrailer(item.videos);
  const genres = (item.genres ?? []).map((genre: any) => genre.name).filter(Boolean);
  const productionCompanies = (item.production_companies ?? []).map((company: any) => company.name).filter(Boolean);
  const contentType = mediaType === "tv" ? "web_series" : "movie";

  return {
    source: "tmdb",
    sourceLabel: "TMDb",
    input: sourceInput,
    contentType,
    title,
    originalTitle,
    alternativeTitles: [],
    slug: slugify(`${title}-${releaseYear || ""}`),
    tagline: item.tagline || null,
    shortDescription: compactText(item.overview, 150),
    description: item.overview || null,
    storyOverview: item.overview || null,
    releaseDate,
    releaseYear,
    runtimeMinutes: mediaType === "movie" ? item.runtime ?? null : item.episode_run_time?.[0] ?? null,
    status: item.status || null,
    genres,
    subGenres: genres.slice(0, 3),
    language: item.original_language ? item.original_language.toUpperCase() : null,
    originalLanguage: item.original_language || null,
    country: item.origin_country?.[0] || item.production_countries?.[0]?.iso_3166_1 || null,
    budget: item.budget ?? null,
    revenue: item.revenue ?? null,
    productionCompanies,
    director: people(item.credits, "Director", 1)[0] || null,
    writers: [...people(item.credits, "Writer"), ...people(item.credits, "Screenplay")],
    producers: people(item.credits, "Producer"),
    cast: castCredits(item.credits),
    crew: crewCredits(item.credits),
    awards: [],
    rating: item.vote_average ?? null,
    voteCount: item.vote_count ?? null,
    ageRating: ageRating(item, mediaType),
    popularityScore: item.popularity ?? null,
    tmdbId: item.id ?? null,
    imdbId: item.imdb_id || item.external_ids?.imdb_id || null,
    posterUrl: imageUrl(item.poster_path, "w500"),
    bannerUrl: imageUrl(item.backdrop_path, "w1280"),
    thumbnailUrl: imageUrl(item.poster_path, "w342") || imageUrl(item.backdrop_path, "w780"),
    logoUrl: null,
    images: tmdbImages(item),
    trailerUrl: trailer.url,
    trailerName: trailer.name,
    seoTitle: `${title} (${releaseYear || "Watch"}) - Trailer, Cast & Legal Watch Guide`,
    seoDescription: seoDescription(title, item.overview),
    keywords: [title, originalTitle, ...genres, item.original_language, releaseYear].filter(Boolean).map(String),
    tags: [contentType, ...genres, item.original_language, releaseYear ? String(releaseYear) : ""].filter(Boolean),
    seasons: [],
    duplicateWarnings: [],
    qualityWarnings: [],
    missingFields: []
  };
}

async function importMovie(id: number, input: string) {
  const item = await tmdbFetch<any>(`/movie/${id}`, {
    append_to_response: "credits,videos,images,external_ids,release_dates,alternative_titles"
  });
  const draft = baseDraft(item, "movie", input);
  draft.alternativeTitles = (item.alternative_titles?.titles ?? []).slice(0, 12).map((entry: any) => entry.title).filter(Boolean);
  draft.duplicateWarnings = await duplicateWarnings(draft);
  draft.missingFields = missingFields(draft);
  return draft;
}

async function importSeries(id: number, input: string, includeSeasons = true) {
  const item = await tmdbFetch<any>(`/tv/${id}`, {
    append_to_response: "credits,videos,images,external_ids,content_ratings,alternative_titles"
  });
  const draft = baseDraft(item, "tv", input);
  draft.alternativeTitles = (item.alternative_titles?.results ?? []).slice(0, 12).map((entry: any) => entry.title).filter(Boolean);

  if (includeSeasons) {
    const seasons = (item.seasons ?? []).filter((season: any) => season.season_number > 0);
    const fetchedSeasons = await Promise.all(
      seasons.map(async (season: any) => {
        try {
          const detail = await tmdbFetch<any>(`/tv/${id}/season/${season.season_number}`, {});
          return {
            seasonNumber: detail.season_number,
            title: detail.name || `Season ${detail.season_number}`,
            description: detail.overview || null,
            airDate: detail.air_date || null,
            posterUrl: imageUrl(detail.poster_path || season.poster_path, "w500"),
            episodes: (detail.episodes ?? []).map((episode: any) => ({
              episodeNumber: episode.episode_number,
              title: episode.name || `Episode ${episode.episode_number}`,
              description: episode.overview || null,
              runtimeMinutes: episode.runtime ?? null,
              airDate: episode.air_date || null,
              stillUrl: imageUrl(episode.still_path, "w500"),
              posterUrl: imageUrl(episode.still_path, "w500")
            }))
          } as AiImportedSeason;
        } catch (error) {
          return {
            seasonNumber: season.season_number,
            title: season.name || `Season ${season.season_number}`,
            description: season.overview || null,
            airDate: season.air_date || null,
            posterUrl: imageUrl(season.poster_path, "w500"),
            episodes: []
          } as AiImportedSeason;
        }
      })
    );
    draft.seasons = fetchedSeasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  draft.duplicateWarnings = await duplicateWarnings(draft);
  draft.missingFields = missingFields(draft);
  return draft;
}

async function searchTmdb(query: string, preferredType: "auto" | "movie" | "tv" = "auto") {
  const data = await tmdbFetch<any>("/search/multi", { query, include_adult: false, page: 1 });
  const results = (data.results ?? [])
    .filter((item: any) => item.media_type === "movie" || item.media_type === "tv")
    .sort((a: any, b: any) => {
      const typeBoostA = preferredType !== "auto" && a.media_type === preferredType ? 1000 : 0;
      const typeBoostB = preferredType !== "auto" && b.media_type === preferredType ? 1000 : 0;
      return (b.popularity + typeBoostB) - (a.popularity + typeBoostA);
    });
  const first = results[0];
  if (!first) throw new Error("No TMDb result found for this title.");
  return first.media_type === "tv" ? importSeries(first.id, query) : importMovie(first.id, query);
}

async function findByImdb(imdbId: string, input: string) {
  const data = await tmdbFetch<any>(`/find/${imdbId}`, { external_source: "imdb_id" });
  const movie = data.movie_results?.[0];
  if (movie) return importMovie(movie.id, input);
  const tv = data.tv_results?.[0];
  if (tv) return importSeries(tv.id, input);
  throw new Error("No TMDb match found for this IMDb ID.");
}

function fallbackDraft(input: string): AiImportDraft {
  const title = titleCase(input.replace(/^https?:\/\//, "").split(/[/?#]/)[0]) || input;
  const draft: AiImportDraft = {
    source: "fallback",
    sourceLabel: "Generated fallback",
    input,
    contentType: "movie",
    title,
    originalTitle: title,
    alternativeTitles: [],
    slug: slugify(title),
    tagline: null,
    shortDescription: `Official metadata could not be fetched for ${title}. Review and complete this draft before publishing.`,
    description: `Add the official description, cast, poster, banner, trailer, and legal watch link for ${title}.`,
    storyOverview: null,
    releaseDate: null,
    releaseYear: null,
    runtimeMinutes: null,
    status: "Draft",
    genres: [],
    subGenres: [],
    language: null,
    originalLanguage: null,
    country: null,
    budget: null,
    revenue: null,
    productionCompanies: [],
    director: null,
    writers: [],
    producers: [],
    cast: [],
    crew: [],
    awards: [],
    rating: null,
    voteCount: null,
    ageRating: null,
    popularityScore: null,
    tmdbId: null,
    imdbId: parseImdbId(input),
    posterUrl: null,
    bannerUrl: null,
    thumbnailUrl: null,
    logoUrl: null,
    images: [],
    trailerUrl: null,
    trailerName: null,
    seoTitle: `${title} - Trailer, Cast & Legal Watch Guide`,
    seoDescription: seoDescription(title),
    keywords: [title],
    tags: ["movie"],
    seasons: [],
    duplicateWarnings: [],
    qualityWarnings: ["TMDb is not configured or no source matched. Complete required fields manually."],
    missingFields: []
  };
  draft.missingFields = missingFields(draft);
  return draft;
}

async function importOne(input: string, mode: AiImportMode = "auto", mediaType: "auto" | "movie" | "tv" = "auto", includeSeasons = true): Promise<AiImportDraft> {
  const cleanInput = input.trim();
  if (!cleanInput) throw new Error("Enter a URL, IMDb ID, TMDb ID, or title.");

  if (!hasTmdbConfig()) return fallbackDraft(cleanInput);

  const imdbId = parseImdbId(cleanInput);
  if (mode === "imdb" || imdbId) return findByImdb(imdbId || cleanInput, cleanInput);

  const parsedTmdb = parseTmdbFromUrl(cleanInput) || parsePlainTmdbId(cleanInput, mediaType);
  if (mode === "tmdb" || parsedTmdb) {
    const target = parsedTmdb || { mediaType: mediaType === "tv" ? "tv" : "movie", id: Number(cleanInput) };
    if (!Number.isFinite(target.id)) throw new Error("Enter a valid TMDb ID.");
    return target.mediaType === "tv" ? importSeries(target.id, cleanInput, includeSeasons) : importMovie(target.id, cleanInput);
  }

  return searchTmdb(cleanInput, mediaType);
}

export async function POST(request: Request) {
  const { isAdmin } = await requireAdminProfile();
  if (!isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });

  try {
    const body = (await request.json()) as ImportRequest;
    const mode = body.mode || "auto";
    const input = String(body.input || "").trim();
    const mediaType = body.mediaType || "auto";
    const includeSeasons = body.includeSeasons !== false;

    if (mode === "bulk") {
      const inputs = input.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, MAX_BULK_ITEMS);
      const results: AiImportResult[] = [];
      for (const item of inputs) {
        try {
          results.push({ input: item, ok: true, draft: await importOne(item, "auto", mediaType, includeSeasons) });
        } catch (error) {
          results.push({ input: item, ok: false, error: error instanceof Error ? error.message : "Import failed." });
        }
      }
      return NextResponse.json({ ok: true, results, warnings: inputs.length === MAX_BULK_ITEMS ? ["Bulk import was capped at 50 items."] : [] });
    }

    const draft = await importOne(input, mode, mediaType, includeSeasons);
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI import failed."
    }, { status: 400 });
  }
}
