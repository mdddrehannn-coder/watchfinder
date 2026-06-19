import { NextResponse } from "next/server";
import { slugify } from "@/lib/format";
import { accessTypeMeta, detectAccessTypeFromText, normalizeAccessType, type AccessType } from "@/lib/access-type";
import { actualAudioLanguages, primaryLanguageForSelection, WATCHFINDER_LANGUAGES, withLanguageDisplayLabels } from "@/lib/languages";
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

const languageNames: Record<string, string> = {
  hi: "Hindi",
  hin: "Hindi",
  en: "English",
  eng: "English",
  ta: "Tamil",
  tam: "Tamil",
  te: "Telugu",
  tel: "Telugu",
  ml: "Malayalam",
  mal: "Malayalam",
  kn: "Kannada",
  kan: "Kannada",
  mr: "Marathi",
  mar: "Marathi",
  bn: "Bengali",
  ben: "Bengali",
  pa: "Punjabi",
  pan: "Punjabi",
  gu: "Gujarati",
  guj: "Gujarati",
  ur: "Urdu",
  urd: "Urdu",
  or: "Odia",
  ori: "Odia",
  as: "Assamese",
  asm: "Assamese",
  bho: "Bhojpuri",
  ne: "Nepali",
  nep: "Nepali"
};

type ImportRequest = {
  action?: "search" | "details" | "import" | "fix_missing";
  mode?: AiImportMode;
  input?: string;
  title?: string | null;
  mediaType?: "auto" | "movie" | "tv";
  requestedContentType?: "movie" | "web_series" | "tv_show" | "cartoon";
  draft?: AiImportDraft | null;
  includeSeasons?: boolean;
  tmdbId?: number;
  selectedMediaType?: "movie" | "tv";
  officialWatchUrl?: string | null;
  extractedTitle?: string | null;
  platform?: AiImportPlatform | null;
  availableLanguages?: string[];
  accessType?: AccessType;
  accessTypeReason?: string | null;
};

type PageMetadata = {
  titleCandidates: string[];
  descriptionCandidates: string[];
  imageCandidates: string[];
  availableLanguages: string[];
  accessType: AccessType;
  accessTypeReason?: string | null;
  canonicalUrl?: string | null;
  fetchedFrom?: "direct" | "proxy" | null;
};

type ImportContext = {
  extractedTitle?: string | null;
  officialWatchUrl?: string | null;
  platform?: AiImportPlatform | null;
  availableLanguages?: string[];
  accessType?: AccessType;
  accessTypeReason?: string | null;
  pageMetadata?: PageMetadata | null;
};

type PlatformRule = AiImportPlatform & {
  hosts: string[];
  searchPattern?: string;
  pathIncludes?: string[];
};

const platformRules: PlatformRule[] = [
  {
    key: "jiohotstar",
    name: "JioHotstar",
    hosts: ["hotstar.com", "jiohotstar.com", "jiocinema.com", "disneyplus.com"],
    homeUrl: "https://www.hotstar.com/",
    searchPattern: "https://www.hotstar.com/in/search?q={query}"
  },
  {
    key: "amazon-minitv",
    name: "Amazon miniTV",
    hosts: ["amazon.in", "mini.tv"],
    pathIncludes: ["/minitv"],
    homeUrl: "https://www.amazon.in/minitv",
    searchPattern: "https://www.amazon.in/minitv/search?query={query}"
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
    hosts: ["primevideo.com", "primevideo.in", "amazon.com", "amazon.in", "amazon.co.uk"],
    pathIncludes: ["/detail", "/gp/video", "/video", "/prime-video"],
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
    key: "mx-player",
    name: "MX Player",
    hosts: ["mxplayer.in", "mxplayer.com"],
    homeUrl: "https://www.mxplayer.in/",
    searchPattern: "https://www.mxplayer.in/search/{query}"
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
  },
  {
    key: "sunnxt",
    name: "SunNXT",
    hosts: ["sunnxt.com"],
    homeUrl: "https://www.sunnxt.com/",
    searchPattern: "https://www.sunnxt.com/search?q={query}"
  },
  {
    key: "hoichoi",
    name: "Hoichoi",
    hosts: ["hoichoi.tv"],
    homeUrl: "https://www.hoichoi.tv/",
    searchPattern: "https://www.hoichoi.tv/search?q={query}"
  },
  {
    key: "lionsgate-play",
    name: "Lionsgate Play",
    hosts: ["lionsgateplay.com"],
    homeUrl: "https://www.lionsgateplay.com/",
    searchPattern: "https://www.lionsgateplay.com/search?q={query}"
  },
  {
    key: "discovery-plus",
    name: "Discovery+",
    hosts: ["discoveryplus.com", "discoveryplus.in"],
    homeUrl: "https://www.discoveryplus.com/",
    searchPattern: "https://www.discoveryplus.com/search?q={query}"
  },
  {
    key: "crunchyroll",
    name: "Crunchyroll",
    hosts: ["crunchyroll.com"],
    homeUrl: "https://www.crunchyroll.com/",
    searchPattern: "https://www.crunchyroll.com/search?q={query}"
  },
  {
    key: "manoramamax",
    name: "ManoramaMAX",
    hosts: ["manoramamax.com"],
    homeUrl: "https://www.manoramamax.com/",
    searchPattern: "https://www.manoramamax.com/search?q={query}"
  },
  {
    key: "etv-win",
    name: "ETV Win",
    hosts: ["etvwin.com"],
    homeUrl: "https://www.etvwin.com/",
    searchPattern: "https://www.etvwin.com/search?q={query}"
  },
  {
    key: "shemaroome",
    name: "ShemarooMe",
    hosts: ["shemaroome.com"],
    homeUrl: "https://www.shemaroome.com/",
    searchPattern: "https://www.shemaroome.com/search?q={query}"
  },
  {
    key: "chaupal",
    name: "Chaupal",
    hosts: ["chaupal.tv"],
    homeUrl: "https://www.chaupal.tv/",
    searchPattern: "https://www.chaupal.tv/search?q={query}"
  },
  {
    key: "stage",
    name: "Stage",
    hosts: ["stage.in"],
    homeUrl: "https://www.stage.in/",
    searchPattern: "https://www.stage.in/search?q={query}"
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
  "disneyplus",
  "netflix",
  "primevideo",
  "prime",
  "amazon",
  "minitv",
  "zee5",
  "sonyliv",
  "youtube",
  "jiocinema",
  "mxplayer",
  "mx",
  "aha",
  "apple",
  "sunnxt",
  "hoichoi",
  "lionsgate",
  "lionsgateplay",
  "discovery",
  "discoveryplus",
  "crunchyroll",
  "manoramamax",
  "manorama",
  "etv",
  "etvwin",
  "shemaroo",
  "shemaroome",
  "chaupal",
  "stage",
  "browse",
  "search",
  "official",
  "stream",
  "streaming",
  "ref",
  "dp",
  "detail",
  "details",
  "title",
  "titles",
  "content",
  "watchnow"
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
  "JioCinema",
  "MX Player",
  "YouTube",
  "Aha",
  "Apple TV",
  "Amazon miniTV",
  "SunNXT",
  "Hoichoi",
  "Lionsgate Play",
  "Discovery+",
  "Crunchyroll",
  "ManoramaMAX",
  "ETV Win",
  "ShemarooMe",
  "Chaupal",
  "Stage",
  "WatchFinder"
];

function tmdbAuthHeaders(): Record<string, string> {
  const token = process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_READ_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function tmdbApiKey() {
  return process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
}

function omdbApiKey() {
  return process.env.OMDB_API_KEY || "";
}

function youtubeApiKey() {
  return process.env.YOUTUBE_API_KEY || "";
}

function hasTmdbConfig() {
  return Boolean(tmdbApiKey() || Object.keys(tmdbAuthHeaders()).length);
}

function languageNameFromCode(value?: string | null) {
  const code = String(value || "").trim().toLowerCase();
  return languageNames[code] || (code ? code.toUpperCase() : null);
}

function languageStateFromSources({
  originalLanguage,
  platformLanguages,
  platform
}: {
  originalLanguage?: string | null;
  platformLanguages?: string[];
  platform?: AiImportPlatform | null;
}) {
  const original = languageNameFromCode(originalLanguage) || originalLanguage || null;
  const platformActual = actualAudioLanguages(platformLanguages || []);
  const availableActual = platformActual.length ? platformActual : actualAudioLanguages([original || ""]);
  const selected = withLanguageDisplayLabels(availableActual, original);
  const warning = platform?.key === "jiohotstar" && !platformActual.length
    ? "Only original language detected. Please verify available audio languages from official platform."
    : null;

  return {
    language: primaryLanguageForSelection(selected) || original,
    originalLanguage: original,
    availableLanguages: selected,
    warning
  };
}

function applyRequestedContentType(
  draft: AiImportDraft,
  requestedContentType?: ImportRequest["requestedContentType"]
) {
  if (!requestedContentType) return enrichDraft(draft);
  return enrichDraft({
    ...draft,
    contentType: requestedContentType,
    tags: Array.from(new Set([requestedContentType, ...draft.tags]))
  });
}

function mediaTypeFromRequested(
  requestedContentType: ImportRequest["requestedContentType"],
  fallback: "auto" | "movie" | "tv"
) {
  if (requestedContentType === "web_series" || requestedContentType === "tv_show") return "tv";
  if (requestedContentType === "movie") return "movie";
  return fallback;
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
    throw new Error("TMDb API key is not configured.");
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
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.toLowerCase();
    const rule = platformRules.find((platform) => {
      const matchedHost = platform.hosts.find((domain) => host === domain || host.endsWith(`.${domain}`));
      if (!matchedHost) return false;
      if (!platform.pathIncludes?.length) return true;
      const needsPathMarker = /^amazon\./i.test(host);
      return !needsPathMarker || platform.pathIncludes.some((marker) => path.includes(marker));
    });
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

function detectContentTypeFromUrl(input?: string | null): "movie" | "tv" | null {
  if (!input || !isHttpUrl(input)) return null;
  try {
    const segments = new URL(input).pathname
      .split("/")
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean);
    if (segments.some((segment) => ["movie", "movies", "film", "films", "cinema"].includes(segment))) return "movie";
    if (segments.some((segment) => ["tv", "show", "shows", "series", "web-series", "anime", "episodes"].includes(segment))) return "tv";
  } catch {
    return null;
  }
  return null;
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
  const domainish = clean.replace(/[\s.]+/g, ".");
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|in|net|org|video|tv)$/i.test(domainish)) return true;
  const wordKey = clean.replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(www\s+)?[a-z0-9-]+\s+(com|in|net|org|video|tv)$/i.test(wordKey)) return true;
  if (/^(www\s+)?(hotstar|jiohotstar|netflix|primevideo|youtube|zee5|sonyliv|jiocinema|mxplayer|aha|sunnxt|hoichoi|lionsgateplay|discoveryplus|crunchyroll|manoramamax|etvwin|shemaroome|chaupal|stage)\s*(com|in|video|tv)?$/i.test(wordKey)) return true;
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
    ...decoded.split(/\s+(?:\||-|\u2013|\u2014|:)\s+/g)
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

  const rawSegments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.split("?")[0])
    .map((segment) => segment.replace(/\.(html?|aspx?)$/i, ""));

  const contentMarkers = [
    "movie",
    "movies",
    "film",
    "films",
    "show",
    "shows",
    "series",
    "tv",
    "web-series",
    "anime",
    "watch",
    "title",
    "titles",
    "detail",
    "details",
    "content",
    "video"
  ];
  for (const marker of contentMarkers) {
    const markerIndex = rawSegments.findIndex((segment) => segment.toLowerCase() === marker);
    if (markerIndex >= 0) {
      const contentSlug = rawSegments.slice(markerIndex + 1).find((segment) => {
        const clean = segment.toLowerCase();
        return (
          clean &&
          clean !== "watch" &&
          !/^\d+$/.test(clean) &&
          !/^[a-z]*\d{5,}[a-z0-9]*$/i.test(clean) &&
          !noisyUrlWords.has(clean)
        );
      });
      const title = cleanTitle(contentSlug, platform);
      if (title) return title;
    }
  }

  const pathSegments = rawSegments
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

function extractTitleFromUrl(input: string) {
  return extractSlugFromUrl(input);
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

function collectJsonLdStrings(value: any, keys: string[], output: string[] = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdStrings(item, keys, output));
    return output;
  }
  if (typeof value !== "object") return output;

  Object.entries(value).forEach(([key, entry]) => {
    if (keys.includes(key)) {
      if (typeof entry === "string") output.push(entry);
      if (Array.isArray(entry)) {
        entry.forEach((item) => {
          if (typeof item === "string") output.push(item);
          if (item?.url && typeof item.url === "string") output.push(item.url);
        });
      }
      if (entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string") output.push(entry.url);
    }
    collectJsonLdStrings(entry, keys, output);
  });
  return output;
}

function extractLanguageNamesFromText(value?: string | null) {
  if (!value) return [] as string[];
  const normalized = decodeHtmlEntities(String(value))
    .replace(/\\u0026/g, "&")
    .replace(/\\n/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const languages = actualAudioLanguages(WATCHFINDER_LANGUAGES);
  const detected = languages.filter((language) => {
    const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });
  const codeMatches = normalized.match(/(?:^|[^a-z])(?:hi|hin|en|eng|ta|tam|te|tel|ml|mal|kn|kan|mr|mar|bn|ben|pa|pan|gu|guj|ur|urd|or|ori|as|asm|bho|ne|nep)(?=[^a-z]|$)/gi) || [];
  codeMatches
    .map((match) => match.replace(/[^a-z]/gi, "").toLowerCase())
    .map((code) => languageNames[code])
    .filter(Boolean)
    .forEach((language) => detected.push(language));
  return actualAudioLanguages(detected);
}

function collectJsonLanguages(value: any, output: string[] = [], parentKey = "") {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLanguages(item, output, parentKey));
    return output;
  }
  if (typeof value !== "object") {
    if (/audio|language|subtitle|dub/i.test(parentKey)) {
      extractLanguageNamesFromText(String(value)).forEach((language) => output.push(language));
    }
    return output;
  }

  Object.entries(value).forEach(([key, entry]) => {
    if (/audio|language|subtitle|dub/i.test(key)) {
      extractLanguageNamesFromText(JSON.stringify(entry)).forEach((language) => output.push(language));
    }
    collectJsonLanguages(entry, output, key);
  });
  return output;
}

function extractAvailableLanguagesFromHtml(html: string) {
  const detected: string[] = [];

  const jsonScripts = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of jsonScripts) {
    const body = decodeHtmlEntities(script[1]);
    if (!/audio|language|subtitle|dub/i.test(body)) continue;
    try {
      collectJsonLanguages(JSON.parse(body), detected);
    } catch {
      const languageSegments = body.match(/(?:audio|audioLanguages|audio_languages|languages|language|subtitle|subtitles|dubbed|availableIn)[^<>{}\]]{0,260}/gi) || [];
      languageSegments.forEach((segment) => extractLanguageNamesFromText(segment).forEach((language) => detected.push(language)));
    }
  }

  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const segments = visibleText.match(/(?:audio|languages?|subtitles?|dubbed|available in|watch in)[^.]{0,220}/gi) || [];
  segments.forEach((segment) => extractLanguageNamesFromText(segment).forEach((language) => detected.push(language)));

  return actualAudioLanguages(detected);
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
  if (!isHttpUrl(input)) {
    return { titleCandidates: [], descriptionCandidates: [], imageCandidates: [], availableLanguages: [], accessType: "unknown", accessTypeReason: null, canonicalUrl: null, fetchedFrom: null };
  }

  let html = await fetchHtml(input);
  let fetchedFrom: PageMetadata["fetchedFrom"] = html ? "direct" : null;
  if (!html) {
    const proxy = metadataProxyUrl(input);
    if (proxy) {
      html = await fetchHtml(proxy);
      fetchedFrom = html ? "proxy" : null;
    }
  }
  if (!html) {
    const platformDefault = detectAccessTypeFromText("", detectPlatformFromUrl(input));
    return {
      titleCandidates: [],
      descriptionCandidates: [],
      imageCandidates: [],
      availableLanguages: [],
      accessType: platformDefault.accessType,
      accessTypeReason: platformDefault.reason,
      canonicalUrl: null,
      fetchedFrom: null
    };
  }

  const titleCandidates: string[] = [];
  const descriptionCandidates: string[] = [];
  const imageCandidates: string[] = [];
  const availableLanguages = extractAvailableLanguagesFromHtml(html);
  const accessDetection = detectAccessTypeFromText(decodeHtmlEntities(html).replace(/<[^>]+>/g, " "), detectPlatformFromUrl(input));
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || [];
  metaTags.forEach((tag) => {
    const property = getTagAttribute(tag, "property")?.toLowerCase();
    const name = getTagAttribute(tag, "name")?.toLowerCase();
    const content = getTagAttribute(tag, "content");
    if (content && ["og:title", "twitter:title", "title"].includes(property || name || "")) titleCandidates.push(content);
    if (content && ["og:description", "twitter:description", "description"].includes(property || name || "")) descriptionCandidates.push(content);
    if (content && ["og:image", "twitter:image", "image"].includes(property || name || "")) imageCandidates.push(content);
  });

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) titleCandidates.push(decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim()));

  const canonicalTag = (html.match(/<link\s+[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i) || [])[0];
  const canonicalUrl = canonicalTag ? getTagAttribute(canonicalTag, "href") : null;

  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    try {
      const json = JSON.parse(decodeHtmlEntities(script[1]));
      collectJsonLdTitles(json).forEach((title) => titleCandidates.push(title));
      collectJsonLdStrings(json, ["description", "abstract"]).forEach((description) => descriptionCandidates.push(description));
      collectJsonLdStrings(json, ["image", "thumbnailUrl", "contentUrl"]).forEach((image) => imageCandidates.push(image));
      collectJsonLanguages(json).forEach((language) => availableLanguages.push(language));
    } catch {
      // Ignore malformed page metadata. The URL slug fallback still runs.
    }
  }

  return {
    titleCandidates: Array.from(new Set(titleCandidates.map((title) => title.trim()).filter(Boolean))).slice(0, 12),
    descriptionCandidates: Array.from(new Set(descriptionCandidates.map((description) => decodeHtmlEntities(description).trim()).filter(Boolean))).slice(0, 6),
    imageCandidates: Array.from(new Set(imageCandidates.map((image) => image.trim()).filter((image) => isHttpUrl(image)))).slice(0, 8),
    availableLanguages: actualAudioLanguages(availableLanguages),
    accessType: accessDetection.accessType,
    accessTypeReason: accessDetection.reason,
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

async function fetchYouTubeTrailerByTitle(title: string, year?: number | null) {
  const key = youtubeApiKey();
  if (!key || !title.trim()) return { url: null, name: null };

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("q", `${title} ${year || ""} official trailer`.trim());
    url.searchParams.set("key", key);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { url: null, name: null };
    const data = await response.json();
    const videoId = data.items?.[0]?.id?.videoId;
    const name = data.items?.[0]?.snippet?.title || "Official Trailer";
    return videoId ? { url: `https://www.youtube.com/watch?v=${videoId}`, name } : { url: null, name: null };
  } catch {
    return { url: null, name: null };
  }
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
    !draft.genres?.length ? "Genres" : null,
    !draft.availableLanguages?.length && !draft.language ? "Language" : null,
    !draft.cast?.length ? "Cast" : null,
    !draft.director ? "Director" : null,
    !draft.runtimeMinutes ? "Runtime" : null,
    !draft.releaseYear ? "Release year" : null,
    !draft.seoTitle ? "SEO title" : null,
    !draft.seoDescription ? "SEO description" : null,
    !draft.officialWatchUrl ? "Official watch link" : null
  ].filter(Boolean) as string[];
}

function validateFetchedData(draft: Partial<AiImportDraft>) {
  const warnings: string[] = [];
  if (!draft.posterUrl) warnings.push("TMDb did not provide a poster. Add one before publishing.");
  if (!draft.bannerUrl) warnings.push("TMDb did not provide a banner/backdrop. Add one before publishing.");
  if (!draft.trailerUrl) warnings.push("No official YouTube trailer was found on TMDb.");
  if (!draft.description) warnings.push("Description is missing from TMDb.");
  if (!draft.genres?.length) warnings.push("Genres are missing from TMDb.");
  return warnings;
}

function validateOfficialLink(url?: string | null, platform?: AiImportPlatform | null) {
  if (!url) {
    return {
      status: "missing" as const,
      platformName: platform?.name || null,
      message: "No official watch link was provided."
    };
  }

  const detected = detectPlatformFromUrl(url);
  if (detected) {
    return {
      status: "valid" as const,
      platformName: detected.name,
      message: `Official platform detected as ${detected.name}.`
    };
  }

  return {
    status: "unknown" as const,
    platformName: platform?.name || null,
    message: "Unknown platform. Please confirm this is an official legal source."
  };
}

function calculateQualityScore(draft: AiImportDraft) {
  const checks: Array<{ ok: boolean; label: string; weight: number }> = [
    { ok: Boolean(draft.title), label: "Title present", weight: 10 },
    { ok: Boolean(draft.description), label: "Description present", weight: 10 },
    { ok: Boolean(draft.posterUrl), label: "Poster present", weight: 10 },
    { ok: Boolean(draft.bannerUrl), label: "Banner present", weight: 8 },
    { ok: Boolean(draft.trailerUrl), label: "Trailer present", weight: 8 },
    { ok: Boolean(draft.officialWatchUrl), label: "Official watch link present", weight: 8 },
    { ok: Boolean(draft.platform), label: "Platform detected", weight: 8 },
    { ok: Boolean(draft.accessType && draft.accessType !== "unknown"), label: "Access type detected", weight: 3 },
    { ok: Boolean(draft.genres?.length), label: "Genres selected", weight: 8 },
    { ok: Boolean(draft.availableLanguages?.length || draft.language), label: "Language selected", weight: 7 },
    { ok: Boolean(draft.cast?.length || draft.director), label: "Cast/director present", weight: 8 },
    { ok: Boolean(draft.seoTitle && draft.seoDescription), label: "SEO filled", weight: 8 },
    { ok: Boolean(draft.status || "draft"), label: "Status selected", weight: 7 }
  ];
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  const score = Math.round((earned / total) * 100);
  const warnings = checks.filter((item) => !item.ok).map((item) => item.label.replace(" present", "").replace(" selected", ""));
  const label = score >= 90
    ? `${score}% Ready to publish`
    : score >= 70
      ? `${score}% Good but review missing fields`
      : `${score}% Draft only`;
  return { score, label, warnings };
}

function suggestCategoryPlacement(draft: AiImportDraft) {
  const reasons: string[] = [];
  const text = [
    draft.contentType,
    draft.language,
    draft.originalLanguage,
    ...(draft.availableLanguages || []),
    ...(draft.genres || []),
    ...(draft.tags || []),
    ...(draft.keywords || [])
  ].join(" ").toLowerCase();
  const releaseYear = draft.releaseYear || 0;
  let primarySection = "recently_added";

  if (draft.contentType === "cartoon" || text.includes("animation") || text.includes("cartoon")) {
    primarySection = "cartoon";
    reasons.push("Animation/cartoon content detected.");
  } else if (draft.contentType === "tv_show") {
    primarySection = "tv_show";
    reasons.push("TV show content type selected.");
  } else if (draft.contentType === "web_series") {
    primarySection = "web_series";
    reasons.push("Web series content type selected.");
  } else if (text.includes("hindi dubbed")) {
    primarySection = "hindi_dubbed";
    reasons.push("Hindi Dubbed metadata detected.");
  } else if (draft.officialWatchUrl && releaseYear >= new Date().getFullYear() - 2) {
    primarySection = "recently_added";
    reasons.push("Recent official OTT link detected.");
  } else if ((draft.rating || 0) >= 7.5 || (draft.popularityScore || 0) >= 80) {
    primarySection = "trending";
    reasons.push("High rating/popularity detected.");
  }

  if (draft.platform?.key === "youtube" && draft.trailerUrl) {
    primarySection = "official_youtube";
    reasons.push("Official YouTube link/trailer detected.");
  }
  if (text.includes("free legal") || text.includes("public domain")) {
    primarySection = "free_legal";
    reasons.push("Free/legal/public-domain signal detected.");
  }
  if (draft.accessType === "free") {
    primarySection = "free_legal";
    reasons.push("AI detected free platform access.");
  }

  const showInHero = Boolean(draft.bannerUrl && draft.title && draft.description);
  if (showInHero) reasons.push("Strong banner available, eligible for Hero Slider.");

  return {
    primarySection,
    showInHero,
    reasons: reasons.length ? reasons : ["Recently Added is the safest draft placement."]
  };
}

function generateSEO(draft: AiImportDraft) {
  const year = draft.releaseYear ? ` (${draft.releaseYear})` : "";
  const platform = draft.platform?.name ? ` on ${draft.platform.name}` : "";
  const genre = draft.genres?.[0] ? `${draft.genres[0]} ` : "";
  const description = draft.description || draft.shortDescription || "";
  return {
    seoTitle: `Watch ${draft.title}${year} - Cast, Trailer & Official Link`,
    seoDescription: compactText(`${draft.title}${year} is a ${genre}title${platform}. ${description} Find official trailer, cast, and legal watch links on WatchFinder.`, 155),
    tags: Array.from(new Set([
      draft.title,
      draft.releaseYear ? String(draft.releaseYear) : "",
      ...(draft.genres || []),
      draft.platform?.name || "",
      ...(draft.cast || []).slice(0, 5).map((person) => person.name),
      draft.language || "",
      draft.director || ""
    ].filter(Boolean).map(String)))
  };
}

function assistantNotes(draft: AiImportDraft) {
  const notes: string[] = [];
  if (!draft.posterUrl) notes.push("Poster missing. Upload manually or try Fix Missing Data.");
  if (draft.bannerUrl) notes.push("Banner available. Consider Hero Slider only after review.");
  if ([...(draft.tags || []), ...(draft.keywords || []), draft.language || ""].join(" ").toLowerCase().includes("hindi dubbed")) {
    notes.push("This looks Hindi Dubbed. Confirm Hindi Dubbed language if correct.");
  }
  if (draft.platform?.name) notes.push(`Official link detected as ${draft.platform.name}.`);
  if (draft.accessType) {
    const access = accessTypeMeta(draft.accessType);
    notes.push(`${access.label} access: ${access.detail}${draft.accessTypeReason ? ` (${draft.accessTypeReason})` : ""}.`);
  }
  if (draft.languageDetectionWarning) notes.push(draft.languageDetectionWarning);
  if (draft.qualityScore) notes.push(`Quality score is ${draft.qualityScore.score}%. ${draft.qualityScore.score >= 80 ? "Looks safe to review for publishing." : "Keep as draft until missing items are fixed."}`);
  return notes.slice(0, 5);
}

function enrichDraft(draft: AiImportDraft) {
  const seo = generateSEO(draft);
  const nextDraft: AiImportDraft = {
    ...draft,
    seoTitle: draft.seoTitle || seo.seoTitle,
    seoDescription: draft.seoDescription || seo.seoDescription,
    tags: Array.from(new Set([...(draft.tags || []), ...seo.tags])),
    officialLinkValidation: validateOfficialLink(draft.officialWatchUrl, draft.platform),
    suggestedPlacement: suggestCategoryPlacement(draft)
  };
  nextDraft.missingFields = missingFields(nextDraft);
  nextDraft.qualityWarnings = validateFetchedData(nextDraft);
  nextDraft.qualityScore = calculateQualityScore(nextDraft);
  nextDraft.assistantNotes = assistantNotes(nextDraft);
  return nextDraft;
}

async function duplicateWarnings(draft: Pick<AiImportDraft, "title" | "releaseYear" | "contentType" | "tmdbId" | "imdbId" | "officialWatchUrl">) {
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

  if (draft.officialWatchUrl) {
    const rowOfficialUrlMatch = await supabase
      .from("movies")
      .select("title, slug, status, watch_url, official_watch_url")
      .or(`watch_url.eq.${draft.officialWatchUrl},official_watch_url.eq.${draft.officialWatchUrl}`)
      .limit(1);
    if (!rowOfficialUrlMatch.error && rowOfficialUrlMatch.data?.length) {
      warnings.push(`Same official watch URL already exists: ${rowOfficialUrlMatch.data[0].title} (${rowOfficialUrlMatch.data[0].slug})`);
    }

    const linkOfficialUrlMatch = await supabase
      .from("movies")
      .select("title, slug, status, watch_url")
      .eq("watch_url", draft.officialWatchUrl)
      .limit(1);
    if (!linkOfficialUrlMatch.error && linkOfficialUrlMatch.data?.length) {
      warnings.push(`Same official watch URL already exists: ${linkOfficialUrlMatch.data[0].title} (${linkOfficialUrlMatch.data[0].slug})`);
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

  const slug = slugify(title);
  if (slug) {
    const slugMatch = await supabase
      .from("movies")
      .select("title, slug, status")
      .eq("slug", slug)
      .limit(1);
    if (!slugMatch.error && slugMatch.data?.length) {
      warnings.push(`Same slug already exists: ${slugMatch.data[0].title} (${slugMatch.data[0].slug})`);
    }
  }

  if (draft.contentType === "web_series") {
    const seriesMatch = await supabase
      .from("movies")
      .select("title, slug, status, release_year")
      .eq("content_type", "web_series")
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

function autoSelectBestMatch(results: AiImportCandidate[], detectedTitle: string, year?: number | null) {
  const yearAdjusted = year
    ? results.map((candidate) => ({
        ...candidate,
        confidence: (candidate.confidence || 0) + (candidate.releaseYear === year ? 5 : 0)
      }))
    : results;
  const [best, second] = yearAdjusted;
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

async function fetchMovieCredits(tmdbId: number) {
  return tmdbFetch<any>(`/movie/${tmdbId}/credits`, {});
}

async function fetchTvCredits(tmdbId: number) {
  return tmdbFetch<any>(`/tv/${tmdbId}/credits`, {});
}

async function fetchFullMovieDetails(tmdbId: number) {
  return tmdbFetch<any>(`/movie/${tmdbId}`, {
    append_to_response: "credits,videos,images,external_ids,release_dates,alternative_titles"
  });
}

async function fetchFullTvDetails(tmdbId: number) {
  return tmdbFetch<any>(`/tv/${tmdbId}`, {
    append_to_response: "credits,videos,images,external_ids,content_ratings,alternative_titles"
  });
}

function baseDraft(
  item: any,
  mediaType: "movie" | "tv",
  sourceInput: string,
  context: ImportContext = {}
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
  const platformAccess = detectAccessTypeFromText("", platform);
  const accessType = normalizeAccessType(context.accessType || platformAccess.accessType);
  const pageDescription = context.pageMetadata?.descriptionCandidates?.[0] || null;
  const pageImage = context.pageMetadata?.imageCandidates?.[0] || null;
  const languageState = languageStateFromSources({
    originalLanguage: item.original_language,
    platformLanguages: context.availableLanguages,
    platform
  });
  const posterUrl = imageUrl(item.poster_path, "w500") || pageImage;
  const bannerUrl = imageUrl(item.backdrop_path, "w1280") || context.pageMetadata?.imageCandidates?.[1] || pageImage;
  const thumbnailUrl = imageUrl(item.poster_path, "w342") || imageUrl(item.backdrop_path, "w780") || pageImage;
  const images = [
    ...tmdbImages(item),
    ...((context.pageMetadata?.imageCandidates || []).map((url, index) => ({
      kind: index === 0 ? "poster" as const : "thumbnail" as const,
      label: index === 0 ? "Platform image" : "Platform thumbnail",
      url
    })))
  ];

  return {
    source: "tmdb",
    sourceLabel: "TMDb",
    input: sourceInput,
    extractedTitle: context.extractedTitle || null,
    officialWatchUrl: context.officialWatchUrl || null,
    platform,
    linkType: context.officialWatchUrl ? "direct_title_page" : "platform_search",
    openMode: context.officialWatchUrl ? "external" : "auto",
    accessType,
    accessTypeReason: context.accessTypeReason || platformAccess.reason,
    contentType,
    title,
    originalTitle,
    alternativeTitles: [],
    slug: slugify(title),
    tagline: item.tagline || null,
    shortDescription: compactText(item.overview || pageDescription, 150),
    description: item.overview || pageDescription,
    storyOverview: item.overview || pageDescription,
    releaseDate,
    releaseYear,
    lastAirDate: item.last_air_date || null,
    seasonCount: mediaType === "tv" ? item.number_of_seasons ?? null : null,
    episodeCount: mediaType === "tv" ? item.number_of_episodes ?? null : null,
    runtimeMinutes: mediaType === "movie" ? item.runtime ?? null : item.episode_run_time?.[0] ?? null,
    status: item.status || null,
    genres,
    subGenres: genres.slice(0, 3),
    language: languageState.language,
    originalLanguage: languageState.originalLanguage,
    availableLanguages: languageState.availableLanguages,
    languageDetectionWarning: languageState.warning,
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
    posterUrl,
    bannerUrl,
    thumbnailUrl,
    logoUrl: null,
    images,
    trailerUrl: trailer.url,
    trailerName: trailer.name,
    seoTitle: `${title} (${releaseYear || "Watch"}) - Trailer, Cast & Legal Watch Guide`,
    seoDescription: seoDescription(title, item.overview),
    keywords: [title, originalTitle, ...genres, ...languageState.availableLanguages, releaseYear].filter(Boolean).map(String),
    tags: [contentType, ...genres, ...languageState.availableLanguages, releaseYear ? String(releaseYear) : ""].filter(Boolean),
    seasons: [],
    duplicateWarnings: [],
    qualityWarnings: [],
    missingFields: []
  };
}

async function importMovie(id: number, input: string, context: ImportContext = {}) {
  const item = await fetchFullMovieDetails(id);
  const draft = baseDraft(item, "movie", input, context);
  if (!draft.trailerUrl) {
    const trailer = await fetchYouTubeTrailerByTitle(draft.title, draft.releaseYear);
    draft.trailerUrl = trailer.url;
    draft.trailerName = trailer.name;
  }
  draft.alternativeTitles = (item.alternative_titles?.titles ?? []).slice(0, 12).map((entry: any) => entry.title).filter(Boolean);
  draft.duplicateWarnings = await duplicateWarnings(draft);
  return enrichDraft(draft);
}

async function importSeries(
  id: number,
  input: string,
  includeSeasons = true,
  context: ImportContext = {}
) {
  const item = await fetchFullTvDetails(id);
  const draft = baseDraft(item, "tv", input, context);
  if (!draft.trailerUrl) {
    const trailer = await fetchYouTubeTrailerByTitle(draft.title, draft.releaseYear);
    draft.trailerUrl = trailer.url;
    draft.trailerName = trailer.name;
  }
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
  return enrichDraft(draft);
}

async function fetchTrailer(id: number, type: "movie" | "tv") {
  const videos = await tmdbFetch<any>(`/${type}/${id}/videos`, {});
  return youtubeTrailer(videos);
}

function extractYearFromText(value?: string | null) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function requestedContentTypeOrMedia(
  requestedContentType: ImportRequest["requestedContentType"],
  mediaType: "auto" | "movie" | "tv"
) {
  if (requestedContentType) return requestedContentType;
  if (mediaType === "tv") return "web_series";
  return "movie";
}

async function importPlatformMetadataFallback({
  input,
  extractedTitle,
  officialWatchUrl,
  platform,
  metadata,
  mediaType,
  requestedContentType
}: {
  input: string;
  extractedTitle: string;
  officialWatchUrl: string | null;
  platform: AiImportPlatform | null;
  metadata?: PageMetadata | null;
  mediaType: "auto" | "movie" | "tv";
  requestedContentType?: ImportRequest["requestedContentType"];
}) {
  const title = cleanTitle(extractedTitle, platform);
  if (!officialWatchUrl || !platform || !title || isLikelyJunkTitle(title)) return null;

  const description = metadata?.descriptionCandidates?.[0] || null;
  const releaseYear = extractYearFromText(`${title} ${description || ""}`);
  const languageState = languageStateFromSources({
    originalLanguage: null,
    platformLanguages: metadata?.availableLanguages || [],
    platform
  });
  const images = (metadata?.imageCandidates || []).map((url, index) => ({
    kind: index === 0 ? "poster" as const : index === 1 ? "banner" as const : "thumbnail" as const,
    label: index === 0 ? "Platform poster" : index === 1 ? "Platform banner" : "Platform image",
    url
  }));
  const accessDetection = detectAccessTypeFromText(description || "", platform);
  const contentType = requestedContentTypeOrMedia(requestedContentType, mediaType);
  const draft: AiImportDraft = {
    source: "fallback",
    sourceLabel: metadata?.fetchedFrom ? "Platform metadata" : "Official URL metadata",
    input,
    extractedTitle: title,
    officialWatchUrl,
    platform,
    linkType: "direct_title_page",
    openMode: "external",
    accessType: normalizeAccessType(metadata?.accessType || accessDetection.accessType),
    accessTypeReason: metadata?.accessTypeReason || accessDetection.reason,
    contentType,
    title,
    originalTitle: title,
    alternativeTitles: [],
    slug: slugify(title),
    tagline: null,
    shortDescription: compactText(description, 150),
    description,
    storyOverview: description,
    releaseDate: null,
    releaseYear,
    lastAirDate: null,
    seasonCount: null,
    episodeCount: null,
    runtimeMinutes: null,
    status: "Draft",
    genres: [],
    subGenres: [],
    language: languageState.language,
    originalLanguage: languageState.originalLanguage,
    availableLanguages: languageState.availableLanguages,
    languageDetectionWarning: languageState.warning || "TMDb match not found. Review platform metadata before publishing.",
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
    imdbId: null,
    posterUrl: metadata?.imageCandidates?.[0] || null,
    bannerUrl: metadata?.imageCandidates?.[1] || metadata?.imageCandidates?.[0] || null,
    thumbnailUrl: metadata?.imageCandidates?.[0] || null,
    logoUrl: null,
    images,
    trailerUrl: null,
    trailerName: null,
    seoTitle: `${title}${releaseYear ? ` (${releaseYear})` : ""} - Official Watch Link`,
    seoDescription: seoDescription(title, description),
    keywords: [title, platform.name, releaseYear, ...(languageState.availableLanguages || [])].filter(Boolean).map(String),
    tags: [contentType, platform.name, releaseYear ? String(releaseYear) : "", ...(languageState.availableLanguages || [])].filter(Boolean),
    seasons: [],
    duplicateWarnings: [],
    qualityWarnings: [],
    missingFields: []
  };
  draft.duplicateWarnings = await duplicateWarnings(draft);
  return enrichDraft(draft);
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

function mapTMDbToAdminForm(draft: AiImportDraft, officialUrl?: string | null, platform?: AiImportPlatform | null) {
  return mapToAdminForm(draft, officialUrl, platform);
}

async function fetchFullTMDbDetails(
  id: number,
  type: "movie" | "tv",
  input: string,
  includeSeasons: boolean,
  context: ImportContext = {}
) {
  const draft = type === "tv" ? await importSeries(id, input, includeSeasons, context) : await importMovie(id, input, context);
  return mapTMDbToAdminForm(draft, context.officialWatchUrl, context.platform);
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
  const metadata = body.officialWatchUrl && isHttpUrl(body.officialWatchUrl)
    ? await fetchPageMetadata(body.officialWatchUrl)
    : null;
  const metadataLanguages = body.availableLanguages?.length
    ? body.availableLanguages
    : metadata?.availableLanguages || [];
  const context = {
    extractedTitle: body.extractedTitle || null,
    officialWatchUrl: body.officialWatchUrl || null,
    platform: body.platform || detectPlatformFromUrl(body.officialWatchUrl),
    availableLanguages: metadataLanguages,
    accessType: body.accessType || metadata?.accessType,
    accessTypeReason: body.accessTypeReason || metadata?.accessTypeReason || null,
    pageMetadata: metadata
  };
  const draft = await fetchFullTMDbDetails(
    id,
    mediaType,
    body.input || context.extractedTitle || String(id),
    body.includeSeasons !== false,
    context
  );
  return applyRequestedContentType(draft, body.requestedContentType);
}

async function detectTitleCandidates(input: string, platform: AiImportPlatform | null) {
  const metadata = await fetchPageMetadata(input);
  const slugTitle = extractTitleFromUrl(input);
  const canonicalTitle = metadata.canonicalUrl ? extractTitleFromUrl(metadata.canonicalUrl) : "";
  const titles = uniqueTitles([
    cleanTitle(slugTitle, platform),
    cleanTitle(canonicalTitle, platform),
    ...metadata.titleCandidates.map((title) => cleanTitle(title, platform))
  ]).filter((title) => !isLikelyJunkTitle(title));
  return { titles, metadata };
}

async function searchFromInput(
  input: string,
  mode: AiImportMode,
  mediaType: "auto" | "movie" | "tv",
  includeSeasons: boolean,
  requestedContentType?: ImportRequest["requestedContentType"],
  explicitOfficialWatchUrl?: string | null
) {
  ensureTmdbConfigured();
  if (mode === "url" && !isHttpUrl(input)) {
    throw new Error("Invalid URL. Paste an official https URL, or type the movie/show name directly.");
  }
  const officialWatchUrl = explicitOfficialWatchUrl && isHttpUrl(explicitOfficialWatchUrl)
    ? explicitOfficialWatchUrl
    : isHttpUrl(input) ? input : null;
  const platform = detectPlatformFromUrl(officialWatchUrl || input);
  if (officialWatchUrl && !platform) {
    throw new Error("Platform currently not supported.");
  }
  const inferredType = detectContentTypeFromUrl(officialWatchUrl || input);
  const requestedMediaType = mediaTypeFromRequested(requestedContentType, mediaType);
  const effectiveMediaType = requestedMediaType === "auto" && inferredType ? inferredType : requestedMediaType;
  const detected = isHttpUrl(input)
    ? await detectTitleCandidates(input, platform)
    : officialWatchUrl
      ? { titles: [cleanTitle(input, platform)], metadata: await fetchPageMetadata(officialWatchUrl) }
      : null;
  const titleCandidates = detected ? detected.titles : [cleanTitle(input, platform)];
  const extractedTitle = titleCandidates[0] || "";
  if (!extractedTitle) {
    throw new Error("Could not detect metadata from this link. Try another official link or check TMDb API key.");
  }

  let candidates: AiImportCandidate[] = [];
  for (const title of titleCandidates) {
    candidates = await searchTMDbByTitle(title, effectiveMediaType);
    if (candidates.length) break;
  }
  if (!candidates.length) {
    const fallbackDraft = await importPlatformMetadataFallback({
      input,
      extractedTitle,
      officialWatchUrl,
      platform,
      metadata: detected?.metadata || null,
      mediaType: effectiveMediaType,
      requestedContentType
    });
    if (fallbackDraft) {
      return {
        ok: true,
        draft: fallbackDraft,
        extractedTitle,
        platform,
        warnings: [`No TMDb result found for "${extractedTitle}". Filled only verified official-platform metadata for review.`]
      };
    }
    throw new Error(`No TMDb result found for "${extractedTitle}". AI Auto Fill did not create a fallback draft.`);
  }
  const ranked = rankCandidatesForTitle(candidates, extractedTitle, effectiveMediaType);
  const best = officialWatchUrl ? autoSelectBestMatch(ranked, extractedTitle) : null;
  if (best) {
    const draft = await fetchFullTMDbDetails(best.tmdbId, best.mediaType, input, includeSeasons, {
      extractedTitle,
      officialWatchUrl,
      platform,
      availableLanguages: detected?.metadata.availableLanguages || [],
      accessType: detected?.metadata.accessType,
      accessTypeReason: detected?.metadata.accessTypeReason || null,
      pageMetadata: detected?.metadata || null
    });
    return { ok: true, draft: applyRequestedContentType(draft, requestedContentType), extractedTitle, platform };
  }

  return {
    ok: true,
    needsSelection: true,
    candidates: ranked.slice(0, 3),
    extractedTitle,
    platform,
    availableLanguages: detected?.metadata.availableLanguages || [],
    warnings: officialWatchUrl && !platform ? ["Official URL kept, but platform was not recognized. Review platform before publishing."] : []
  };
}

async function importBestCandidate(
  input: string,
  mediaType: "auto" | "movie" | "tv",
  includeSeasons: boolean,
  requestedContentType?: ImportRequest["requestedContentType"],
  explicitOfficialWatchUrl?: string | null
) {
  const officialWatchUrl = explicitOfficialWatchUrl && isHttpUrl(explicitOfficialWatchUrl)
    ? explicitOfficialWatchUrl
    : isHttpUrl(input) ? input : null;
  const platform = detectPlatformFromUrl(officialWatchUrl || input);
  if (officialWatchUrl && !platform) {
    throw new Error("Platform currently not supported.");
  }
  const inferredType = detectContentTypeFromUrl(officialWatchUrl || input);
  const requestedMediaType = mediaTypeFromRequested(requestedContentType, mediaType);
  const effectiveMediaType = requestedMediaType === "auto" && inferredType ? inferredType : requestedMediaType;
  const detected = isHttpUrl(input)
    ? await detectTitleCandidates(input, platform)
    : officialWatchUrl
      ? { titles: [cleanTitle(input, platform)], metadata: await fetchPageMetadata(officialWatchUrl) }
      : null;
  const titleCandidates = detected ? detected.titles : [cleanTitle(input, platform)];
  const extractedTitle = titleCandidates[0] || "";
  if (!extractedTitle) throw new Error("Could not detect metadata from this link. Try another official link or check TMDb API key.");
  let candidates: AiImportCandidate[] = [];
  for (const title of titleCandidates) {
    candidates = await searchTMDbByTitle(title, effectiveMediaType);
    if (candidates.length) break;
  }
  candidates = rankCandidatesForTitle(candidates, extractedTitle, effectiveMediaType);
  const first = candidates[0];
  if (!first) {
    const fallbackDraft = await importPlatformMetadataFallback({
      input,
      extractedTitle,
      officialWatchUrl,
      platform,
      metadata: detected?.metadata || null,
      mediaType: effectiveMediaType,
      requestedContentType
    });
    if (fallbackDraft) return fallbackDraft;
    throw new Error(`No TMDb result found for "${extractedTitle}". AI Auto Fill did not create a fallback draft.`);
  }
  const context = {
    extractedTitle,
    officialWatchUrl,
    platform,
    availableLanguages: detected?.metadata.availableLanguages || [],
    accessType: detected?.metadata.accessType,
    accessTypeReason: detected?.metadata.accessTypeReason || null,
    pageMetadata: detected?.metadata || null
  };
  const draft = await fetchFullTMDbDetails(first.tmdbId, first.mediaType, input, includeSeasons, context);
  return applyRequestedContentType(draft, requestedContentType);
}

async function importDirect(
  input: string,
  mode: AiImportMode,
  mediaType: "auto" | "movie" | "tv",
  includeSeasons: boolean,
  requestedContentType?: ImportRequest["requestedContentType"],
  explicitOfficialWatchUrl?: string | null
) {
  ensureTmdbConfigured();
  const imdbId = parseImdbId(input);
  if (mode === "imdb" || imdbId) return applyRequestedContentType(await findByImdb(imdbId || input, input), requestedContentType);

  const parsedTmdb = parseTmdbFromUrl(input) || parsePlainTmdbId(input, mediaType);
  if (mode === "tmdb" || parsedTmdb) {
    const target = parsedTmdb || { mediaType: mediaType === "tv" ? "tv" : "movie", id: Number(input) };
    if (!Number.isFinite(target.id)) throw new Error("Enter a valid TMDb movie/TV ID or URL.");
    const draft = target.mediaType === "tv" ? await importSeries(target.id, input, includeSeasons) : await importMovie(target.id, input);
    return applyRequestedContentType(draft, requestedContentType);
  }

  return importBestCandidate(input, mediaType, includeSeasons, requestedContentType, explicitOfficialWatchUrl);
}

function mergeMissingDraftFields(current: AiImportDraft, fresh: AiImportDraft) {
  const fixedFields: string[] = [];
  const merged: AiImportDraft = { ...current };
  const fill = <K extends keyof AiImportDraft>(field: K, label: string) => {
    const currentValue = merged[field];
    const freshValue = fresh[field];
    const currentMissing = Array.isArray(currentValue)
      ? currentValue.length === 0
      : currentValue == null || currentValue === "";
    const freshAvailable = Array.isArray(freshValue)
      ? freshValue.length > 0
      : freshValue != null && freshValue !== "";
    if (currentMissing && freshAvailable) {
      (merged as any)[field] = freshValue;
      fixedFields.push(label);
    }
  };

  fill("posterUrl", "Poster");
  fill("bannerUrl", "Banner");
  fill("trailerUrl", "Trailer");
  fill("description", "Description");
  fill("shortDescription", "Short description");
  fill("genres", "Genres");
  fill("subGenres", "Sub genres");
  fill("language", "Language");
  fill("availableLanguages", "Available audio languages");
  fill("languageDetectionWarning", "Language detection note");
  fill("cast", "Cast");
  fill("director", "Director");
  fill("runtimeMinutes", "Runtime");
  fill("releaseYear", "Release year");
  fill("seoTitle", "SEO title");
  fill("seoDescription", "SEO description");
  fill("officialWatchUrl", "Official watch link");
  fill("platform", "Platform");
  fill("accessType", "Access type");
  fill("accessTypeReason", "Access type note");
  fill("images", "Images");
  fill("seasons", "Seasons and episodes");

  merged.tags = Array.from(new Set([...(current.tags || []), ...(fresh.tags || [])]));
  merged.keywords = Array.from(new Set([...(current.keywords || []), ...(fresh.keywords || [])]));
  merged.duplicateWarnings = Array.from(new Set([...(current.duplicateWarnings || []), ...(fresh.duplicateWarnings || [])]));
  return { draft: enrichDraft(merged), fixedFields };
}

async function fixMissingFields(body: ImportRequest) {
  const current = body.draft;
  if (!current) throw new Error("No AI draft found. Generate details first.");
  const input = String(body.input || current.input || current.title || "").trim();
  if (!input) throw new Error("No source available to fix missing data.");
  const fresh = await importBestCandidate(
    input,
    body.mediaType || (current.contentType === "web_series" || current.contentType === "tv_show" ? "tv" : "auto"),
    body.includeSeasons !== false,
    body.requestedContentType,
    body.officialWatchUrl || current.officialWatchUrl || null
  );
  const merged = mergeMissingDraftFields(current, fresh);
  return {
    ...merged,
    stillMissing: merged.draft.missingFields
  };
}

export async function POST(request: Request) {
  const { isAdmin } = await requireAdminProfile();
  if (!isAdmin) return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });

  try {
    const body = (await request.json()) as ImportRequest;
    const action = body.action || "search";
    const mode = body.mode || "auto";
    const titleInput = String(body.title || "").trim();
    const watchUrlInput = String(body.officialWatchUrl || "").trim();
    const rawInput = String(body.input || "").trim();
    const input = titleInput || rawInput || watchUrlInput;
    const explicitOfficialWatchUrl = watchUrlInput && isHttpUrl(watchUrlInput) ? watchUrlInput : null;
    const mediaType = body.mediaType || "auto";
    const requestedContentType = body.requestedContentType;
    const includeSeasons = body.includeSeasons !== false;

    if (action === "details") {
      const draft = await detailsFromSelection(body);
      return NextResponse.json({ ok: true, draft });
    }

    if (action === "fix_missing") {
      const result = await fixMissingFields(body);
      return NextResponse.json({
        ok: true,
        draft: result.draft,
        fixedFields: result.fixedFields,
        stillMissing: result.stillMissing
      });
    }

    if (!input) throw new Error("Enter a URL, IMDb ID, TMDb ID, or title.");

    if (mode === "bulk") {
      const inputs = input.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, MAX_BULK_ITEMS);
      const results: AiImportResult[] = [];
      for (const item of inputs) {
        try {
          results.push({ input: item, ok: true, draft: await importDirect(item, "auto", mediaType, includeSeasons, requestedContentType, explicitOfficialWatchUrl) });
        } catch (error) {
          results.push({ input: item, ok: false, error: error instanceof Error ? error.message : "Import failed." });
        }
      }
      return NextResponse.json({ ok: true, results, warnings: inputs.length === MAX_BULK_ITEMS ? ["Bulk import was capped at 50 items."] : [] });
    }

    if (mode === "imdb" || mode === "tmdb" || parseImdbId(input) || parseTmdbFromUrl(input) || parsePlainTmdbId(input, mediaType)) {
      const draft = await importDirect(input, mode, mediaType, includeSeasons, requestedContentType, explicitOfficialWatchUrl);
      return NextResponse.json({ ok: true, draft });
    }

    return NextResponse.json(await searchFromInput(input, mode, mediaType, includeSeasons, requestedContentType, explicitOfficialWatchUrl));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "AI import failed."
    }, { status: 400 });
  }
}
