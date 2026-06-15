"use client";

import Link from "next/link";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from "react";
import { Eye, Save } from "lucide-react";
import { ACCESS_TYPE_OPTIONS, accessTypeMeta, normalizeAccessType, type AccessType } from "@/lib/access-type";
import { getMovieSaveVisibilityMessage, getMovieVisibilityCheck } from "@/lib/admin-visibility";
import { formatType, slugify } from "@/lib/format";
import { actualAudioLanguages, joinLanguages, normalizeLanguageLabel, primaryLanguageForSelection, WATCHFINDER_LANGUAGES, withLanguageDisplayLabels } from "@/lib/languages";
import { isOptionalMovieRelationError, movieSelect, movieSelectWithoutChannels } from "@/lib/movie-select";
import {
  findUnlistedMoviePayloadColumns,
  formatMovieSchemaMismatchError,
  missingMovieColumnFromError,
  MOVIE_REQUIRED_COLUMNS,
  normalizePopularityScore,
  sanitizeMovieBasePayload,
  sanitizeMovieMetadataPayload
} from "@/lib/movie-schema";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadBanner, uploadLicenseDocumentWithPath, uploadPoster } from "@/lib/storage";
import { WATCH_LINK_TYPES, watchLinkTypeLabels, normalizeWatchLinkType, isExternalOnlyPlatform } from "@/lib/watch-links";
import type { AiImportDraft } from "@/lib/ai-import-types";
import type { CastMember, ContentChannel, Genre, Movie, Platform } from "@/types/watchfinder";

type Message = {
  type: "success" | "error" | "info" | "warning";
  text: string;
};

type DuplicateAdvisory = {
  movieId: string;
  title: string;
  slug: string;
  status?: string | null;
  createdAt?: string | null;
  reason: "slug" | "exact" | "potential";
};

const QUALITY_OPTIONS = [
  "360p",
  "480p",
  "720p HD",
  "1080p Full HD",
  "1440p 2K",
  "2160p 4K",
  "HDR",
  "Dolby Vision"
];

const AVAILABILITY_OPTIONS = [
  { label: "Subscription", value: "subscription" },
  { label: "Rent", value: "rent" },
  { label: "Buy", value: "buy" },
  { label: "Free", value: "free" },
  { label: "Official", value: "official" },
  { label: "Unknown", value: "unknown" }
];

function availabilityFromAccessType(value?: string | null) {
  const accessType = normalizeAccessType(value);
  if (accessType === "free") return "free";
  if (accessType === "subscription") return "subscription";
  if (accessType === "rent_buy") return "rent";
  return "unknown";
}

const OPEN_MODE_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "In-app browser", value: "in_app_browser" },
  { label: "External official site", value: "external" },
  { label: "YouTube player", value: "trailer_modal" }
];

const HOMEPAGE_SECTION_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Hero Slider", value: "hero" },
  { label: "Trending Now", value: "trending" },
  { label: "Recently Added", value: "recently_added" },
  { label: "New OTT Releases", value: "ott_release" },
  { label: "Hindi Dubbed", value: "hindi_dubbed" },
  { label: "Free Legal Movies", value: "free_legal" },
  { label: "Official YouTube", value: "official_youtube" },
  { label: "Web Series", value: "web_series" },
  { label: "Cartoons", value: "cartoon" },
  { label: "TV Shows", value: "tv_show" },
  { label: "Platform Only", value: "platform_only" }
];

const PLAYBACK_SUPPORT_OPTIONS = [
  { label: "Not sure", value: "unknown" },
  { label: "Works on mobile web", value: "yes" },
  { label: "App required", value: "no" }
];

const VIDEO_PROVIDER_OPTIONS = [
  { label: "Direct Video URL", value: "direct" },
  { label: "YouTube", value: "youtube" },
  { label: "Vimeo", value: "vimeo" },
  { label: "Embed", value: "embed" },
  { label: "Iframe", value: "iframe" },
  { label: "HLS", value: "hls" },
  { label: "M3U8", value: "m3u8" },
  { label: "Google Drive", value: "google_drive" },
  { label: "Other", value: "other" }
];

function normalizeVideoProvider(value?: string | null) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "direct";
  if (provider === "youtube_embed") return "youtube";
  if (provider === "external_legal_embed") return "embed";
  if (provider === "google drive" || provider === "googledrive") return "google_drive";
  if (provider === "external_ott_link" || provider === "cloudflare_stream" || provider === "supabase_storage_small_video") return "direct";
  if (VIDEO_PROVIDER_OPTIONS.some((option) => option.value === provider)) return provider;
  return "direct";
}

function normalizePlaybackSupport(value?: string | null) {
  const support = String(value || "").trim().toLowerCase();
  return support === "yes" || support === "no" ? support : "unknown";
}

function databaseMovieTypeForContentType(value?: string | null) {
  const type = String(value || "movie").trim() || "movie";
  return type === "web_series" ? "tv_show" : type;
}

function platformText(platform?: Platform | null) {
  return `${platform?.name || ""} ${platform?.slug || ""}`.toLowerCase();
}

function isYouTubePlatform(platform?: Platform | null) {
  return platformText(platform).includes("youtube");
}

function platformOptionScore(platform: Platform) {
  const text = platformText(platform);
  const preferred = ["youtube", "jiohotstar", "hotstar", "netflix", "prime", "zee5", "sonyliv", "aha", "apple"];
  const index = preferred.findIndex((token) => text.includes(token));
  return index === -1 ? 99 : index;
}

function mobilePlaybackValue(link?: { app_required?: boolean | null; mobile_web_supported?: string | null } | null) {
  return link?.app_required ? "no" : normalizePlaybackSupport(link?.mobile_web_supported);
}

function hasSavedPlayableOrWatchLink(movie?: Movie | null) {
  if (!movie) return false;

  const hasMovieRowLink = Boolean(
    movie.trailer_url?.trim() ||
      movie.video_embed_url?.trim() ||
      movie.video_url?.trim() ||
      movie.watch_url?.trim() ||
      movie.platform_home_url?.trim() ||
      movie.platform_search_url?.trim() ||
      movie.app_deeplink?.trim()
  );
  if (hasMovieRowLink) return true;

  return Boolean(
    movie.movie_platform_links?.some((link) =>
      link.is_active !== false &&
        link.is_official !== false &&
        Boolean(link.watch_url?.trim() || link.platform_home_url?.trim() || link.platform_search_url?.trim() || link.app_deeplink?.trim())
    )
  );
}

function toNullableString(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function toNullableNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && String(value || "").trim() ? numberValue : null;
}

function toJsonSafeValue<T>(value: T): T | null {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

function splitStoredValues(value?: string | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeConfirmedMovie(row: any): Movie {
  return {
    ...row,
    genres: (row.movie_genres ?? []).map((item: any) => item.genres).filter(Boolean),
    cast_members: (row.movie_cast ?? []).map((item: any) => item.cast_members).filter(Boolean),
    movie_platform_links: row.movie_platform_links ?? [],
    content_channel_items: row.content_channel_items ?? [],
    content_channels: (row.content_channel_items ?? []).map((item: any) => item.content_channels).filter(Boolean)
  } as Movie;
}

async function fetchConfirmedMovie(supabase: any, movieId: string) {
  const primary = await supabase
    .from("movies")
    .select(movieSelect)
    .eq("id", movieId)
    .maybeSingle();

  if (!primary.error) return primary.data;
  if (!isOptionalMovieRelationError(primary.error)) throw primary.error;

  const fallback = await supabase
    .from("movies")
    .select(movieSelectWithoutChannels)
    .eq("id", movieId)
    .maybeSingle();

  if (!fallback.error) return fallback.data;
  if (!isOptionalMovieRelationError(fallback.error)) throw fallback.error;

  const plain = await supabase
    .from("movies")
    .select("*")
    .eq("id", movieId)
    .maybeSingle();

  if (plain.error) throw plain.error;
  return plain.data;
}

function getSaveDebugText(movie: Movie) {
  const check = getMovieVisibilityCheck(movie);
  return [
    `Confirmed from Supabase.`,
    `ID: ${movie.id}.`,
    `Slug: ${movie.slug}.`,
    `Status: ${movie.status || "draft"}.`,
    `Public: ${check.visibleOnPublicPages ? "yes" : `no (${check.publicReasons.join(", ")})`}.`,
    `Homepage: ${check.visibleOnHomepageSlider ? "yes" : `no (${check.homepageReasons.join(", ")})`}.`,
    check.warnings.length ? `Warnings: ${check.warnings.join(", ")}.` : ""
  ].filter(Boolean).join(" ");
}

function formatSupabaseError(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Movie save failed.";
  if (!error || typeof error !== "object") return fallback;

  const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return [
    details.message ? String(details.message) : fallback,
    details.code ? `Code: ${String(details.code)}` : "",
    details.details ? `Details: ${String(details.details)}` : "",
    details.hint ? `Hint: ${String(details.hint)}` : ""
  ].filter(Boolean).join(" ");
}

function formatSaveError(error: unknown) {
  const message = formatSupabaseError(error);
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("migration hint:")) return message;
  const schemaMismatchMessage = formatMovieSchemaMismatchError(error);
  if (schemaMismatchMessage) {
    const missingColumn = missingMovieColumnFromError(error);
    console.warn("WatchFinder movie schema mismatch", {
      missingColumn,
      requiredColumns: MOVIE_REQUIRED_COLUMNS
    });
    return schemaMismatchMessage;
  }
  if (
    code === "PGRST204" ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column") ||
    normalized.includes("relationship")
  ) {
    return `${message} Migration hint: run supabase/migrations/202606030002_fix_movies_admin_upload_schema.sql, then try saving again.`;
  }
  return message;
}

function saveStepError(step: string, error: unknown) {
  return new Error(`${step} failed: ${formatSaveError(error)}`);
}

function toDuplicateAdvisory(movie: any, reason: DuplicateAdvisory["reason"]): DuplicateAdvisory {
  return {
    movieId: movie.id,
    title: movie.title || "Untitled movie",
    slug: movie.slug || "",
    status: movie.status || "draft",
    createdAt: movie.created_at || null,
    reason
  };
}

function formatDuplicateDate(value?: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString();
}

function normalizeDuplicateValue(value: unknown) {
  return String(value ?? "").trim();
}

function sameTextValue(left: unknown, right: unknown) {
  return normalizeDuplicateValue(left).toLowerCase() === normalizeDuplicateValue(right).toLowerCase();
}

function sameExactValue(left: unknown, right: unknown) {
  return normalizeDuplicateValue(left) === normalizeDuplicateValue(right);
}

function sameNullableNumber(left: unknown, right: unknown) {
  const leftValue = left === null || left === undefined || left === "" ? null : Number(left);
  const rightValue = right === null || right === undefined || right === "" ? null : Number(right);
  return leftValue === rightValue;
}

async function findMovieBySlug(supabase: any, requestedSlug: string) {
  const normalizedSlug = slugify(requestedSlug);
  if (!normalizedSlug) return null;

  const { data, error } = await supabase
    .from("movies")
    .select("id, title, slug, status, created_at")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (error) throw saveStepError("Checking existing slug", error);
  return data ? toDuplicateAdvisory(data, "slug") : null;
}

async function saveMovieRowViaAdminApi({
  movieId,
  payload,
  metadataPayload,
  relatedData,
  allowDuplicate = false
}: {
  movieId?: string | null;
  payload: Record<string, unknown>;
  metadataPayload?: Record<string, unknown>;
  relatedData?: Record<string, unknown>;
  allowDuplicate?: boolean;
}) {
  const response = await fetch("/api/admin/movies/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      movieId: movieId || null,
      allowDuplicate,
      payload,
      metadataPayload: metadataPayload || {},
      relatedData: relatedData || undefined
    })
  });
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    success?: boolean;
    movie?: any;
    movieId?: string;
    skippedColumns?: string[];
    warnings?: string[];
    duplicate?: DuplicateAdvisory;
    error?: string;
  } | null;

  if (!response.ok || !result?.ok || !result.movie) {
    const error = new Error(result?.error || `Movie server save failed (${response.status}).`) as Error & { movieId?: string; movie?: any; duplicate?: DuplicateAdvisory };
    error.movieId = result?.movieId;
    error.movie = result?.movie;
    error.duplicate = result?.duplicate;
    throw error;
  }

  return {
    movie: result.movie as { id: string; slug: string },
    skippedColumns: result.skippedColumns || [],
    warnings: result.warnings || []
  };
}

async function findExactDuplicateMovie(
  supabase: any,
  payload: Record<string, unknown>,
  watchUrl: string | null,
  hasNewPoster: boolean,
  hasNewBanner: boolean
) {
  if (hasNewPoster || hasNewBanner) return null;

  const { data: candidates, error } = await supabase
    .from("movies")
    .select("id, slug, title, status, created_at, release_year, duration_minutes, language, video_provider, trailer_url, video_embed_url, poster_url, banner_url, description")
    .eq("title", payload.title)
    .limit(20);

  if (error) {
    if (process.env.NODE_ENV !== "production") console.warn("Exact duplicate advisory skipped:", error);
    return null;
  }

  const candidateIds = (candidates || []).map((movie: { id: string }) => movie.id);
  const linksByMovieId = new Map<string, string[]>();

  if (candidateIds.length) {
    const { data: links, error: linksError } = await supabase
      .from("movie_platform_links")
      .select("movie_id, watch_url")
      .in("movie_id", candidateIds);

    if (!linksError) {
      (links || []).forEach((link: { movie_id: string; watch_url?: string | null }) => {
        const current = linksByMovieId.get(link.movie_id) || [];
        if (link.watch_url) current.push(link.watch_url);
        linksByMovieId.set(link.movie_id, current);
      });
    } else if (process.env.NODE_ENV !== "production") {
      console.warn("Exact duplicate watch-link advisory skipped:", linksError);
    }
  }

  const duplicate = (candidates || []).find((movie: any) => {
    const candidateLinks = linksByMovieId.get(movie.id) || [];
    const watchLinkMatches = watchUrl
      ? candidateLinks.some((existingUrl) => sameExactValue(existingUrl, watchUrl))
      : candidateLinks.length === 0;

    return (
      sameTextValue(movie.title, payload.title) &&
      sameNullableNumber(movie.release_year, payload.release_year) &&
      sameNullableNumber(movie.duration_minutes, payload.duration_minutes) &&
      sameTextValue(movie.language, payload.language) &&
      sameTextValue(movie.video_provider, payload.video_provider) &&
      sameExactValue(movie.trailer_url, payload.trailer_url) &&
      sameExactValue(movie.video_embed_url, payload.video_embed_url) &&
      sameExactValue(movie.poster_url, null) &&
      sameExactValue(movie.banner_url, null) &&
      sameExactValue(movie.description, payload.description) &&
      watchLinkMatches
    );
  });

  return duplicate ? toDuplicateAdvisory(duplicate, "exact") : null;
}

async function findPotentialDuplicateMovie(
  supabase: any,
  payload: Record<string, unknown>,
  watchUrl: string | null,
  excludeMovieId?: string | null
) {
  const baseQuery = () => supabase.from("movies").select("id, title, slug, status, created_at").limit(1);
  const externalChecks = [
    payload.tmdb_id ? baseQuery().eq("tmdb_id", payload.tmdb_id) : null,
    payload.imdb_id ? baseQuery().eq("imdb_id", payload.imdb_id) : null,
    watchUrl ? baseQuery().eq("watch_url", watchUrl) : null,
    watchUrl ? baseQuery().eq("official_watch_url", watchUrl) : null
  ].filter(Boolean);

  for (const query of externalChecks) {
    const { data, error } = await query;
    if (!error && data?.[0] && data[0].id !== excludeMovieId) return toDuplicateAdvisory(data[0], "potential");
  }

  if (watchUrl) {
    const { data: links, error: linkError } = await supabase
      .from("movie_platform_links")
      .select("movie_id, movies(id, title, slug, status, created_at)")
      .eq("watch_url", watchUrl)
      .limit(1);
    const movie = Array.isArray(links?.[0]?.movies) ? links?.[0]?.movies?.[0] : links?.[0]?.movies;
    if (!linkError && movie && movie.id !== excludeMovieId) return toDuplicateAdvisory(movie, "potential");
  }

  if (payload.title && payload.release_year) {
    const { data, error } = await supabase
      .from("movies")
      .select("id, title, slug, status, created_at")
      .eq("title", payload.title)
      .eq("release_year", payload.release_year)
      .limit(1);
    if (!error && data?.[0] && data[0].id !== excludeMovieId) return toDuplicateAdvisory(data[0], "potential");
  }

  return null;
}

function FormSection({
  title,
  helper,
  children
}: {
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="admin-form-section">
      <legend>{title}</legend>
      <p className="form-helper">{helper}</p>
      {children}
    </fieldset>
  );
}

export default function AdminMovieForm({
  genres,
  castMembers,
  platforms,
  initialMovie = null,
  onAddNew,
  onBackToMovies,
  onSaved,
  onDuplicateSlug,
  onArchiveMovie,
  onDeleteMovie,
  movieAnalytics,
  contentChannels = [],
  contentChannelsError = null,
  initialContentType = "movie",
  aiDraft = null,
  aiDraftVersion = 0
}: {
  genres: Genre[];
  castMembers: CastMember[];
  platforms: Platform[];
  initialMovie?: Movie | null;
  initialContentType?: string;
  onAddNew?: () => void;
  onBackToMovies?: () => void;
  onSaved?: (movie: Movie) => void;
  onDuplicateSlug?: (movieId: string) => void;
  onArchiveMovie?: (movie: Movie) => void | Promise<void>;
  onDeleteMovie?: (movie: Movie) => void | Promise<void>;
  contentChannels?: ContentChannel[];
  contentChannelsError?: string | null;
  aiDraft?: AiImportDraft | null;
  aiDraftVersion?: number;
  movieAnalytics?: {
    views: number;
    todayViews: number;
    watchSeconds: number;
    trailerPlays: number;
    linkClicks: number;
    lastViewedAt?: string | null;
  };
}) {
  const isEditMode = Boolean(initialMovie?.id);
  const initialSelectedType = initialMovie?.content_type || initialMovie?.type || initialContentType || "movie";
  const firstPlatformLink = initialMovie?.movie_platform_links?.[0] ?? null;
  const firstChannelItem = initialMovie?.content_channel_items?.[0] ?? null;
  const [title, setTitle] = useState(initialMovie?.title ?? "");
  const [slug, setSlug] = useState(initialMovie?.slug ?? "");
  const [selectedType, setSelectedType] = useState(initialSelectedType);
  const [selectedStatus, setSelectedStatus] = useState(initialMovie?.status ?? "draft");
  const [primarySection, setPrimarySection] = useState(initialMovie?.primary_section ?? (initialMovie?.is_trending ? "trending" : initialMovie?.is_latest ? "recently_added" : "recently_added"));
  const [showInHero, setShowInHero] = useState(Boolean(initialMovie?.show_in_hero ?? initialMovie?.is_featured));
  const [primaryLanguage, setPrimaryLanguage] = useState(initialMovie?.primary_language ?? "");
  const [hasLicensedVideo, setHasLicensedVideo] = useState(Boolean(initialMovie?.has_licensed_video));
  const [isLatest, setIsLatest] = useState(Boolean(initialMovie?.is_latest));
  const [isTrending, setIsTrending] = useState(Boolean(initialMovie?.is_trending));
  const [isFeatured, setIsFeatured] = useState(Boolean(initialMovie?.is_featured));
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(splitStoredValues(initialMovie?.language));
  const [selectedGenres, setSelectedGenres] = useState<string[]>((initialMovie?.genres ?? []).map((genre) => genre.id));
  const [selectedCast, setSelectedCast] = useState<string[]>((initialMovie?.cast_members ?? []).map((member) => member.id));
  const [genreSearch, setGenreSearch] = useState("");
  const [castSearch, setCastSearch] = useState("");
  const [selectedWatchLanguages, setSelectedWatchLanguages] = useState<string[]>(splitStoredValues(firstPlatformLink?.language));
  const [selectedQualities, setSelectedQualities] = useState<string[]>(splitStoredValues(firstPlatformLink?.quality));
  const [selectedPlatformId, setSelectedPlatformId] = useState(firstPlatformLink?.platform_id ?? "");
  const [platformHomeUrl, setPlatformHomeUrl] = useState(firstPlatformLink?.platform_home_url ?? "");
  const [platformSearchUrl, setPlatformSearchUrl] = useState(firstPlatformLink?.platform_search_url ?? "");
  const [availabilityType, setAvailabilityType] = useState(firstPlatformLink?.availability_type ?? "subscription");
  const [accessType, setAccessType] = useState<AccessType>(normalizeAccessType(initialMovie?.access_type || firstPlatformLink?.availability_type));
  const [watchLinkType, setWatchLinkType] = useState(normalizeWatchLinkType(firstPlatformLink?.link_type));
  const [openMode, setOpenMode] = useState(firstPlatformLink?.open_mode ?? "auto");
  const [mobileWebSupported, setMobileWebSupported] = useState(mobilePlaybackValue(firstPlatformLink));
  const [desktopWebSupported, setDesktopWebSupported] = useState(normalizePlaybackSupport(firstPlatformLink?.desktop_web_supported));
  const [showWatchAdvanced, setShowWatchAdvanced] = useState(false);
  const [appDeeplink, setAppDeeplink] = useState(firstPlatformLink?.app_deeplink ?? "");
  const [appStoreUrl, setAppStoreUrl] = useState(firstPlatformLink?.app_store_url ?? "");
  const [playStoreUrl, setPlayStoreUrl] = useState(firstPlatformLink?.play_store_url ?? "");
  const [fallbackNote, setFallbackNote] = useState(firstPlatformLink?.fallback_note ?? "");
  const [watchLinkNotes, setWatchLinkNotes] = useState(firstPlatformLink?.notes ?? "");
  const firstChannelType = initialMovie?.content_channels?.[0]?.channel_type;
  const [selectedChannelType, setSelectedChannelType] = useState<"" | "cartoon" | "tv_show">(
    firstChannelType === "cartoon" || firstChannelType === "tv_show" ? firstChannelType : ""
  );
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>((initialMovie?.content_channels ?? []).map((channel) => channel.id));
  const [channelSeasonNumber, setChannelSeasonNumber] = useState(firstChannelItem?.season_number ? String(firstChannelItem.season_number) : "");
  const [channelEpisodeNumber, setChannelEpisodeNumber] = useState(firstChannelItem?.episode_number ? String(firstChannelItem.episode_number) : "");
  const [channelEpisodeTitle, setChannelEpisodeTitle] = useState(firstChannelItem?.episode_title ?? "");
  const [channelPlaylistGroup, setChannelPlaylistGroup] = useState(firstChannelItem?.playlist_group ?? "");
  const [channelSortOrder, setChannelSortOrder] = useState(firstChannelItem?.sort_order ? String(firstChannelItem.sort_order) : "");
  const [videoProvider, setVideoProvider] = useState(normalizeVideoProvider(initialMovie?.video_provider));
  const [licenseType, setLicenseType] = useState(initialMovie?.license_type ?? "");
  const [message, setMessage] = useState<Message | null>(null);
  const [duplicateAdvisory, setDuplicateAdvisory] = useState<DuplicateAdvisory | null>(null);
  const [allowExactDuplicateId, setAllowExactDuplicateId] = useState<string | null>(null);
  const allowExactDuplicateIdRef = useRef<string | null>(null);
  const [partialSaveMovieId, setPartialSaveMovieId] = useState<string | null>(null);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMovieSlug, setSavedMovieSlug] = useState<string | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [selectedPositioning, setSelectedPositioning] = useState<string[]>([]);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [aiImportedGenres, setAiImportedGenres] = useState<string[]>([]);
  const [aiImportedCast, setAiImportedCast] = useState<Array<{ name: string; role?: string | null; character?: string | null }>>([]);
  const [aiImportedTags, setAiImportedTags] = useState<string[]>([]);
  const [aiImportedExternalIds, setAiImportedExternalIds] = useState<{ tmdbId?: number | null; imdbId?: string | null }>({});
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const link = initialMovie?.movie_platform_links?.[0] ?? null;
    setTitle(initialMovie?.title ?? "");
    setSlug(initialMovie?.slug ?? "");
    setSelectedType(initialMovie?.content_type || initialMovie?.type || initialContentType || "movie");
    setSelectedStatus(initialMovie?.status ?? "draft");
    setPrimarySection(initialMovie?.primary_section ?? (initialMovie?.is_trending ? "trending" : initialMovie?.is_latest ? "recently_added" : "recently_added"));
    setShowInHero(Boolean(initialMovie?.show_in_hero ?? initialMovie?.is_featured));
    setPrimaryLanguage(initialMovie?.primary_language ?? "");
    setHasLicensedVideo(Boolean(initialMovie?.has_licensed_video));
    setIsLatest(Boolean(initialMovie?.is_latest));
    setIsTrending(Boolean(initialMovie?.is_trending));
    setIsFeatured(Boolean(initialMovie?.is_featured));
    setSelectedLanguages(splitStoredValues(initialMovie?.language));
    setSelectedGenres((initialMovie?.genres ?? []).map((genre) => genre.id));
    setSelectedCast((initialMovie?.cast_members ?? []).map((member) => member.id));
    setGenreSearch("");
    setCastSearch("");
    setSelectedWatchLanguages(splitStoredValues(link?.language));
    setSelectedQualities(splitStoredValues(link?.quality));
    setSelectedPlatformId(link?.platform_id ?? "");
    setPlatformHomeUrl(link?.platform_home_url ?? "");
    setPlatformSearchUrl(link?.platform_search_url ?? "");
    setAvailabilityType(link?.availability_type ?? "subscription");
    setAccessType(normalizeAccessType(initialMovie?.access_type || link?.availability_type));
    setWatchLinkType(normalizeWatchLinkType(link?.link_type));
    setOpenMode(link?.open_mode ?? "auto");
    setMobileWebSupported(mobilePlaybackValue(link));
    setDesktopWebSupported(normalizePlaybackSupport(link?.desktop_web_supported));
    setAppDeeplink(link?.app_deeplink ?? "");
    setAppStoreUrl(link?.app_store_url ?? "");
    setPlayStoreUrl(link?.play_store_url ?? "");
    setFallbackNote(link?.fallback_note ?? "");
    setWatchLinkNotes(link?.notes ?? "");
    const nextChannelType = initialMovie?.content_channels?.[0]?.channel_type;
    setSelectedChannelType(nextChannelType === "cartoon" || nextChannelType === "tv_show" ? nextChannelType : "");
    setSelectedChannelIds((initialMovie?.content_channels ?? []).map((channel) => channel.id));
    const nextChannelItem = initialMovie?.content_channel_items?.[0] ?? null;
    setChannelSeasonNumber(nextChannelItem?.season_number ? String(nextChannelItem.season_number) : "");
    setChannelEpisodeNumber(nextChannelItem?.episode_number ? String(nextChannelItem.episode_number) : "");
    setChannelEpisodeTitle(nextChannelItem?.episode_title ?? "");
    setChannelPlaylistGroup(nextChannelItem?.playlist_group ?? "");
    setChannelSortOrder(nextChannelItem?.sort_order ? String(nextChannelItem.sort_order) : "");
    setVideoProvider(normalizeVideoProvider(initialMovie?.video_provider));
    setLicenseType(initialMovie?.license_type ?? "");
    setMessage(null);
    setDuplicateAdvisory(null);
    setAllowExactDuplicateId(null);
    allowExactDuplicateIdRef.current = null;
    setPartialSaveMovieId(null);
    setSavedMovieSlug(null);
    setSelectedPositioning([]);
    setHelperMessage(null);
    setAiImportedGenres([]);
    setAiImportedCast([]);
    setAiImportedTags([]);
    setAiImportedExternalIds({});
    setPosterPreview(null);
    setBannerPreview(null);
    formRef.current?.reset();
  }, [initialMovie, initialContentType]);

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [posterPreview, bannerPreview]);

  useEffect(() => {
    if (!aiDraft || isEditMode) return;
    applyAiDraftToForm(aiDraft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftVersion]);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) setSlug(slugify(value));
  }

  function setPreview(event: ChangeEvent<HTMLInputElement>, type: "poster" | "banner") {
    const file = event.target.files?.[0];
    const preview = file ? URL.createObjectURL(file) : null;

    if (type === "poster") {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      setPosterPreview(preview);
      return;
    }

    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(preview);
  }

  function setNamedField(name: string, value?: string | number | null) {
    const element = formRef.current?.elements.namedItem(name);
    if (!element) return;
    const nextValue = value == null ? "" : String(value);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.value = nextValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function normalizedLabel(value?: string | null) {
    return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function findPlatformForDraft(draft: AiImportDraft) {
    const platformName = normalizedLabel(`${draft.platform?.name || ""} ${draft.platform?.key || ""}`);
    if (!platformName) return null;
    return platforms.find((platform) => {
      const option = normalizedLabel(`${platform.name} ${platform.slug || ""}`);
      return option.includes(platformName) || platformName.includes(option) || platformName.split(" ").some((token) => token.length > 3 && option.includes(token));
    }) ?? null;
  }

  function languageMatches(value?: string | null) {
    const normalizedLanguage = normalizeLanguageLabel(value);
    if (normalizedLanguage) return normalizedLanguage;
    const normalized = normalizedLabel(value);
    if (!normalized) return null;
    return WATCHFINDER_LANGUAGES.find((language) => normalizedLabel(language) === normalized || normalized.includes(normalizedLabel(language))) ?? null;
  }

  function htmlDateValue(value?: string | null) {
    const clean = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}/.test(clean) ? clean.slice(0, 10) : "";
  }

  function applyAiDraftToForm(draft: AiImportDraft) {
    const nextTitle = draft.title || draft.extractedTitle || "";
    const nextSlug = slugify(draft.slug || nextTitle);
    const nextType = draft.contentType === "tv_show" || draft.contentType === "cartoon" || draft.contentType === "short_film"
      ? draft.contentType
      : "movie";
    const matchedPlatform = findPlatformForDraft(draft);
    const draftGenres = Array.from(new Set([...(draft.genres || []), ...(draft.subGenres || [])].filter(Boolean)));
    const matchingGenreIds = genres
      .filter((genre) => draftGenres.some((imported) => normalizedLabel(genre.name) === normalizedLabel(imported)))
      .map((genre) => genre.id);
    const importedCast = (draft.cast || []).map((person) => ({
      name: person.name,
      role: person.role || "Cast",
      character: person.character || null
    })).filter((person) => person.name);
    const matchingCastIds = castMembers
      .filter((member) => importedCast.some((person) => normalizedLabel(person.name) === normalizedLabel(member.name)))
      .map((member) => member.id);
    const originalLanguage = languageMatches(draft.originalLanguage || draft.language);
    const platformLanguages = actualAudioLanguages(draft.availableLanguages || []);
    const inferredLanguages = withLanguageDisplayLabels(
      platformLanguages.length ? platformLanguages : [originalLanguage || draft.language || ""],
      originalLanguage || draft.originalLanguage
    );
    const existingLanguages = selectedLanguages.length ? selectedLanguages : splitStoredValues(initialMovie?.language);
    const mergedLanguages = Array.from(new Set([...inferredLanguages, ...existingLanguages].filter(Boolean)));
    const joinedMetadata = [
      draft.title,
      draft.originalTitle,
      draft.languageDetectionWarning,
      ...(draft.availableLanguages || []),
      ...(draft.tags || []),
      ...(draft.keywords || []),
      ...(draft.genres || [])
    ].join(" ").toLowerCase();
    if (joinedMetadata.includes("hindi dubbed") && !mergedLanguages.includes("Hindi Dubbed")) {
      mergedLanguages.push("Hindi Dubbed");
    }
    const enhancedGenreIds = [...matchingGenreIds];
    const hasSouthHindiLanguage = ["Tamil", "Telugu", "Malayalam", "Kannada", "Tulu"].some((language) => mergedLanguages.includes(language)) && mergedLanguages.includes("Hindi");
    if (hasSouthHindiLanguage) {
      const southHindiGenre = genres.find((genre) => normalizedLabel(genre.name) === normalizedLabel("South Hindi Dubbed"));
      if (southHindiGenre && !enhancedGenreIds.includes(southHindiGenre.id)) enhancedGenreIds.push(southHindiGenre.id);
    }
    const currentWatchUrl = ((formRef.current?.elements.namedItem("watch_url") as HTMLInputElement | null)?.value || "").trim();
    const initialWatchUrl = (firstPlatformLink?.watch_url || initialMovie?.official_watch_url || "").trim();
    const shouldFillWatchUrl = Boolean(draft.officialWatchUrl) && (!currentWatchUrl || currentWatchUrl === initialWatchUrl);
    const preservedWatchUrl = Boolean(draft.officialWatchUrl && currentWatchUrl && currentWatchUrl !== draft.officialWatchUrl && !shouldFillWatchUrl);

    setTitle(nextTitle);
    setSlug(nextSlug);
    setSelectedType(nextType);
    setSelectedStatus("draft");
    setPrimarySection(draft.suggestedPlacement?.primarySection || (nextType === "cartoon" ? "cartoon" : nextType === "tv_show" ? "tv_show" : "recently_added"));
    setShowInHero(Boolean(draft.suggestedPlacement?.showInHero));
    setPrimaryLanguage(primaryLanguageForSelection(mergedLanguages));
    setSelectedLanguages(mergedLanguages);
    setSelectedGenres(Array.from(new Set(enhancedGenreIds)));
    setSelectedCast(Array.from(new Set(matchingCastIds)));
    setAiImportedGenres(draftGenres);
    setAiImportedCast(importedCast);
    setAiImportedTags(Array.from(new Set([...(draft.tags || []), ...(draft.keywords || [])].filter(Boolean).map(String))));
    setAiImportedExternalIds({ tmdbId: draft.tmdbId ?? null, imdbId: draft.imdbId ?? null });
    setHasLicensedVideo(false);
    setVideoProvider(draft.trailerUrl ? "youtube" : "direct");
    setLicenseType("");
    setIsLatest(false);
    setIsTrending(false);
    setIsFeatured(false);
    setSelectedPlatformId(matchedPlatform?.id || "");
    setPlatformHomeUrl(draft.platform?.homeUrl || "");
    setPlatformSearchUrl(draft.platform?.searchUrl && nextTitle ? draft.platform.searchUrl.replace("{query}", encodeURIComponent(nextTitle)) : "");
    setOpenMode("auto");
    setMobileWebSupported("unknown");
    setDesktopWebSupported("unknown");
    setWatchLinkType(draft.officialWatchUrl ? "direct_title_page" : "platform_search");
    setAccessType(normalizeAccessType(draft.accessType));
    setAvailabilityType(availabilityFromAccessType(draft.accessType));
    setSelectedWatchLanguages(actualAudioLanguages(mergedLanguages));
    setSelectedQualities([]);
    setWatchLinkNotes("");
    setFallbackNote("");
    setAppDeeplink("");
    setAppStoreUrl("");
    setPlayStoreUrl("");
    setNamedField("release_year", draft.releaseYear ?? "");
    setNamedField("release_date", htmlDateValue(draft.releaseDate));
    setNamedField("duration_minutes", draft.runtimeMinutes ?? "");
    setNamedField("rating", draft.rating ?? "");
    setNamedField("director", draft.director || "");
    setNamedField("popularity_score", draft.popularityScore ?? "");
    setNamedField("description", draft.description || draft.storyOverview || "");
    setNamedField("poster_url", draft.posterUrl || "");
    setNamedField("banner_url", draft.bannerUrl || "");
    setNamedField("trailer_url", draft.trailerUrl || "");
    setNamedField("trailer_provider", draft.trailerUrl ? "youtube" : "");
    setNamedField("watch_url", shouldFillWatchUrl ? draft.officialWatchUrl || "" : currentWatchUrl);
    setNamedField("seo_title", draft.seoTitle || "");
    setNamedField("seo_description", draft.seoDescription || "");
    setNamedField("og_image_url", draft.bannerUrl || draft.posterUrl || "");
    setPosterPreview(draft.posterUrl || null);
    setBannerPreview(draft.bannerUrl || null);
    setMessage({
      type: "success",
      text: `AI Auto Fill filled ${nextTitle}. Status is Draft. Review images, trailer, official link, genres and cast before saving.`
    });
    if (draft.languageDetectionWarning) {
      setHelperMessage(draft.languageDetectionWarning);
    } else if (preservedWatchUrl) {
      setHelperMessage("AI refreshed metadata and trailer details, but kept your existing official watch link.");
    } else if (draft.officialWatchUrl && !matchedPlatform) {
      setHelperMessage(`AI detected ${draft.platform?.name || "an official platform"}, but no matching platform exists in Admin Platforms. Select or create it before saving the watch link.`);
    } else {
      setHelperMessage("AI filled the form from public metadata. Missing fields were left empty for manual review.");
    }
  }

  function validate(form: FormData) {
    if (!title.trim()) return "Title is required.";
    if (!slug.trim()) return "Slug is required.";
    if (!selectedStatus) return "Status is required.";
    if (!selectedType) return "Content type is required.";

    const watchUrl = toNullableString(form.get("watch_url"));
    const trailerUrl = toNullableString(form.get("trailer_url"));
    const platformId = selectedPlatformId;
    if (watchUrl && !platformId) return "Select an official platform before adding a watch link.";
    if (selectedStatus === "published" && !watchUrl && !trailerUrl) {
      return "Publish needs an official watch link or trailer URL. Save as Draft if links are not ready yet.";
    }

    if (hasLicensedVideo) {
      if (!normalizeVideoProvider(videoProvider)) return "Video provider is required for licensed video.";
      if (!toNullableString(form.get("video_embed_url")) && !toNullableString(form.get("video_id"))) {
        return "Video embed URL or video ID is required for licensed video.";
      }
      if (!licenseType) return "License type is required for licensed video.";
      if (!toNullableString(form.get("license_owner_name"))) return "License owner name is required for licensed video.";
    }

    return null;
  }

  function toggleLanguage(language: string) {
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language]
    );
  }

  function toggleItem(value: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function applyPositioning(positioning: string) {
    setSelectedPositioning((current) => current.includes(positioning) ? current : [...current, positioning]);

    if (positioning === "trailer") {
      setHasLicensedVideo(false);
      setVideoProvider("");
      setLicenseType("");
      setSelectedType("trailer");
      setHelperMessage("Trailer Only selected. Licensed video fields are turned off.");
      return;
    }

    if (positioning === "free") {
      setHasLicensedVideo(true);
      setAvailabilityType("free");
      setAccessType("free");
      setPrimarySection("free_legal");
      setHelperMessage("Free Legal Movie selected. Use only if full video is legally available.");
      return;
    }

    if (positioning === "hindi") {
      setSelectedLanguages((current) => current.includes("Hindi Dubbed") ? current : [...current, "Hindi Dubbed"]);
      setPrimarySection("hindi_dubbed");
      setHelperMessage("Hindi Dubbed added to language.");
      return;
    }

    if (positioning === "ott") {
      setIsLatest(true);
      setPrimarySection("ott_release");
      setHelperMessage("OTT Release marked as latest.");
      return;
    }

    if (positioning === "public_domain") {
      setHasLicensedVideo(true);
      setLicenseType("public_domain");
      setHelperMessage("Public Domain selected and license fields enabled.");
      return;
    }

    if (positioning === "youtube") {
      const youtube = platforms.find((platform) =>
        `${platform.name} ${platform.slug}`.toLowerCase().includes("youtube")
      );
      if (youtube) setSelectedPlatformId(youtube.id);
      setAvailabilityType("official");
      setAccessType("unknown");
      setPrimarySection("official_youtube");
      setHelperMessage(youtube ? "Official YouTube selected as the platform." : "Official YouTube selected. Add a YouTube platform to auto-select it.");
      return;
    }

    if (positioning === "short") {
      setSelectedType("short_film");
      setHelperMessage("Short Film / Indie Film selected.");
    }
  }

  function resetFormState(formElement?: HTMLFormElement | null) {
    try {
      formElement?.reset();
    } catch {
      // A successful save should not become a visible error because a browser reset failed.
    }
    setTitle("");
    setSlug("");
    setSelectedType(initialContentType || "movie");
    setSelectedStatus("draft");
    setPrimarySection("recently_added");
    setShowInHero(false);
    setPrimaryLanguage("");
    setHasLicensedVideo(false);
    setIsLatest(false);
    setSelectedLanguages([]);
    setSelectedGenres([]);
    setSelectedCast([]);
    setGenreSearch("");
    setCastSearch("");
    setSelectedWatchLanguages([]);
    setSelectedQualities([]);
    setSelectedPlatformId("");
    setPlatformHomeUrl("");
    setPlatformSearchUrl("");
    setAvailabilityType("subscription");
    setAccessType("unknown");
    setWatchLinkType("direct_title_page");
    setOpenMode("auto");
    setMobileWebSupported("unknown");
    setDesktopWebSupported("unknown");
    setAppDeeplink("");
    setAppStoreUrl("");
    setPlayStoreUrl("");
    setFallbackNote("");
    setWatchLinkNotes("");
    setSelectedChannelType("");
    setSelectedChannelIds([]);
    setChannelSeasonNumber("");
    setChannelEpisodeNumber("");
    setChannelEpisodeTitle("");
    setChannelPlaylistGroup("");
    setChannelSortOrder("");
    setVideoProvider("direct");
    setLicenseType("");
    setIsTrending(false);
    setIsFeatured(false);
    setSelectedPositioning([]);
    setHelperMessage(null);
    setAiImportedGenres([]);
    setAiImportedCast([]);
    setAiImportedTags([]);
    setAiImportedExternalIds({});
    try {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    } catch {
      // Object URL cleanup is best-effort.
    }
    setPosterPreview(null);
    setBannerPreview(null);
  }

  function clearAddAnother() {
    resetFormState(formRef.current);
    setMessage(null);
    setSavedMovieSlug(null);
    setDuplicateAdvisory(null);
    setAllowExactDuplicateId(null);
    allowExactDuplicateIdRef.current = null;
    setPartialSaveMovieId(null);
    onAddNew?.();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createExactDuplicateAnyway() {
    if (duplicateAdvisory) {
      allowExactDuplicateIdRef.current = duplicateAdvisory.movieId;
      setAllowExactDuplicateId(duplicateAdvisory.movieId);
    }
    setDuplicateAdvisory(null);
    formRef.current?.requestSubmit();
  }

  function changeSlugManually() {
    setDuplicateAdvisory(null);
    setMessage({ type: "info", text: "Change the slug field, then save again." });
    window.setTimeout(() => slugInputRef.current?.focus(), 0);
  }

  function updateChannelType(value: "" | "cartoon" | "tv_show") {
    setSelectedChannelType(value);
    setSelectedChannelIds([]);
    if (value === "cartoon") setSelectedType("cartoon");
    if (value === "tv_show") setSelectedType("tv_show");
  }

  function updateOfficialPlatform(platformId: string) {
    const platform = platforms.find((item) => item.id === platformId) ?? null;
    setSelectedPlatformId(platformId);
    if (platform && isYouTubePlatform(platform) && !firstPlatformLink?.watch_url) {
      setWatchLinkType("direct_title_page");
      setOpenMode("trailer_modal");
      setMobileWebSupported("yes");
      setAvailabilityType("official");
      setVideoProvider("youtube");
      return;
    }
    if (platform && isExternalOnlyPlatform(platform) && !firstPlatformLink?.watch_url) {
      setWatchLinkType("platform_search");
      setOpenMode("in_app_browser");
      setMobileWebSupported("unknown");
      setDesktopWebSupported("unknown");
      setHasLicensedVideo(false);
      setVideoProvider("direct");
    } else {
      setVideoProvider((current) => normalizeVideoProvider(current));
    }
  }

  function updateMobilePlayback(value: string) {
    const nextValue = normalizePlaybackSupport(value);
    setMobileWebSupported(nextValue);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const formElement = event.currentTarget;
    setMessage({ type: "info", text: `Saving ${formatType(selectedType).toLowerCase()}...` });
    setSavedMovieSlug(null);
    let persistedMovieId: string | null = null;

    try {
      const form = new FormData(formElement);
      const validationError = validate(form);
      if (validationError) {
        setMessage({ type: "error", text: validationError });
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const skippedOptionalMovieColumns = new Set<string>();
      const optionalSaveWarnings = new Set<string>();
      const rememberSkippedColumn = (column: string) => skippedOptionalMovieColumns.add(column);
      const rememberWarnings = (warnings: string[] = []) => warnings.forEach((warning) => optionalSaveWarnings.add(warning));
      const poster = form.get("poster") as File;
      const banner = form.get("banner") as File;
      const watchUrl = toNullableString(form.get("watch_url"));
      const posterUrl = toNullableString(form.get("poster_url"));
      const bannerUrl = toNullableString(form.get("banner_url"));
      const trailerUrl = toNullableString(form.get("trailer_url"));
      const selectedGenreNames = selectedGenres
        .map((genreId) => genres.find((genre) => genre.id === genreId)?.name)
        .filter(Boolean) as string[];
      const selectedCastNames = selectedCast
        .map((castId) => castMembers.find((member) => member.id === castId))
        .filter((member): member is CastMember => Boolean(member))
        .map((member) => ({ name: member.name, role: member.role_label || "Cast" }));
      const aiTags = Array.from(new Set([...(aiImportedTags || []), ...(aiDraft?.keywords || []), ...(aiDraft?.tags || [])].filter(Boolean).map(String)));
      const aiBackdropUrl = aiDraft?.images?.find((image) => image.kind === "backdrop" || image.kind === "banner")?.url || bannerUrl || aiDraft?.bannerUrl || null;
      const selectedActualLanguages = actualAudioLanguages(selectedLanguages);
      const effectivePrimaryLanguage = selectedActualLanguages.length > 1
        ? "Multi-language"
        : primaryLanguage || primaryLanguageForSelection(selectedLanguages);
      const aiImportPayload = toJsonSafeValue({
        rawAiDraft: aiDraft,
        rawTmdbData: aiDraft?.source === "tmdb" ? aiDraft : null,
        credits: {
          cast: aiDraft?.cast || aiImportedCast,
          crew: aiDraft?.crew || [],
          director: aiDraft?.director || toNullableString(form.get("director")),
          writers: aiDraft?.writers || [],
          producers: aiDraft?.producers || []
        },
        externalIds: {
          tmdbId: aiImportedExternalIds.tmdbId ?? aiDraft?.tmdbId ?? null,
          imdbId: aiImportedExternalIds.imdbId ?? aiDraft?.imdbId ?? null
        },
        videos: {
          trailerUrl,
          trailerName: aiDraft?.trailerName || null,
          provider: trailerUrl ? "youtube" : null
        },
        budget: aiDraft?.budget ?? null,
        revenue: aiDraft?.revenue ?? null,
        ageRating: aiDraft?.ageRating || null,
        voteCount: aiDraft?.voteCount ?? null,
        originalTitle: aiDraft?.originalTitle || title.trim(),
        originalLanguage: aiDraft?.originalLanguage || null,
        tagline: aiDraft?.tagline || null,
        country: aiDraft?.country || null,
        productionCompanies: aiDraft?.productionCompanies || [],
        genres: Array.from(new Set([...selectedGenreNames, ...aiImportedGenres])),
        languages: selectedLanguages,
        availableLanguages: selectedActualLanguages,
        homepage: {
          placement: primarySection || "recently_added",
          showInHero
        },
        platform: {
          name: selectedPlatform?.name || aiDraft?.platform?.name || null,
          watchUrl,
          homeUrl: platformHomeUrl || aiDraft?.platform?.homeUrl || null,
          searchUrl: platformSearchUrl || aiDraft?.platform?.searchUrl || null,
          openMode,
          mobileWebSupported,
          desktopWebSupported
        },
        access: {
          type: accessType,
          label: accessTypeMeta(accessType).label,
          detail: accessTypeMeta(accessType).detail,
          reason: aiDraft?.accessTypeReason || null
        },
        license: {
          hasLicensedVideo,
          videoProvider: normalizeVideoProvider(videoProvider),
          videoEmbedUrl: hasLicensedVideo ? toNullableString(form.get("video_embed_url")) : null,
          videoId: hasLicensedVideo ? toNullableString(form.get("video_id")) : null,
          licenseType: hasLicensedVideo ? licenseType : null,
          ownerName: hasLicensedVideo ? toNullableString(form.get("license_owner_name")) : null,
          startDate: hasLicensedVideo ? toNullableString(form.get("license_start_date")) : null,
          expiryDate: hasLicensedVideo ? toNullableString(form.get("license_expiry_date")) : null,
          notes: hasLicensedVideo ? toNullableString(form.get("license_notes")) : null,
          territory: hasLicensedVideo ? toNullableString(form.get("distribution_territory")) : null
        },
        flags: {
          isTrending,
          isFeatured,
          isLatest,
          isHindiDubbed: selectedLanguages.includes("Hindi Dubbed"),
          isFreeLegal: accessType === "free" || availabilityType === "free",
          isOfficial: Boolean(trailerUrl || watchUrl)
        }
      });
      const rawPayload = {
        title: title.trim(),
        slug: slug.trim(),
        type: databaseMovieTypeForContentType(selectedType),
        status: selectedStatus || "draft",
        content_type: selectedType || "movie",
        homepage_placement: primarySection || "recently_added",
        primary_section: primarySection || "recently_added",
        show_in_hero: showInHero,
        display_title: title.trim(),
        original_title: aiDraft?.originalTitle || title.trim(),
        tagline: aiDraft?.tagline || null,
        primary_language: toNullableString(effectivePrimaryLanguage),
        available_languages: selectedActualLanguages,
        languages_json: selectedLanguages,
        genres_json: Array.from(new Set([...selectedGenreNames, ...aiImportedGenres])),
        tags_json: aiTags,
        tags: aiTags.length ? aiTags : null,
        cast_json: aiImportedCast.length ? aiImportedCast : selectedCastNames,
        poster_url: posterUrl,
        backdrop_url: aiBackdropUrl,
        banner_url: bannerUrl,
        thumbnail_url: posterUrl || bannerUrl || aiDraft?.thumbnailUrl || null,
        platform_name: selectedPlatform?.name || null,
        description: toNullableString(form.get("description")),
        short_description: toNullableString(form.get("description"))?.slice(0, 180) || null,
        release_date: toNullableString(form.get("release_date")),
        release_year: toNullableNumber(form.get("release_year")),
        duration_minutes: toNullableNumber(form.get("duration_minutes")),
        rating: toNullableNumber(form.get("rating")),
        imdb_rating: toNullableNumber(form.get("rating")),
        language: joinLanguages(selectedLanguages) || null,
        original_language: aiDraft?.originalLanguage || null,
        country: aiDraft?.country || null,
        budget: aiDraft?.budget ?? null,
        revenue: aiDraft?.revenue ?? null,
        vote_count: aiDraft?.voteCount ?? null,
        age_rating: aiDraft?.ageRating || null,
        production_companies_json: aiDraft?.productionCompanies || [],
        external_ids_json: {
          tmdb_id: aiImportedExternalIds.tmdbId ?? aiDraft?.tmdbId ?? null,
          imdb_id: aiImportedExternalIds.imdbId ?? aiDraft?.imdbId ?? null,
          source: aiDraft?.source || null
        },
        director: toNullableString(form.get("director")),
        trailer_url: trailerUrl,
        trailer_provider: toNullableString(form.get("trailer_provider")),
        access_type: accessType,
        is_trending: isTrending,
        is_featured: isFeatured,
        is_latest: isLatest,
        is_hindi_dubbed: selectedLanguages.includes("Hindi Dubbed"),
        is_free_legal: accessType === "free" || availabilityType === "free",
        is_official: Boolean(trailerUrl || watchUrl),
        popularity_score: normalizePopularityScore(toNullableNumber(form.get("popularity_score")) ?? aiDraft?.popularityScore ?? 0),
        seo_title: toNullableString(form.get("seo_title")),
        seo_description: toNullableString(form.get("seo_description")),
        og_image_url: toNullableString(form.get("og_image_url")),
        tmdb_id: aiImportedExternalIds.tmdbId ?? aiDraft?.tmdbId ?? null,
        imdb_id: aiImportedExternalIds.imdbId ?? aiDraft?.imdbId ?? null,
        ai_import_source: aiDraft?.source || null,
        ai_import_payload: aiImportPayload,
        metadata_source: aiDraft?.sourceLabel || aiDraft?.source || null,
        metadata_confidence: aiDraft ? aiDraft.qualityScore?.score ?? null : null,
        quality_score: aiDraft?.qualityScore?.score ?? null,
        official_platform: selectedPlatform?.name || null,
        official_watch_url: watchUrl,
        watch_url: watchUrl,
        platform_home_url: toNullableString(platformHomeUrl),
        platform_search_url: toNullableString(platformSearchUrl),
        app_deeplink: toNullableString(appDeeplink),
        open_mode: openMode,
        mobile_web_supported: mobileWebSupported,
        desktop_web_supported: desktopWebSupported,
        app_required: mobileWebSupported === "no",
        play_store_url: toNullableString(playStoreUrl),
        app_store_url: toNullableString(appStoreUrl),
        fallback_note: toNullableString(fallbackNote),
        availability_type: availabilityType,
        quality: selectedQualities.join(", ") || null,
        has_licensed_video: hasLicensedVideo,
        video_provider: normalizeVideoProvider(videoProvider),
        video_embed_url: hasLicensedVideo ? toNullableString(form.get("video_embed_url")) : null,
        video_id: hasLicensedVideo ? toNullableString(form.get("video_id")) : null,
        license_type: hasLicensedVideo ? licenseType : null,
        license_owner_name: hasLicensedVideo ? toNullableString(form.get("license_owner_name")) : null,
        license_start_date: hasLicensedVideo ? toNullableString(form.get("license_start_date")) : null,
        license_expiry_date: hasLicensedVideo ? toNullableString(form.get("license_expiry_date")) : null,
        license_notes: hasLicensedVideo ? toNullableString(form.get("license_notes")) : null,
        distribution_territory: hasLicensedVideo ? toNullableString(form.get("distribution_territory")) : null
      };
      const unlistedPayloadColumns = findUnlistedMoviePayloadColumns(rawPayload);
      if (unlistedPayloadColumns.length) {
        console.info("WatchFinder movie save removed non-allowlisted payload keys", unlistedPayloadColumns);
      }
      const basePayload = sanitizeMovieBasePayload(rawPayload);
      const metadataPayload = sanitizeMovieMetadataPayload(rawPayload);
      const payload = basePayload;
      console.info("WatchFinder movie save payload", {
        sentBaseKeys: Object.keys(basePayload),
        sentMetadataKeys: Object.keys(metadataPayload),
        removedKeys: unlistedPayloadColumns,
        hasAiImportPayload: Object.prototype.hasOwnProperty.call(metadataPayload, "ai_import_payload")
      });
      const platformId = selectedPlatformId;
      const savedWatchLinkType = watchUrl ? watchLinkType : watchLinkType === "direct_title_page" ? "platform_search" : watchLinkType;
      const channelMeta = {
        season_number: channelSeasonNumber ? Number(channelSeasonNumber) : null,
        episode_number: channelEpisodeNumber ? Number(channelEpisodeNumber) : null,
        episode_title: channelEpisodeTitle.trim() || null,
        playlist_group: channelPlaylistGroup.trim() || null,
        sort_order: channelSortOrder ? Number(channelSortOrder) : 0
      };
      const relatedData = {
        genreIds: selectedGenres,
        castMemberIds: selectedCast,
        platformLink: platformId ? {
          platform_id: platformId,
          watch_url: watchUrl,
          platform_home_url: toNullableString(platformHomeUrl),
          platform_search_url: toNullableString(platformSearchUrl),
          app_deeplink: toNullableString(appDeeplink),
          app_store_url: toNullableString(appStoreUrl),
          play_store_url: toNullableString(playStoreUrl),
          fallback_note: toNullableString(fallbackNote),
          mobile_web_supported: mobileWebSupported,
          desktop_web_supported: desktopWebSupported,
          app_required: mobileWebSupported === "no",
          link_type: savedWatchLinkType,
          open_mode: openMode,
          availability_type: availabilityType,
          language: joinLanguages(selectedWatchLanguages) || null,
          quality: selectedQualities.join(", ") || null,
          notes: watchLinkNotes.trim() || null
        } : null,
        channelLinks: selectedChannelIds.map((channel_id) => ({ channel_id, ...channelMeta }))
      };

      let movie: { id: string; slug: string };
      let serverSavedMovie: Movie | null = null;

      if (isEditMode && initialMovie?.id) {
        const saved = await saveMovieRowViaAdminApi({
          movieId: initialMovie.id,
          payload,
          metadataPayload,
          relatedData
        });
        saved.skippedColumns.forEach(rememberSkippedColumn);
        rememberWarnings(saved.warnings);
        movie = { id: saved.movie.id, slug: saved.movie.slug };
        serverSavedMovie = normalizeConfirmedMovie(saved.movie);
        setSlug(String(saved.movie.slug));
      } else if (partialSaveMovieId) {
        const saved = await saveMovieRowViaAdminApi({
          movieId: partialSaveMovieId,
          payload,
          metadataPayload,
          relatedData
        });
        saved.skippedColumns.forEach(rememberSkippedColumn);
        rememberWarnings(saved.warnings);
        movie = { id: saved.movie.id, slug: saved.movie.slug };
        serverSavedMovie = normalizeConfirmedMovie(saved.movie);
        setSlug(String(saved.movie.slug));
      } else {
        const slugConflict = await findMovieBySlug(supabase, String(payload.slug || ""));
        if (slugConflict && allowExactDuplicateIdRef.current !== slugConflict.movieId && allowExactDuplicateId !== slugConflict.movieId) {
          setDuplicateAdvisory(slugConflict);
          setMessage({
            type: "info",
            text: "Similar slug already exists. Open it, save this as a new listing, or change the slug manually."
          });
          return;
        }

        const exactDuplicate = await findExactDuplicateMovie(
          supabase,
          payload,
          watchUrl,
          Boolean(poster?.size),
          Boolean(banner?.size)
        );

        if (exactDuplicate && allowExactDuplicateIdRef.current !== exactDuplicate.movieId && allowExactDuplicateId !== exactDuplicate.movieId) {
          setDuplicateAdvisory(exactDuplicate);
          setMessage({
            type: "info",
            text: "This looks like an exact duplicate. You can create it anyway or open the existing movie editor."
          });
          return;
        }

        const potentialDuplicate = await findPotentialDuplicateMovie(
          supabase,
          { ...payload, ...metadataPayload },
          watchUrl,
          initialMovie?.id ?? null
        );

        if (potentialDuplicate && allowExactDuplicateIdRef.current !== potentialDuplicate.movieId && allowExactDuplicateId !== potentialDuplicate.movieId) {
          setDuplicateAdvisory(potentialDuplicate);
          setMessage({
            type: "info",
            text: "This title may already exist. Open it, save this as a new listing, or cancel by editing the fields."
          });
          return;
        }

        const saved = await saveMovieRowViaAdminApi({
          payload,
          metadataPayload,
          relatedData,
          allowDuplicate: Boolean(allowExactDuplicateIdRef.current || allowExactDuplicateId)
        });
        saved.skippedColumns.forEach(rememberSkippedColumn);
        rememberWarnings(saved.warnings);
        movie = { id: saved.movie.id, slug: saved.movie.slug };
        serverSavedMovie = normalizeConfirmedMovie(saved.movie);
        setSlug(String(saved.movie.slug));
      }

      persistedMovieId = movie.id;

      const updatePayload: Record<string, string> = {};
      if (poster?.size) updatePayload.poster_url = await uploadPoster(movie.id, poster);
      if (banner?.size) {
        const uploadedBannerUrl = await uploadBanner(movie.id, banner);
        updatePayload.banner_url = uploadedBannerUrl;
        updatePayload.backdrop_url = uploadedBannerUrl;
      }
      if (Object.keys(updatePayload).length) {
        const unlistedImageColumns = findUnlistedMoviePayloadColumns(updatePayload);
        if (unlistedImageColumns.length) {
          console.warn("Admin image payload contains columns missing from MOVIE_REQUIRED_COLUMNS", unlistedImageColumns);
        }
        const imageSaved = await saveMovieRowViaAdminApi({
          movieId: movie.id,
          payload: updatePayload
        });
        imageSaved.skippedColumns.forEach(rememberSkippedColumn);
        rememberWarnings(imageSaved.warnings);
        serverSavedMovie = normalizeConfirmedMovie(imageSaved.movie);
      }

      const licenseDoc = form.get("license_document") as File;
      if (licenseDoc?.size) {
        const uploaded = await uploadLicenseDocumentWithPath(movie.id, licenseDoc);
        const licenseSaved = await saveMovieRowViaAdminApi({
          movieId: movie.id,
          payload: {},
          relatedData: {
            licenseDocument: {
              file_url: uploaded.publicUrl,
              file_path: uploaded.path,
              file_name: uploaded.fileName,
              license_type: licenseType,
              owner_name: toNullableString(form.get("license_owner_name")),
              notes: toNullableString(form.get("license_notes")),
              uploaded_by: auth.user?.id ?? null
            }
          }
        });
        licenseSaved.skippedColumns.forEach(rememberSkippedColumn);
        rememberWarnings(licenseSaved.warnings);
        serverSavedMovie = normalizeConfirmedMovie(licenseSaved.movie);
      }

      const confirmedRow = await fetchConfirmedMovie(supabase, movie.id).catch((confirmError: unknown) => {
        if (serverSavedMovie) {
          console.warn("Client confirmation read was blocked or unavailable; using server-confirmed movie row.", confirmError);
          return serverSavedMovie;
        }
        throw saveStepError("Confirming saved movie row", confirmError);
      });
      const confirmedMovieRow = confirmedRow || serverSavedMovie;
      if (!confirmedMovieRow) {
        throw new Error("Movie save confirmation failed. Movie was not found after saving.");
      }

      const savedMovie = normalizeConfirmedMovie(confirmedMovieRow);
      const slugNote = !isEditMode ? ` Final slug: ${savedMovie.slug}.` : "";
      const savedTypeLabel = formatType(savedMovie.content_type || savedMovie.type || selectedType);
      const skippedOptionalColumns = Array.from(skippedOptionalMovieColumns);
      const skippedColumnsNote = skippedOptionalColumns.length
        ? ` Skipped unavailable optional metadata columns: ${skippedOptionalColumns.join(", ")}. If those columns were just added in Supabase, run notify pgrst, 'reload schema'; then save again to store them.`
        : "";
      const warningList = Array.from(optionalSaveWarnings);
      const saveOutcome = selectedStatus === "published"
        ? "Published successfully."
        : isEditMode
          ? `${savedTypeLabel} updated successfully.`
          : "Draft saved successfully.";

      setMessage({
        type: warningList.length ? "warning" : "success",
        text: warningList.length
          ? `${saveOutcome} Movie saved, but some optional related data needs review: ${warningList.join(" ")}${slugNote}`
          : `${saveOutcome}${slugNote} ${getMovieSaveVisibilityMessage(savedMovie)} ${getSaveDebugText(savedMovie)}${skippedColumnsNote}`
      });
      setSavedMovieSlug(savedMovie.slug);
      setDuplicateAdvisory(null);
      setAllowExactDuplicateId(null);
      allowExactDuplicateIdRef.current = null;
      setPartialSaveMovieId(null);
      onSaved?.(savedMovie);
      if (!isEditMode) resetFormState(formElement);
    } catch (error) {
      const duplicate = (error as { duplicate?: DuplicateAdvisory }).duplicate;
      if (duplicate) {
        setDuplicateAdvisory(duplicate);
        setMessage({
          type: "warning",
          text: "This title may already exist. Open the existing listing, update it, or save this as a new listing anyway."
        });
        return;
      }
      const message = formatSaveError(error);
      const savedMovieId = persistedMovieId || (error as { movieId?: string }).movieId || null;
      if (savedMovieId && !isEditMode) {
        setPartialSaveMovieId(savedMovieId);
      }
      setMessage({
        type: savedMovieId ? "warning" : "error",
        text: savedMovieId
          ? `Movie saved, but some optional related data needs review: ${message} Press Save again to retry optional data on the same saved row, or open the existing movie editor.`
          : message
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const filteredGenres = genres.filter((genre) =>
    genre.name.toLowerCase().includes(genreSearch.toLowerCase())
  );
  const filteredCast = castMembers.filter((member) =>
    member.name.toLowerCase().includes(castSearch.toLowerCase())
  );
  const watchMinutes = movieAnalytics ? Math.round(movieAnalytics.watchSeconds / 60) : 0;
  const selectedPlatform = platforms.find((platform) => platform.id === selectedPlatformId) ?? null;
  const officialPlatformOptions = [...platforms].sort(
    (left, right) => platformOptionScore(left) - platformOptionScore(right) || left.name.localeCompare(right.name)
  );
  const selectedTypeLabel = formatType(selectedType);
  const formTitle = isEditMode ? `Edit ${selectedTypeLabel}` : `Add ${selectedTypeLabel}`;
  const submitLabel = isEditMode ? `Update ${selectedTypeLabel}` : `Save ${selectedTypeLabel}`;
  const draftVisibilityCheck = getMovieVisibilityCheck({
    ...(initialMovie || {}),
    id: initialMovie?.id || "pending",
    title: title || "Unsaved movie",
    slug: slug || "unsaved-movie",
    type: selectedType,
    status: selectedStatus,
    language: joinLanguages(selectedLanguages) || null,
    poster_url: posterPreview || initialMovie?.poster_url || null,
    banner_url: bannerPreview || initialMovie?.banner_url || null,
    trailer_url: (formRef.current?.elements.namedItem("trailer_url") as HTMLInputElement | null)?.value || initialMovie?.trailer_url || null,
    is_featured: isFeatured,
    is_latest: isLatest,
    is_trending: isTrending,
    movie_platform_links: selectedPlatformId ? [{ id: "pending", movie_id: initialMovie?.id || "pending", platform_id: selectedPlatformId, watch_url: "pending" }] : initialMovie?.movie_platform_links || []
  } as Movie);
  const showMissingPlayLinkWarning = isEditMode && initialMovie && !hasSavedPlayableOrWatchLink(initialMovie);

  return (
    <form ref={formRef} className="form-grid panel admin-movie-form" onSubmit={submit}>
      <div>
        <h2>{formTitle}</h2>
        <p className="muted">
          {isEditMode ? "Update this existing WatchFinder listing." : `Create a new legal ${selectedTypeLabel.toLowerCase()} discovery listing.`}
        </p>
      </div>

      <FormSection title="Content Positioning" helper="These helper chips update form fields. Review the fields below, then click Save Movie.">
        <div className="positioning-grid">
          <button className={selectedPositioning.includes("trailer") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("trailer")}>
            Trailer Only
            <small>Turns licensed video off</small>
          </button>
          <button className={selectedPositioning.includes("free") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("free")}>
            Free Legal Movie
            <small>Marks licensed/free where possible</small>
          </button>
          <button className={selectedPositioning.includes("hindi") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("hindi")}>
            Hindi Dubbed Finder
            <small>Adds Hindi Dubbed language</small>
          </button>
          <button className={selectedPositioning.includes("ott") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("ott")}>
            OTT Release
            <small>Marks as latest</small>
          </button>
          <button className={selectedPositioning.includes("public_domain") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("public_domain")}>
            Public Domain
            <small>Sets public_domain license</small>
          </button>
          <button className={selectedPositioning.includes("youtube") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("youtube")}>
            Official YouTube
            <small>Selects YouTube if available</small>
          </button>
          <button className={selectedPositioning.includes("short") ? "positioning-chip selected" : "positioning-chip"} type="button" onClick={() => applyPositioning("short")}>
            Short Film / Indie Film
            <small>Sets type to short film</small>
          </button>
        </div>
        {helperMessage ? <p className="form-message info">{helperMessage}</p> : null}
        <div className="admin-visibility-note">
          <strong>Homepage visibility</strong>
          <p>To show this movie in homepage slider, set Status = Published and enable Featured, Latest, or Trending. Add a banner image for best hero display. To show in Trending Now: enable Trending. To show in Hindi Dubbed Picks: select Hindi or Hindi Dubbed language. To show in New OTT Releases: enable Latest. To show in Official YouTube Movies: choose YouTube platform and Official availability. To show in Free Legal Movies: only select Free Legal when the full video is legally available.</p>
        </div>
      </FormSection>

      {isEditMode && movieAnalytics ? (
        <FormSection title="Movie Analytics" helper="Quick performance snapshot for this listing. Full analytics are available in Admin > Analytics.">
          <div className="grid">
            <div className="admin-card"><strong>{movieAnalytics.views}</strong><p className="muted">Total views</p></div>
            <div className="admin-card"><strong>{movieAnalytics.todayViews}</strong><p className="muted">Views today</p></div>
            <div className="admin-card"><strong>{watchMinutes}m</strong><p className="muted">Watch time</p></div>
            <div className="admin-card"><strong>{movieAnalytics.trailerPlays}</strong><p className="muted">Trailer plays</p></div>
            <div className="admin-card"><strong>{movieAnalytics.linkClicks}</strong><p className="muted">Official link clicks</p></div>
            <div className="admin-card"><strong>{movieAnalytics.lastViewedAt ? new Date(movieAnalytics.lastViewedAt).toLocaleDateString() : "None"}</strong><p className="muted">Last viewed</p></div>
          </div>
        </FormSection>
      ) : null}

      <FormSection title="Basic Details" helper="Add the core title metadata. Keep status as draft until the listing is ready for the public site.">
        {!isEditMode ? (
          <p className="form-helper">Same movie can be added multiple times. WatchFinder will create a unique slug automatically for each new listing.</p>
        ) : null}
        <div className="form-grid two">
          <div className="field"><label>Title <span className="required">*</span></label><input required value={title} onChange={(e) => updateTitle(e.target.value)} /></div>
          <div className="field"><label>Slug <span className="required">*</span></label><input ref={slugInputRef} required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></div>
          <div className="field"><label>Release Date</label><input name="release_date" type="date" defaultValue={initialMovie?.release_date ?? ""} /></div>
          <div className="field"><label>Release Year</label><input name="release_year" inputMode="numeric" defaultValue={initialMovie?.release_year ?? ""} /></div>
          <div className="field"><label>Duration Minutes</label><input name="duration_minutes" inputMode="numeric" defaultValue={initialMovie?.duration_minutes ?? ""} /></div>
          <div className="field"><label>Rating</label><input name="rating" inputMode="decimal" defaultValue={initialMovie?.rating ?? ""} /></div>
          <div className="field"><label>Director</label><input name="director" defaultValue={initialMovie?.director ?? ""} /></div>
          <div className="field"><label>Popularity Score</label><input name="popularity_score" type="number" step="0.0001" inputMode="decimal" defaultValue={initialMovie?.popularity_score ?? 0} /></div>
        </div>
        <div className="field">
          <label>Content Type</label>
          <div className="option-group">
            <label className="option-card"><input type="radio" name="type" value="movie" checked={selectedType === "movie"} onChange={() => setSelectedType("movie")} /> <span>Movie</span></label>
            <label className="option-card"><input type="radio" name="type" value="trailer" checked={selectedType === "trailer"} onChange={() => setSelectedType("trailer")} /> <span>Trailer</span></label>
            <label className="option-card"><input type="radio" name="type" value="tv_show" checked={selectedType === "tv_show"} onChange={() => setSelectedType("tv_show")} /> <span>TV Show</span></label>
            <label className="option-card"><input type="radio" name="type" value="cartoon" checked={selectedType === "cartoon"} onChange={() => setSelectedType("cartoon")} /> <span>Cartoon</span></label>
            <label className="option-card"><input type="radio" name="type" value="short_film" checked={selectedType === "short_film"} onChange={() => setSelectedType("short_film")} /> <span>Short Film</span></label>
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Homepage Placement</label>
            <select value={primarySection} onChange={(event) => setPrimarySection(event.target.value)}>
              {HOMEPAGE_SECTION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </div>
          <label className="option-card option-card-published">
            <input checked={showInHero} onChange={(event) => setShowInHero(event.target.checked)} type="checkbox" />
            <span>Show in Hero Slider</span>
            <small>Hero is separate from the normal homepage section.</small>
          </label>
          <div className="field">
            <label>Primary Language</label>
            <select value={primaryLanguage} onChange={(event) => setPrimaryLanguage(event.target.value)}>
              <option value="">Auto from selected languages</option>
              {WATCHFINDER_LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Status <span className="required">*</span></label>
          <div className="option-group status-options">
            <label className="option-card"><input type="radio" name="status" value="draft" checked={selectedStatus === "draft"} onChange={() => setSelectedStatus("draft")} required /> <span>Draft</span><small>Hidden from public website</small></label>
            <label className="option-card option-card-published"><input type="radio" name="status" value="published" checked={selectedStatus === "published"} onChange={() => setSelectedStatus("published")} required /> <span>Published</span><small>Visible on website</small></label>
            <label className="option-card"><input type="radio" name="status" value="archived" checked={selectedStatus === "archived"} onChange={() => setSelectedStatus("archived")} required /> <span>Archived</span><small>Hidden/old listing</small></label>
            <label className="option-card"><input type="radio" name="status" value="hidden" checked={selectedStatus === "hidden"} onChange={() => setSelectedStatus("hidden")} required /> <span>Hidden</span><small>Hidden from public website</small></label>
          </div>
        </div>
        <div className="admin-visibility-note">
          <strong>Visibility Check</strong>
          <p>{draftVisibilityCheck.publicReasons.join(", ")}. Homepage: {draftVisibilityCheck.homepageReasons.join(", ")}.</p>
          {draftVisibilityCheck.warnings.length ? <p className="muted">Warnings: {draftVisibilityCheck.warnings.join(", ")}</p> : null}
        </div>
        <div className="field"><label>Description</label><textarea name="description" defaultValue={initialMovie?.description ?? ""} /></div>
        <p className="form-helper">Legacy flags are kept for compatibility. Homepage rows now use the single Homepage Placement dropdown to avoid repeating the same title in many sections.</p>
        <div className="chip-row">
          <label className="chip"><input name="is_trending" type="checkbox" checked={isTrending} onChange={(event) => setIsTrending(event.target.checked)} /> Trending</label>
          <label className="chip"><input name="is_featured" type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} /> Featured</label>
          <label className="chip"><input name="is_latest" type="checkbox" checked={isLatest} onChange={(event) => setIsLatest(event.target.checked)} /> Latest</label>
        </div>
      </FormSection>

      <FormSection title="Languages" helper="Select all languages available for this movie or show.">
        {aiDraft ? (
          <p className={aiDraft.languageDetectionWarning ? "form-message warning" : "form-message info"}>
            Detected original language: {languageMatches(aiDraft.originalLanguage || aiDraft.language) || "Not confirmed"}.{" "}
            {aiDraft.availableLanguages?.length
              ? `Available audio languages detected: ${actualAudioLanguages(aiDraft.availableLanguages).join(", ") || "Not confirmed"}.`
              : "Available audio languages not confirmed."}{" "}
            {aiDraft.languageDetectionWarning || "You can adjust these chips before saving."}
          </p>
        ) : null}
        <div className="language-select-grid">
          {WATCHFINDER_LANGUAGES.map((language) => (
            <label className="language-select-chip" key={language}>
              <input
                checked={selectedLanguages.includes(language)}
                onChange={() => toggleLanguage(language)}
                type="checkbox"
                value={language}
              />
              <span>{language}</span>
            </label>
          ))}
        </div>
        {selectedLanguages.length ? (
          <button className="button ghost clear-languages-button" type="button" onClick={() => setSelectedLanguages([])}>
            Clear selected languages
          </button>
        ) : null}
      </FormSection>

      <FormSection title="Cartoon / TV Channel Linking" helper="Optional. Link this title to cartoon or TV channels. Episode fields are saved on the channel link.">
        {contentChannelsError ? (
          <div className="notice-card error">
            <strong>Cartoon/TV Show tables are missing.</strong>
            <p>{contentChannelsError}</p>
          </div>
        ) : null}
        <div className="option-group compact-options">
          <label className="option-card"><input checked={selectedChannelType === ""} onChange={() => updateChannelType("")} type="radio" name="channel_type_ui" /> <span>None</span></label>
          <label className="option-card"><input checked={selectedChannelType === "cartoon"} onChange={() => updateChannelType("cartoon")} type="radio" name="channel_type_ui" /> <span>Cartoon</span></label>
          <label className="option-card"><input checked={selectedChannelType === "tv_show"} onChange={() => updateChannelType("tv_show")} type="radio" name="channel_type_ui" /> <span>TV Show</span></label>
        </div>
        {selectedChannelType ? (
          <>
            <div className="relation-chip-grid">
              {contentChannels
                .filter((channel) => channel.channel_type === selectedChannelType)
                .map((channel) => (
                  <button
                    className={selectedChannelIds.includes(channel.id) ? "relation-chip selected" : "relation-chip"}
                    key={channel.id}
                    onClick={() => toggleItem(channel.id, setSelectedChannelIds)}
                    type="button"
                  >
                    {channel.name}
                  </button>
                ))}
            </div>
            <div className="form-grid two">
              <div className="field"><label>Season Number</label><input inputMode="numeric" value={channelSeasonNumber} onChange={(event) => setChannelSeasonNumber(event.target.value)} placeholder="1" /></div>
              <div className="field"><label>Episode Number</label><input inputMode="numeric" value={channelEpisodeNumber} onChange={(event) => setChannelEpisodeNumber(event.target.value)} placeholder="1" /></div>
              <div className="field"><label>Episode Title</label><input value={channelEpisodeTitle} onChange={(event) => setChannelEpisodeTitle(event.target.value)} placeholder="Optional episode title" /></div>
              <div className="field"><label>Playlist Group</label><input value={channelPlaylistGroup} onChange={(event) => setChannelPlaylistGroup(event.target.value)} placeholder="Season 1, Clips, Specials" /></div>
              <div className="field"><label>Sort Order</label><input inputMode="numeric" value={channelSortOrder} onChange={(event) => setChannelSortOrder(event.target.value)} placeholder="0" /></div>
            </div>
          </>
        ) : (
          <p className="muted">No channel link selected.</p>
        )}
      </FormSection>

      <FormSection title="Images" helper="Upload strong artwork. Poster recommended 600x900. Banner recommended 1600x700.">
        <div className="form-grid two">
          <div className="field">
            <label>Poster URL</label>
            <input name="poster_url" placeholder="Auto-filled poster URL or paste one manually" defaultValue={initialMovie?.poster_url ?? ""} />
          </div>
          <div className="field">
            <label>Banner URL</label>
            <input name="banner_url" placeholder="Auto-filled banner/backdrop URL or paste one manually" defaultValue={initialMovie?.banner_url ?? ""} />
          </div>
          <div className="field">
            <label>Poster image</label>
            <input name="poster" type="file" accept="image/*" onChange={(event) => setPreview(event, "poster")} />
            <small className="muted">Recommended size: 600x900</small>
            {posterPreview || initialMovie?.poster_url ? <img className="image-preview poster-preview" src={posterPreview || initialMovie?.poster_url || ""} alt="Poster preview" /> : null}
          </div>
          <div className="field">
            <label>Banner image</label>
            <input name="banner" type="file" accept="image/*" onChange={(event) => setPreview(event, "banner")} />
            <small className="muted">Recommended size: 1600x700</small>
            {bannerPreview || initialMovie?.banner_url ? <img className="image-preview banner-preview" src={bannerPreview || initialMovie?.banner_url || ""} alt="Banner preview" /> : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="Trailer" helper="Use official YouTube trailer link. Do not download and upload copyrighted trailers.">
        <div className="form-grid two">
          <div className="field"><label>Trailer URL</label><input name="trailer_url" placeholder="Official YouTube URL" defaultValue={initialMovie?.trailer_url ?? ""} /></div>
          <div className="field"><label>Trailer Provider</label><input name="trailer_provider" defaultValue={initialMovie?.trailer_provider ?? "youtube"} /></div>
        </div>
      </FormSection>

      <FormSection title="Genres and Cast" helper="Search and select multiple genres or cast members. Selected items are highlighted.">
        <div className="form-grid two">
          <div className="field">
            <label>Genres</label>
            <input value={genreSearch} onChange={(event) => setGenreSearch(event.target.value)} placeholder="Search genres" />
            <div className="relation-chip-grid">
              {filteredGenres.map((genre) => (
                <button
                  className={selectedGenres.includes(genre.id) ? "relation-chip selected" : "relation-chip"}
                  key={genre.id}
                  onClick={() => toggleItem(genre.id, setSelectedGenres)}
                  type="button"
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Cast Members</label>
            <input value={castSearch} onChange={(event) => setCastSearch(event.target.value)} placeholder="Search cast" />
            <div className="relation-chip-grid">
              {filteredCast.map((member) => (
                <button
                  className={selectedCast.includes(member.id) ? "relation-chip selected" : "relation-chip"}
                  key={member.id}
                  onClick={() => toggleItem(member.id, setSelectedCast)}
                  type="button"
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Official Watch Link" helper="Add only official legal platform links.">
        <p className="form-helper">OTT apps may block mobile web playback. If it does not play, mark as App required.</p>
        {showMissingPlayLinkWarning ? (
          <p className="form-message warning">
            This movie has no playable trailer or official watch link. Add one to show the play button.
          </p>
        ) : null}
        <div className="form-grid two">
          <div className="field">
            <label>Official Platform</label>
            <select name="platform_id" value={selectedPlatformId} onChange={(event) => updateOfficialPlatform(event.target.value)}>
              <option value="">Select platform</option>
              {officialPlatformOptions.map((platform) => <option value={platform.id} key={platform.id}>{platform.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Watch URL</label>
            <input name="watch_url" placeholder="Paste official movie/show link" defaultValue={firstPlatformLink?.watch_url ?? ""} />
            <small className="form-helper">Add only official legal platform links.</small>
          </div>
          <div className="field">
            <label>Open Mode</label>
            <select name="open_mode" value={openMode} onChange={(event) => setOpenMode(event.target.value)}>
              {OPEN_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Mobile Playback</label>
            <select value={mobileWebSupported} onChange={(event) => updateMobilePlayback(event.target.value)}>
              {PLAYBACK_SUPPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Access Type</label>
            <select
              value={accessType}
              onChange={(event) => {
                const nextAccessType = normalizeAccessType(event.target.value);
                setAccessType(nextAccessType);
                setAvailabilityType(availabilityFromAccessType(nextAccessType));
              }}
            >
              {ACCESS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <small className="form-helper">
              Auto-filled by AI. Current badge: {accessTypeMeta(accessType).label} - {accessTypeMeta(accessType).detail}.
            </small>
          </div>
        </div>

        <div className="watch-link-advanced">
          <button
            className="button ghost"
            type="button"
            onClick={() => setShowWatchAdvanced((current) => !current)}
          >
            {showWatchAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
          </button>
          {showWatchAdvanced ? (
            <div className="watch-link-advanced-panel">
              <div className="form-grid two">
                <div className="field"><label>Platform Home URL</label><input placeholder="Optional official home page fallback" value={platformHomeUrl} onChange={(event) => setPlatformHomeUrl(event.target.value)} /></div>
                <div className="field"><label>Platform Search URL</label><input placeholder="Optional official search result URL" value={platformSearchUrl} onChange={(event) => setPlatformSearchUrl(event.target.value)} /></div>
                <div className="field"><label>App Deep Link</label><input name="app_deeplink" placeholder="Optional official app/web deeplink" value={appDeeplink} onChange={(event) => setAppDeeplink(event.target.value)} /></div>
                <div className="field"><label>Play Store Link</label><input value={playStoreUrl} onChange={(event) => setPlayStoreUrl(event.target.value)} placeholder="Optional Android app listing" /></div>
                <div className="field"><label>App Store Link</label><input value={appStoreUrl} onChange={(event) => setAppStoreUrl(event.target.value)} placeholder="Optional iOS app listing" /></div>
                <div className="field"><label>Desktop Web Supported</label><select value={desktopWebSupported} onChange={(event) => setDesktopWebSupported(normalizePlaybackSupport(event.target.value))}>{PLAYBACK_SUPPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
              </div>
              <div className="field">
                <label>Fallback Note</label>
                <textarea
                  value={fallbackNote}
                  onChange={(event) => setFallbackNote(event.target.value)}
                  placeholder="Example: This title is not supported on mobile web playback. Continue in the official JioHotstar app."
                />
              </div>
              <div className="field">
                <label>Link Type</label>
                <div className="option-group compact-options">
                  {WATCH_LINK_TYPES.map((type) => (
                    <label className="option-card" key={type}>
                      <input checked={watchLinkType === type} onChange={() => setWatchLinkType(type)} name="watch_link_type" type="radio" value={type} />
                      <span>{watchLinkTypeLabels[type]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Availability Type</label>
                <div className="option-group compact-options">
                  {AVAILABILITY_OPTIONS.map((option) => (
                    <label className="option-card" key={option.value}>
                      <input checked={availabilityType === option.value} onChange={() => setAvailabilityType(option.value)} name="availability_type" type="radio" value={option.value} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Platform Notes</label>
                <textarea
                  name="watch_link_notes"
                  value={watchLinkNotes}
                  onChange={(event) => setWatchLinkNotes(event.target.value)}
                  placeholder="Example: Exact title link is not available. Search this title on JioHotstar."
                />
              </div>
              <div className="field">
                <label>Watch Link Language</label>
                <div className="language-select-grid compact-chip-grid">
                  {WATCHFINDER_LANGUAGES.map((language) => (
                    <label className="language-select-chip" key={language}>
                      <input
                        checked={selectedWatchLanguages.includes(language)}
                        onChange={() => toggleItem(language, setSelectedWatchLanguages)}
                        type="checkbox"
                        value={language}
                      />
                      <span>{language}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Quality</label>
                <div className="language-select-grid compact-chip-grid">
                  {QUALITY_OPTIONS.map((quality) => (
                    <label className="language-select-chip" key={quality}>
                      <input
                        checked={selectedQualities.includes(quality)}
                        onChange={() => toggleItem(quality, setSelectedQualities)}
                        type="checkbox"
                        value={quality}
                      />
                      <span>{quality}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="Licensed Video" helper="Optional. Leave this off for normal discovery pages with trailers and official watch links.">
        <label className="chip"><input checked={hasLicensedVideo} onChange={(event) => setHasLicensedVideo(event.target.checked)} name="has_licensed_video" type="checkbox" /> Has licensed video</label>
        {hasLicensedVideo ? <p className="legal-badge">Only use videos you own or have written permission to distribute. Do not upload pirated movies.</p> : null}
        <p className="form-helper">Video Provider choices are for playable video inside WatchFinder only. OTT platforms like JioHotstar, Netflix, and Prime Video should be added as official watch links, not as internal playable providers. If no provider is selected, WatchFinder saves Direct Video URL as the safe default.</p>
        {hasLicensedVideo ? (
          <>
            <div className="form-grid two">
              <div className="field"><label>Video Provider <span className="required">*</span></label><select name="video_provider" value={videoProvider} onChange={(event) => setVideoProvider(normalizeVideoProvider(event.target.value))}>{VIDEO_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
              <div className="field"><label>Video Embed URL</label><input name="video_embed_url" defaultValue={initialMovie?.video_embed_url ?? ""} /></div>
              <div className="field"><label>Video ID</label><input name="video_id" defaultValue={initialMovie?.video_id ?? ""} /></div>
              <div className="field"><label>License Type <span className="required">*</span></label><select name="license_type" value={licenseType} onChange={(event) => setLicenseType(event.target.value)}><option value="">Select</option><option value="self_owned">Self owned</option><option value="creator_permission">Creator permission</option><option value="public_domain">Public domain</option><option value="purchased_license">Purchased license</option></select></div>
              <div className="field"><label>License Owner Name <span className="required">*</span></label><input name="license_owner_name" defaultValue={initialMovie?.license_owner_name ?? ""} /></div>
              <div className="field"><label>License Start Date</label><input name="license_start_date" type="date" defaultValue={initialMovie?.license_start_date ?? ""} /></div>
              <div className="field"><label>License Expiry Date</label><input name="license_expiry_date" type="date" defaultValue={initialMovie?.license_expiry_date ?? ""} /></div>
              <div className="field"><label>Distribution Territory</label><input name="distribution_territory" defaultValue={initialMovie?.distribution_territory ?? ""} /></div>
              <div className="field"><label>License Document</label><input name="license_document" type="file" /></div>
            </div>
            <div className="field"><label>License Notes</label><textarea name="license_notes" defaultValue={initialMovie?.license_notes ?? ""} /></div>
          </>
        ) : (
          <p className="muted">License fields are hidden until licensed video is enabled.</p>
        )}
      </FormSection>

      <FormSection title="SEO" helper="Optional metadata for Google and social previews. Blank fields fallback to movie title, description, banner, or poster.">
        <div className="form-grid two">
          <div className="field"><label>SEO Title</label><input name="seo_title" defaultValue={initialMovie?.seo_title ?? ""} /></div>
          <div className="field"><label>OG Image URL</label><input name="og_image_url" defaultValue={initialMovie?.og_image_url ?? ""} /></div>
        </div>
        <div className="field"><label>SEO Description</label><textarea name="seo_description" defaultValue={initialMovie?.seo_description ?? ""} /></div>
      </FormSection>

      {isEditMode && initialMovie ? (
        <FormSection title="Existing Movie Actions" helper="Archive hides this movie from public pages while keeping it in admin. Delete is permanent and asks for confirmation.">
          <div className="save-actions">
            {initialMovie.status !== "archived" && onArchiveMovie ? (
              <button className="button ghost" type="button" onClick={() => onArchiveMovie(initialMovie)}>
                Archive Movie
              </button>
            ) : null}
            {onDeleteMovie ? (
              <button className="button danger" type="button" onClick={() => onDeleteMovie(initialMovie)}>
                Delete Movie
              </button>
            ) : null}
          </div>
        </FormSection>
      ) : null}

      {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
      {partialSaveMovieId && onDuplicateSlug && !duplicateAdvisory ? (
        <button className="button" type="button" onClick={() => onDuplicateSlug(partialSaveMovieId)}>
          Open existing movie editor
        </button>
      ) : null}
      {duplicateAdvisory ? (
        <div className="form-message info duplicate-advisory">
          <strong>
            {duplicateAdvisory.reason === "slug"
              ? "Similar slug already exists"
              : duplicateAdvisory.reason === "potential"
                ? "This title may already exist"
                : "This looks like an exact duplicate"}
          </strong>
          <p>You can open the existing listing, save this upload as a new listing with a unique slug, or change the slug manually.</p>
          <div className="meta-line">
            <span>Existing title: {duplicateAdvisory.title}</span>
            <span>Existing slug: {duplicateAdvisory.slug}</span>
            <span>Status: {duplicateAdvisory.status || "draft"}</span>
            <span>Created: {formatDuplicateDate(duplicateAdvisory.createdAt)}</span>
          </div>
          <div className="save-actions">
            {onDuplicateSlug ? (
              <button className="button primary" type="button" onClick={() => onDuplicateSlug(duplicateAdvisory.movieId)}>
                Open / update existing listing
              </button>
            ) : null}
            <button className="button" type="button" onClick={createExactDuplicateAnyway}>
              Save as new listing anyway
            </button>
            <button className="button ghost" type="button" onClick={changeSlugManually}>
              Change slug manually
            </button>
          </div>
        </div>
      ) : null}
      {savedMovieSlug ? (
        <div className="save-actions">
          <p className="platform-badge">Final slug: {savedMovieSlug}</p>
          <Link className="button" href={`/movie/${savedMovieSlug}`}>
            <Eye size={18} /> View Movie Page
          </Link>
          {isEditMode && onBackToMovies ? (
            <button className="button" type="button" onClick={onBackToMovies}>
              Back to Movies
            </button>
          ) : null}
          <button className="button ghost" type="button" onClick={clearAddAnother}>
            {isEditMode ? `Add New ${selectedTypeLabel}` : `Add Another ${selectedTypeLabel}`}
          </button>
        </div>
      ) : null}
      <button className="button primary" type="submit" disabled={saving}>
        <Save size={18} /> {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
