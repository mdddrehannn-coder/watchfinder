import { NextResponse } from "next/server";
import { slugify } from "@/lib/format";
import { requireAdminProfile } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type {
  AiImportCandidate,
  AiImportDraft,
  AiImportMode,
  AiImportPlatform,
  AiImportResult,
  AiImportedCredit,
  AiImportedImage,
  AiImportedSeason
} from "@/lib/ai-import-types";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const MAX_BULK_ITEMS = 50;

type ImportRequest = {
  action?: "search" | "details" | "import";
  mode?: AiImportMode;
  input?: string;
  mediaType?: "auto" | "movie" | "tv";
  includeSeasons?: boolean;
  tmdbId?: number;
  selectedMediaType?: "movie" | "tv";
  officialWatchUrl?: string | null;
  extractedTitle?: string | null;
  platform?: AiImportPlatform | null;
};

const platformRules: Array<AiImportPlatform & { hosts: string[]; searchPattern?: string }> = [
  {
    key: "jiohotstar",
    name: "JioHotstar",
    hosts: ["hotstar.com", "jiohotstar.com"],
    homeUrl: "https://www.hotstar.com/",
    searchPattern: "https://www.hotstar.com/in/search?q={query}"
  },
  {
    key: "netflix",
    name: "Netflix",
    hosts: ["netflix.com"],
    homeUrl: "https://www.netflix.com/",
    searchPattern: "https://www.netflix.com/search?q={query}"
  },
  {
    key: "prime-video",
    name: "Prime Video",
    hosts: ["primevideo.com", "amazon.com", "amazon.in"],
    homeUrl: "https://www.primevideo.com/",
    searchPattern: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={query}"
  },
  {
    key: "youtube",
    name: "YouTube",
    hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
    homeUrl: "https://www.youtube.com/",
    searchPattern: "https://www.youtube.com/results?search_query={query}"
  },
  {
    key: "zee5",
    name: "Zee5",
    hosts: ["zee5.com"],
    homeUrl: "https://www.zee5.com/",
    searchPattern: "https://www.zee5.com/search?q={query}"
  },
  {
    key: "sonyliv",
    name: "SonyLIV",
    hosts: ["sonyliv.com"],
    homeUrl: "https://www.sonyliv.com/",
    searchPattern: "https://www.sonyliv.com/search?q={query}"
  },
  {
    key: "aha",
    name: "Aha",
    hosts: ["aha.video"],
    homeUrl: "https://www.aha.video/",
    searchPattern: "https://www.aha.video/search?q={query}"
  },
  {
    key: "apple-tv",
    name: "Apple TV",
    hosts: ["tv.apple.com"],
    homeUrl: "https://tv.apple.com/",
    searchPattern: "https://tv.apple.com/search?term={query}"
  }
];

const noisyUrlWords = new Set([
  "watch",
  "movie",
  "movies",
  "show",
  "shows",
  "tv",
  "series",
  "title",
  "detail",
  "video",
  "videos",
  "in",
  "en",
  "us",
  "gb",
  "www",
  "hotstar",
  "jiohotstar",
  "netflix",
  "primevideo",
  "prime",
  "amazon",
  "zee5",
  "sonyliv",
  "youtube",
  "aha",
  "apple",
  "browse",
  "search",
  "ref",
  "dp"
]);

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

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function ensureTmdbConfigured() {
  if (!hasTmdbConfig()) {
    throw new Error("TMDb API key missing. Add TMDB_API_KEY in env, restart the app, then try AI Fetch again.");
  }
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  ensureTmdbConfigured();
  const url = new URL(`${TMDB_API_BASE}${path}`);
  const key = tmdbApiKey();
  if (key) url.searchParams.set("api_key", key);
  Object.entries(params).forEach(([name, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  });

  const response = await fetch(url, { headers: tmdbAuthHeaders(), next: { revalidate: 60 * 60 } });
  if (response.status === 401 || response.status === 403) {
    throw new Error("TMDb rejected the API key. Check TMDB_API_KEY and restart the app.");
  }
  if (response.status === 429) {
    throw new Error("TMDb rate limit reached. Wait a minute and try again.");
  }
  if (!response.ok) {
    throw new Error(`TMDb request failed (${response.status}). Try again or search by movie name.`);
  }
  return response.json() as Promise<T>;
}

function detectPlatformFromUrl(input?: string | null): AiImportPlatform | null {
  if (!input || !isHttpUrl(input)) return null;

  try {
    const host = new URL(input).hostname.replace(/^www\./, "").toLowerCase();
    const rule = platformRules.find((platform) =>
      platform.hosts.some((domain) => host === domain || host.endsWith(`.${domain}`))
    );
    if (!rule) return null;
    return {
      key: rule.key,
      name: rule.name,
      homeUrl: rule.homeUrl,
      searchUrl: rule.searchPattern
    };
  } catch {
    return null;
  }
}

function cleanTitleToken(value: string) {
  return decodeURIComponent(value)
    .replace(/\+/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\.(html?|aspx?)$/i, "")
    .replace(/\b(season|episode|ep|s\d+|e\d+)\b/gi, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^a-zA-Z0-9\s:'&.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleFromUrl(input: string) {
  if (!isHttpUrl(input)) return input.trim();

  const url = new URL(input);
  const titleParams = ["q", "query", "search", "term", "keyword", "phrase", "title"];
  for (const param of titleParams) {
    const value = url.searchParams.get(param);
    if (value && value.trim().length > 1) return cleanTitleToken(value);
  }

  const pathSegments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.split("?")[0])
    .filter((segment) => !/^\d+$/.test(segment))
    .filter((segment) => !/^[a-z]{2}(-[a-z]{2})?$/i.test(segment))
    .filter((segment) => !noisyUrlWords.has(segment.toLowerCase()));

  const scored = pathSegments
    .map((segment) => cleanTitleToken(segment))
    .filter((segment) => segment.length > 1)
    .filter((segment) => !noisyUrlWords.has(segment.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  return scored[0] || "";
}

function platformSearchUrl(platform: AiImportPlatform | null, title: string) {
  if (!platform?.searchUrl) return null;
  return platform.searchUrl.replace("{query}", encodeURIComponent(title));
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

function candidateFromTmdb(item: any): AiImportCandidate | null {
  if (item.media_type && item.media_type !== "movie" && item.media_type !== "tv") return null;
  const mediaType = (item.media_type || (item.title ? "movie" : "tv")) as "movie" | "tv";
  const releaseDate = item.release_date || item.first_air_date || null;
  const title = item.title || item.name || item.original_title || item.original_name;
  if (!item.id || !title) return null;

  return {
    tmdbId: item.id,
    mediaType,
    title,
    originalTitle: item.original_title || item.original_name || null,
    overview: item.overview || null,
    releaseDate,
    releaseYear: releaseDate ? Number(String(releaseDate).slice(0, 4)) : null,
    posterUrl: imageUrl(item.poster_path, "w342"),
    backdropUrl: imageUrl(item.backdrop_path, "w780"),
    rating: item.vote_average ?? null,
    popularity: item.popularity ?? null
  };
}

function scoreCandidate(candidate: AiImportCandidate, preferredType: "auto" | "movie" | "tv") {
  return (candidate.popularity || 0) + (preferredType !== "auto" && candidate.mediaType === preferredType ? 1000 : 0);
}

async function searchTmdbCandidates(query: string, preferredType: "auto" | "movie" | "tv" = "auto") {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new Error("Metadata not found. Try searching by movie name.");
  const data = await tmdbFetch<any>("/search/multi", { query: cleanQuery, include_adult: false, page: 1 });
  const candidates = (data.results ?? [])
    .map(candidateFromTmdb)
    .filter(Boolean) as AiImportCandidate[];
  return candidates
    .filter((item) => preferredType === "auto" || item.mediaType === preferredType)
    .sort((a, b) => scoreCandidate(b, preferredType) - scoreCandidate(a, preferredType))
    .slice(0, 12);
}

function baseDraft(
  item: any,
  mediaType: "movie" | "tv",
  sourceInput: string,
  context: { extractedTitle?: string | null; officialWatchUrl?: string | null; platform?: AiImportPlatform | null } = {}
): AiImportDraft {
  const title = item.title || item.name || item.original_title || item.original_name || context.extractedTitle || sourceInput;
  const originalTitle = item.original_title || item.original_name || title;
  const releaseDate = item.release_date || item.first_air_date || null;
  const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) : null;
  const trailer = youtubeTrailer(item.videos);
  const genres = (item.genres ?? []).map((genre: any) => genre.name).filter(Boolean);
  const productionCompanies = (item.production_companies ?? []).map((company: any) => company.name).filter(Boolean);
  const contentType = mediaType === "tv" ? "web_series" : "movie";
  const platform = context.platform || detectPlatformFromUrl(context.officialWatchUrl);

  return {
    source: "tmdb",
    sourceLabel: "TMDb",
    input: sourceInput,
    extractedTitle: context.extractedTitle || null,
    officialWatchUrl: context.officialWatchUrl || null,
    platform,
    linkType: context.officialWatchUrl ? "direct_title_page" : "platform_search",
    openMode: context.officialWatchUrl ? "external" : "auto",
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

async function importMovie(id: number, input: string, context: { extractedTitle?: string | null; officialWatchUrl?: string | null; platform?: AiImportPlatform | null } = {}) {
  const item = await tmdbFetch<any>(`/movie/${id}`, {
    append_to_response: "credits,videos,images,external_ids,release_dates,alternative_titles"
  });
  const draft = baseDraft(item, "movie", input, context);
  draft.alternativeTitles = (item.alternative_titles?.titles ?? []).slice(0, 12).map((entry: any) => entry.title).filter(Boolean);
  draft.duplicateWarnings = await duplicateWarnings(draft);
  draft.missingFields = missingFields(draft);
  return draft;
}

async function importSeries(
  id: number,
  input: string,
  includeSeasons = true,
  context: { extractedTitle?: string | null; officialWatchUrl?: string | null; platform?: AiImportPlatform | null } = {}
) {
  const item = await tmdbFetch<any>(`/tv/${id}`, {
    append_to_response: "credits,videos,images,external_ids,content_ratings,alternative_titles"
  });
  const draft = baseDraft(item, "tv", input, context);
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
        } catch {
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

async function findByImdb(imdbId: string, input: string) {
  const data = await tmdbFetch<any>(`/find/${imdbId}`, { external_source: "imdb_id" });
  const movie = data.movie_results?.[0];
  if (movie) return importMovie(movie.id, input);
  const tv = data.tv_results?.[0];
  if (tv) return importSeries(tv.id, input);
  throw new Error("No TMDb match found for this IMDb ID. Try searching by movie name.");
}

async function detailsFromSelection(body: ImportRequest) {
  const id = Number(body.tmdbId);
  const mediaType = body.selectedMediaType;
  if (!Number.isFinite(id) || (mediaType !== "movie" && mediaType !== "tv")) {
    throw new Error("Select a valid TMDb result first.");
  }
  const context = {
    extractedTitle: body.extractedTitle || null,
    officialWatchUrl: body.officialWatchUrl || null,
    platform: body.platform || detectPlatformFromUrl(body.officialWatchUrl)
  };
  return mediaType === "tv"
    ? importSeries(id, body.input || context.extractedTitle || String(id), body.includeSeasons !== false, context)
    : importMovie(id, body.input || context.extractedTitle || String(id), context);
}

async function searchFromInput(input: string, mode: AiImportMode, mediaType: "auto" | "movie" | "tv") {
  ensureTmdbConfigured();
  if (mode === "url" && !isHttpUrl(input)) {
    throw new Error("Invalid URL. Paste an official https URL, or use Movie Name Search for plain titles.");
  }
  const platform = detectPlatformFromUrl(input);
  const officialWatchUrl = isHttpUrl(input) ? input : null;
  const extractedTitle = officialWatchUrl ? extractTitleFromUrl(input) : input.trim();
  if (!extractedTitle) {
    throw new Error("Metadata not found. This URL does not contain a readable title. Try searching by movie name.");
  }

  const candidates = await searchTmdbCandidates(extractedTitle, mediaType);
  if (!candidates.length) {
    throw new Error(`Metadata not found for "${extractedTitle}". Try searching by exact movie name.`);
  }

  return {
    ok: true,
    needsSelection: true,
    candidates,
    extractedTitle,
    platform,
    warnings: officialWatchUrl && !platform ? ["Official URL kept, but platform was not recognized. Review platform before publishing."] : []
  };
}

async function importBestCandidate(input: string, mediaType: "auto" | "movie" | "tv", includeSeasons: boolean) {
  const platform = detectPlatformFromUrl(input);
  const officialWatchUrl = isHttpUrl(input) ? input : null;
  const extractedTitle = officialWatchUrl ? extractTitleFromUrl(input) : input.trim();
  if (!extractedTitle) throw new Error("Metadata not found. Try searching by movie name.");
  const candidates = await searchTmdbCandidates(extractedTitle, mediaType);
  const first = candidates[0];
  if (!first) throw new Error(`Metadata not found for "${extractedTitle}".`);
  const context = { extractedTitle, officialWatchUrl, platform };
  return first.mediaType === "tv"
    ? importSeries(first.tmdbId, input, includeSeasons, context)
    : importMovie(first.tmdbId, input, context);
}

async function importDirect(input: string, mode: AiImportMode, mediaType: "auto" | "movie" | "tv", includeSeasons: boolean) {
  ensureTmdbConfigured();
  const imdbId = parseImdbId(input);
  if (mode === "imdb" || imdbId) return findByImdb(imdbId || input, input);

  const parsedTmdb = parseTmdbFromUrl(input) || parsePlainTmdbId(input, mediaType);
  if (mode === "tmdb" || parsedTmdb) {
    const target = parsedTmdb || { mediaType: mediaType === "tv" ? "tv" : "movie", id: Number(input) };
    if (!Number.isFinite(target.id)) throw new Error("Enter a valid TMDb movie/TV ID or URL.");
    return target.mediaType === "tv" ? importSeries(target.id, input, includeSeasons) : importMovie(target.id, input);
  }

  return importBestCandidate(input, mediaType, includeSeasons);
}

export async function POST(request: Request) {
  const { isAdmin } = await requireAdminProfile();
  if (!isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });

  try {
    const body = (await request.json()) as ImportRequest;
    const action = body.action || "search";
    const mode = body.mode || "auto";
    const input = String(body.input || "").trim();
    const mediaType = body.mediaType || "auto";
    const includeSeasons = body.includeSeasons !== false;

    if (action === "details") {
      const draft = await detailsFromSelection(body);
      return NextResponse.json({ ok: true, draft });
    }

    if (!input) throw new Error("Enter a URL, IMDb ID, TMDb ID, or title.");

    if (mode === "bulk") {
      const inputs = input.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, MAX_BULK_ITEMS);
      const results: AiImportResult[] = [];
      for (const item of inputs) {
        try {
          results.push({ input: item, ok: true, draft: await importDirect(item, "auto", mediaType, includeSeasons) });
        } catch (error) {
          results.push({ input: item, ok: false, error: error instanceof Error ? error.message : "Import failed." });
        }
      }
      return NextResponse.json({ ok: true, results, warnings: inputs.length === MAX_BULK_ITEMS ? ["Bulk import was capped at 50 items."] : [] });
    }

    if (mode === "imdb" || mode === "tmdb" || parseImdbId(input) || parseTmdbFromUrl(input) || parsePlainTmdbId(input, mediaType)) {
      const draft = await importDirect(input, mode, mediaType, includeSeasons);
      return NextResponse.json({ ok: true, draft });
    }

    return NextResponse.json(await searchFromInput(input, mode, mediaType));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI import failed."
    }, { status: 400 });
  }
}
