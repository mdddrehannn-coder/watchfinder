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

type PageMetadata = {
  titleCandidates: string[];
  canonicalUrl?: string | null;
  fetchedFrom?: "direct" | "proxy" | null;
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

const platformTitleNoise = [
  "Disney+ Hotstar",
  "JioHotstar",
  "Hotstar",
  "Netflix",
  "Prime Video",
  "Amazon Prime Video",
  "Zee5",
  "SonyLIV",
  "YouTube",
  "Aha",
  "Apple TV",
  "WatchFinder"
];

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

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: "\"",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " "
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => named[String(name).toLowerCase()] || `&${name};`);
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function smartTitleCase(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean || /[A-Z]/.test(clean.replace(/\b(?:and|or|the|of|in|on)\b/g, ""))) return clean;
  return clean.replace(/\b([a-z])([a-z'&.]*)/gi, (_, first, rest) => `${String(first).toUpperCase()}${String(rest).toLowerCase()}`);
}

function isLikelyJunkTitle(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean || clean.length < 2) return true;
  if (/^(www\.)?[a-z0-9-]+\.(com|in|net|org|video|tv)$/i.test(clean)) return true;
  if (/^https?:\/\//i.test(clean)) return true;
  if (noisyUrlWords.has(clean)) return true;
  if (/^\d+$/.test(clean)) return true;
  return false;
}

function cleanTitleToken(value: string) {
  return safeDecodeURIComponent(value)
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

function cleanTitle(rawTitle?: string | null, platform?: AiImportPlatform | null) {
  if (!rawTitle) return "";

  const decoded = decodeHtmlEntities(safeDecodeURIComponent(rawTitle))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const platformNames = [
    ...platformTitleNoise,
    platform?.name,
    platform?.key
  ].filter(Boolean) as string[];

  const pieces = [
    decoded,
    ...decoded.split(/\s+(?:\||-|–|—|:)\s+/g)
  ];

  const candidates = pieces
    .map((piece) => {
      let title = piece;
      for (const name of platformNames) {
        title = title.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
      }
      return title
        .replace(/\b(watch|stream|streaming|play|trailer|teaser|official|full movie|full episode)\b/gi, " ")
        .replace(/\b(on|online|now|free|hd|uhd|4k)\b/gi, " ")
        .replace(/\b(movie|movies|series|show|shows|episode|episodes|season)\b$/gi, " ")
        .replace(/\b(19|20)\d{2}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    })
    .map(cleanTitleToken)
    .map(smartTitleCase)
    .filter((candidate) => !isLikelyJunkTitle(candidate));

  return candidates
    .sort((a, b) => {
      const score = (title: string) => {
        const words = title.split(/\s+/).filter(Boolean).length;
        return Math.min(title.length, 80) + Math.min(words, 8) * 8 - (words > 10 ? 40 : 0);
      };
      return score(b) - score(a);
    })[0] || "";
}

function extractSlugFromUrl(input: string) {
  if (!isHttpUrl(input)) return input.trim();

  const url = new URL(input);
  const platform = detectPlatformFromUrl(input);
  const titleParams = ["q", "query", "search", "term", "keyword", "phrase", "title"];
  for (const param of titleParams) {
    const value = url.searchParams.get(param);
    const cleaned = cleanTitle(value, platform);
    if (cleaned) return cleaned;
  }

  const pathSegments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.split("?")[0])
    .map((segment) => segment.replace(/\.(html?|aspx?)$/i, ""))
    .filter((segment) => !/^\d+$/.test(segment))
    .filter((segment) => !/^tt\d{6,12}$/i.test(segment))
    .filter((segment) => !/^[a-z0-9]{16,}$/i.test(segment))
    .filter((segment) => !/^[a-z]*\d{5,}[a-z0-9]*$/i.test(segment))
    .filter((segment) => !/^[a-z]{2}(-[a-z]{2})?$/i.test(segment))
    .filter((segment) => !noisyUrlWords.has(segment.toLowerCase()));

  const scored = pathSegments
    .map((segment) => cleanTitle(segment, platform))
    .filter((segment) => segment.length > 1)
    .filter((segment) => !noisyUrlWords.has(segment.toLowerCase()))
    .sort((a, b) => b.length - a.length);

  return scored[0] || "";
}

function getTagAttribute(tag: string, attr: string) {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeHtmlEntities(match[1]) : null;
}

function collectJsonLdTitles(value: any, output: string[] = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdTitles(item, output));
    return output;
  }
  if (typeof value !== "object") return output;
  ["name", "headline", "alternateName"].forEach((key) => {
    const entry = value[key];
    if (typeof entry === "string") output.push(entry);
    if (Array.isArray(entry)) entry.filter((item) => typeof item === "string").forEach((item) => output.push(item));
  });
  if (value["@graph"]) collectJsonLdTitles(value["@graph"], output);
  return output;
}

function metadataProxyUrl(targetUrl: string) {
  const proxy = process.env.OPTIONAL_METADATA_PROXY_URL;
  if (!proxy) return null;
  if (proxy.includes("{url}")) return proxy.replace("{url}", encodeURIComponent(targetUrl));
  try {
    const url = new URL(proxy);
    url.searchParams.set("url", targetUrl);
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 WatchFinder metadata fetch"
      },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;
    return response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageMetadata(input: string): Promise<PageMetadata> {
  if (!isHttpUrl(input)) return { titleCandidates: [], canonicalUrl: null, fetchedFrom: null };

  let html = await fetchHtml(input);
  let fetchedFrom: PageMetadata["fetchedFrom"] = html ? "direct" : null;
  if (!html) {
    const proxy = metadataProxyUrl(input);
    if (proxy) {
      html = await fetchHtml(proxy);
      fetchedFrom = html ? "proxy" : null;
    }
  }
  if (!html) return { titleCandidates: [], canonicalUrl: null, fetchedFrom: null };

  const titleCandidates: string[] = [];
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || [];
  metaTags.forEach((tag) => {
    const property = getTagAttribute(tag, "property")?.toLowerCase();
    const name = getTagAttribute(tag, "name")?.toLowerCase();
    const content = getTagAttribute(tag, "content");
    if (content && ["og:title", "twitter:title", "title"].includes(property || name || "")) titleCandidates.push(content);
  });

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) titleCandidates.push(decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim()));

  const canonicalTag = (html.match(/<link\s+[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i) || [])[0];
  const canonicalUrl = canonicalTag ? getTagAttribute(canonicalTag, "href") : null;

  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      collectJsonLdTitles(JSON.parse(decodeHtmlEntities(script[1]))).forEach((title) => titleCandidates.push(title));
    } catch {
      // Ignore malformed page metadata. The URL slug fallback still runs.
    }
  }

  return {
    titleCandidates: Array.from(new Set(titleCandidates.map((title) => title.trim()).filter(Boolean))).slice(0, 12),
    canonicalUrl,
    fetchedFrom
  };
}

function uniqueTitles(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

function normalizeForMatch(value?: string | null) {
  return cleanTitle(value || "", null)
    .toLowerCase()
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateConfidence(candidate: AiImportCandidate, detectedTitle: string) {
  const detected = normalizeForMatch(detectedTitle);
  const title = normalizeForMatch(candidate.title);
  const original = normalizeForMatch(candidate.originalTitle);
  if (!detected || (!title && !original)) return 0;
  const titleOptions = [title, original].filter(Boolean);
  if (titleOptions.some((option) => option === detected)) return 100;
  if (titleOptions.some((option) => option.replace(/\s+/g, "") === detected.replace(/\s+/g, ""))) return 96;
  if (titleOptions.some((option) => option.startsWith(detected) || detected.startsWith(option))) return 82;

  const detectedTokens = new Set(detected.split(" ").filter((token) => token.length > 1));
  if (!detectedTokens.size) return 0;
  const bestOverlap = Math.max(
    ...titleOptions.map((option) => {
      const tokens = new Set(option.split(" ").filter((token) => token.length > 1));
      const shared = [...detectedTokens].filter((token) => tokens.has(token)).length;
      return Math.round((shared / Math.max(detectedTokens.size, tokens.size || 1)) * 100);
    })
  );
  return bestOverlap;
}

function scoreCandidate(candidate: AiImportCandidate, preferredType: "auto" | "movie" | "tv") {
  return (candidate.popularity || 0) + (preferredType !== "auto" && candidate.mediaType === preferredType ? 1000 : 0);
}

function rankCandidatesForTitle(candidates: AiImportCandidate[], detectedTitle: string, preferredType: "auto" | "movie" | "tv") {
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      confidence: candidateConfidence(candidate, detectedTitle)
    }))
    .sort((a, b) => {
      const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
      if (confidenceDiff) return confidenceDiff;
      return scoreCandidate(b, preferredType) - scoreCandidate(a, preferredType);
    });
  return ranked.map((candidate, index) => ({
    ...candidate,
    isBestMatch: index === 0
  }));
}

function autoSelectBestMatch(results: AiImportCandidate[], detectedTitle: string) {
  const [best, second] = results;
  if (!best) return null;
  const bestScore = best.confidence ?? candidateConfidence(best, detectedTitle);
  const nextScore = second?.confidence ?? (second ? candidateConfidence(second, detectedTitle) : 0);
  if (bestScore >= 96) return best;
  if (bestScore >= 86 && bestScore - nextScore >= 12) return best;
  if (results.length === 1 && bestScore >= 72) return best;
  return null;
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

async function searchTMDbByTitle(title: string, preferredType: "auto" | "movie" | "tv" = "auto") {
  return searchTmdbCandidates(title, preferredType);
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

async function fetchTrailer(id: number, type: "movie" | "tv") {
  const videos = await tmdbFetch<any>(`/${type}/${id}/videos`, {});
  return youtubeTrailer(videos);
}

function mapToAdminForm(draft: AiImportDraft, officialUrl?: string | null, platform?: AiImportPlatform | null) {
  return {
    ...draft,
    officialWatchUrl: officialUrl || draft.officialWatchUrl || null,
    platform: platform || draft.platform || detectPlatformFromUrl(officialUrl),
    linkType: officialUrl ? "direct_title_page" : draft.linkType,
    openMode: officialUrl ? "external" : draft.openMode
  } as AiImportDraft;
}

async function fetchFullTMDbDetails(
  id: number,
  type: "movie" | "tv",
  input: string,
  includeSeasons: boolean,
  context: { extractedTitle?: string | null; officialWatchUrl?: string | null; platform?: AiImportPlatform | null } = {}
) {
  const draft = type === "tv" ? await importSeries(id, input, includeSeasons, context) : await importMovie(id, input, context);
  return mapToAdminForm(draft, context.officialWatchUrl, context.platform);
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
  return fetchFullTMDbDetails(
    id,
    mediaType,
    body.input || context.extractedTitle || String(id),
    body.includeSeasons !== false,
    context
  );
}

async function detectTitleCandidates(input: string, platform: AiImportPlatform | null) {
  const metadata = await fetchPageMetadata(input);
  const slugTitle = extractSlugFromUrl(input);
  const canonicalTitle = metadata.canonicalUrl ? extractSlugFromUrl(metadata.canonicalUrl) : "";
  const titles = uniqueTitles([
    ...metadata.titleCandidates.map((title) => cleanTitle(title, platform)),
    cleanTitle(canonicalTitle, platform),
    cleanTitle(slugTitle, platform)
  ]).filter((title) => !isLikelyJunkTitle(title));
  return { titles, metadata };
}

async function searchFromInput(input: string, mode: AiImportMode, mediaType: "auto" | "movie" | "tv", includeSeasons: boolean) {
  ensureTmdbConfigured();
  if (mode === "url" && !isHttpUrl(input)) {
    throw new Error("Invalid URL. Paste an official https URL, or use Movie Name Search for plain titles.");
  }
  const platform = detectPlatformFromUrl(input);
  const officialWatchUrl = isHttpUrl(input) ? input : null;
  const titleCandidates = officialWatchUrl ? (await detectTitleCandidates(input, platform)).titles : [cleanTitle(input, platform)];
  const extractedTitle = titleCandidates[0] || "";
  if (!extractedTitle) {
    throw new Error("Could not detect title from this link. Try another official link.");
  }

  let candidates: AiImportCandidate[] = [];
  for (const title of titleCandidates) {
    candidates = await searchTMDbByTitle(title, mediaType);
    if (candidates.length) break;
  }
  if (!candidates.length) {
    throw new Error(`Metadata not found for "${extractedTitle}". Try another official link.`);
  }
  const ranked = rankCandidatesForTitle(candidates, extractedTitle, mediaType);
  const best = officialWatchUrl ? autoSelectBestMatch(ranked, extractedTitle) : null;
  if (best) {
    const draft = await fetchFullTMDbDetails(best.tmdbId, best.mediaType, input, includeSeasons, {
      extractedTitle,
      officialWatchUrl,
      platform
    });
    return { ok: true, draft, extractedTitle, platform };
  }

  return {
    ok: true,
    needsSelection: true,
    candidates: ranked.slice(0, 3),
    extractedTitle,
    platform,
    warnings: officialWatchUrl && !platform ? ["Official URL kept, but platform was not recognized. Review platform before publishing."] : []
  };
}

async function importBestCandidate(input: string, mediaType: "auto" | "movie" | "tv", includeSeasons: boolean) {
  const platform = detectPlatformFromUrl(input);
  const officialWatchUrl = isHttpUrl(input) ? input : null;
  const titleCandidates = officialWatchUrl ? (await detectTitleCandidates(input, platform)).titles : [cleanTitle(input, platform)];
  const extractedTitle = titleCandidates[0] || "";
  if (!extractedTitle) throw new Error("Could not detect title from this link. Try another official link.");
  let candidates: AiImportCandidate[] = [];
  for (const title of titleCandidates) {
    candidates = await searchTMDbByTitle(title, mediaType);
    if (candidates.length) break;
  }
  candidates = rankCandidatesForTitle(candidates, extractedTitle, mediaType);
  const first = candidates[0];
  if (!first) throw new Error(`Metadata not found for "${extractedTitle}".`);
  const context = { extractedTitle, officialWatchUrl, platform };
  return fetchFullTMDbDetails(first.tmdbId, first.mediaType, input, includeSeasons, context);
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

    return NextResponse.json(await searchFromInput(input, mode, mediaType, includeSeasons));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI import failed."
    }, { status: 400 });
  }
}
