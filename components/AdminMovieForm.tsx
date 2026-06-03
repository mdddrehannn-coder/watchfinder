"use client";

import Link from "next/link";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useRef, useState } from "react";
import { Eye, Save } from "lucide-react";
import { getMovieSaveVisibilityMessage, getMovieVisibilityCheck } from "@/lib/admin-visibility";
import { formatType, slugify } from "@/lib/format";
import { joinLanguages, WATCHFINDER_LANGUAGES } from "@/lib/languages";
import { isOptionalMovieRelationError, movieSelect, movieSelectWithoutChannels } from "@/lib/movie-select";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadBanner, uploadLicenseDocumentWithPath, uploadPoster } from "@/lib/storage";
import { WATCH_LINK_TYPES, watchLinkTypeLabels, normalizeWatchLinkType, isExternalOnlyPlatform } from "@/lib/watch-links";
import type { CastMember, ContentChannel, Genre, Movie, Platform } from "@/types/watchfinder";

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type DuplicateAdvisory = {
  movieId: string;
  title: string;
  slug: string;
  status?: string | null;
  createdAt?: string | null;
  reason: "slug" | "exact";
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

const OPEN_MODE_OPTIONS = [
  { label: "Trailer modal", value: "trailer_modal" },
  { label: "In-app browser", value: "in_app_browser" },
  { label: "External", value: "external" }
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
  { label: "Unknown", value: "unknown" },
  { label: "Yes", value: "yes" },
  { label: "No / App required", value: "no" }
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

function toNullableString(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function toNullableNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && String(value || "").trim() ? numberValue : null;
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
  if (
    code === "PGRST204" ||
    normalized.includes("schema cache") ||
    normalized.includes("could not find") ||
    normalized.includes("column") ||
    normalized.includes("relationship")
  ) {
    return `${message} Migration hint: run supabase/migrations/202605260001_fix_admin_movie_schema_mismatch.sql, then try saving again.`;
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

function isSlugConflictError(error: unknown) {
  const message = formatSupabaseError(error).toLowerCase();
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "23505" || (message.includes("duplicate") && message.includes("slug"));
}

async function resolveUniqueMovieSlug(supabase: any, requestedSlug: string, excludeMovieId?: string | null) {
  const base = slugify(requestedSlug) || `movie-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("movies")
    .select("id, slug")
    .like("slug", `${base}%`);

  if (error) throw saveStepError("Checking available slug", error);

  const exactSlugPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-(\\d+))?$`);
  const existingSlugs = new Set(
    (data || [])
      .filter((item: { id?: string | null; slug?: string | null }) => item.id !== excludeMovieId)
      .map((item: { slug?: string | null }) => item.slug || "")
      .filter((existingSlug: string) => exactSlugPattern.test(existingSlug))
  );

  if (!existingSlugs.has(base)) return base;

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
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

async function insertMovieWithUniqueSlug(supabase: any, payload: Record<string, unknown>) {
  const requestedSlug = String(payload.slug || payload.title || "movie");
  let finalSlug = await resolveUniqueMovieSlug(supabase, requestedSlug);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await supabase
      .from("movies")
      .insert({ ...payload, slug: finalSlug })
      .select("id, slug")
      .single();

    if (!error && data) return { movie: data, finalSlug };
    if (!isSlugConflictError(error)) throw saveStepError("Creating movie row", error);

    finalSlug = attempt >= 4
      ? `${slugify(requestedSlug) || "movie"}-${Date.now().toString(36)}`
      : await resolveUniqueMovieSlug(supabase, requestedSlug);
  }

  throw new Error("Creating movie row failed: Could not create a unique slug after multiple attempts.");
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
  initialContentType = "movie"
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
  const [availabilityType, setAvailabilityType] = useState(firstPlatformLink?.availability_type ?? "subscription");
  const [watchLinkType, setWatchLinkType] = useState(normalizeWatchLinkType(firstPlatformLink?.link_type));
  const [openMode, setOpenMode] = useState(firstPlatformLink?.open_mode ?? "in_app_browser");
  const [mobileWebSupported, setMobileWebSupported] = useState(normalizePlaybackSupport(firstPlatformLink?.mobile_web_supported));
  const [desktopWebSupported, setDesktopWebSupported] = useState(normalizePlaybackSupport(firstPlatformLink?.desktop_web_supported));
  const [appRequired, setAppRequired] = useState(Boolean(firstPlatformLink?.app_required));
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
    setAvailabilityType(link?.availability_type ?? "subscription");
    setWatchLinkType(normalizeWatchLinkType(link?.link_type));
    setOpenMode(link?.open_mode ?? "in_app_browser");
    setMobileWebSupported(normalizePlaybackSupport(link?.mobile_web_supported));
    setDesktopWebSupported(normalizePlaybackSupport(link?.desktop_web_supported));
    setAppRequired(Boolean(link?.app_required));
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

  function validate(form: FormData) {
    if (!title.trim()) return "Title is required.";
    if (!slug.trim()) return "Slug is required.";
    if (!selectedStatus) return "Status is required.";

    const watchUrl = toNullableString(form.get("watch_url"));
    const platformId = selectedPlatformId;
    if (watchUrl && !platformId) return "Select an official platform before adding a watch link.";

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
    setAvailabilityType("subscription");
    setWatchLinkType("direct_title_page");
    setOpenMode("in_app_browser");
    setMobileWebSupported("unknown");
    setDesktopWebSupported("unknown");
    setAppRequired(false);
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
    if (platform && isExternalOnlyPlatform(platform) && !firstPlatformLink?.watch_url) {
      setWatchLinkType("platform_search");
      setOpenMode("in_app_browser");
      setMobileWebSupported("unknown");
      setDesktopWebSupported("unknown");
      setAppRequired(false);
      setHasLicensedVideo(false);
      setVideoProvider("direct");
    } else {
      setVideoProvider((current) => normalizeVideoProvider(current));
    }
  }

  async function markSelectedPlatformAppRequired() {
    setAppRequired(true);
    setMobileWebSupported("no");
    setFallbackNote((current) => current || "This title is not supported on mobile web playback. Continue in the official app.");

    if (!firstPlatformLink?.id) {
      setHelperMessage("Marked as app required. Save the movie to apply this to the watch link.");
      window.setTimeout(() => setHelperMessage(null), 3500);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("movie_platform_links")
        .update({
          app_required: true,
          mobile_web_supported: "no",
          fallback_note: fallbackNote || "This title is not supported on mobile web playback. Continue in the official app."
        })
        .eq("id", firstPlatformLink.id);

      if (error) throw error;
      setHelperMessage("Marked as App Required. Public pages will show the app fallback after refresh.");
    } catch (error) {
      setHelperMessage(error instanceof Error ? error.message : "Could not mark this link as app required.");
    }
    window.setTimeout(() => setHelperMessage(null), 4500);
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
      const poster = form.get("poster") as File;
      const banner = form.get("banner") as File;
      const watchUrl = toNullableString(form.get("watch_url"));
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        type: selectedType,
        content_type: selectedType,
        primary_section: primarySection,
        show_in_hero: showInHero,
        primary_language: toNullableString(primaryLanguage),
        languages_json: selectedLanguages,
        platform_name: selectedPlatform?.name || null,
        description: toNullableString(form.get("description")),
        release_year: toNullableNumber(form.get("release_year")),
        duration_minutes: toNullableNumber(form.get("duration_minutes")),
        rating: toNullableNumber(form.get("rating")),
        language: joinLanguages(selectedLanguages) || null,
        director: toNullableString(form.get("director")),
        trailer_url: toNullableString(form.get("trailer_url")),
        trailer_provider: toNullableString(form.get("trailer_provider")),
        is_trending: isTrending,
        is_featured: isFeatured,
        is_latest: isLatest,
        popularity_score: toNullableNumber(form.get("popularity_score")) ?? 0,
        status: selectedStatus,
        seo_title: toNullableString(form.get("seo_title")),
        seo_description: toNullableString(form.get("seo_description")),
        og_image_url: toNullableString(form.get("og_image_url")),
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

      let wasUpdate = isEditMode || Boolean(partialSaveMovieId);
      let movie: { id: string; slug: string };

      if (isEditMode && initialMovie?.id) {
        payload.slug = await resolveUniqueMovieSlug(supabase, payload.slug, initialMovie.id);
        setSlug(payload.slug);
        const { data, error } = await supabase
          .from("movies")
          .update(payload)
          .eq("id", initialMovie.id)
          .select("id, slug")
          .single();
        if (error || !data) {
          throw error ? saveStepError("Updating movie row", error) : new Error("Movie update failed.");
        }
        movie = data;
      } else if (partialSaveMovieId) {
        payload.slug = await resolveUniqueMovieSlug(supabase, payload.slug, partialSaveMovieId);
        setSlug(payload.slug);
        const { data, error } = await supabase
          .from("movies")
          .update(payload)
          .eq("id", partialSaveMovieId)
          .select("id, slug")
          .single();
        if (error || !data) {
          throw error ? saveStepError("Retrying saved movie row", error) : new Error("Movie retry failed.");
        }
        movie = data;
      } else {
        const slugConflict = await findMovieBySlug(supabase, payload.slug);
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

        wasUpdate = false;
        const inserted = await insertMovieWithUniqueSlug(supabase, payload);
        payload.slug = inserted.finalSlug;
        setSlug(inserted.finalSlug);
        movie = inserted.movie;
      }

      persistedMovieId = movie.id;

      const updatePayload: Record<string, string> = {};
      if (poster?.size) updatePayload.poster_url = await uploadPoster(movie.id, poster);
      if (banner?.size) updatePayload.banner_url = await uploadBanner(movie.id, banner);
      if (Object.keys(updatePayload).length) {
        const { error: imageError } = await supabase.from("movies").update(updatePayload).eq("id", movie.id);
        if (imageError) throw saveStepError("Saving poster/banner URLs", imageError);
      }

      if (wasUpdate) {
        const { error: genreDeleteError } = await supabase.from("movie_genres").delete().eq("movie_id", movie.id);
        if (genreDeleteError) throw saveStepError("Clearing existing genre links", genreDeleteError);

        const { error: castDeleteError } = await supabase.from("movie_cast").delete().eq("movie_id", movie.id);
        if (castDeleteError) throw saveStepError("Clearing existing cast links", castDeleteError);
      }

      if (selectedGenres.length) {
        const { error: genreError } = await supabase
          .from("movie_genres")
          .insert(selectedGenres.map((genre_id) => ({ movie_id: movie.id, genre_id })));
        if (genreError) throw saveStepError("Saving genre links", genreError);
      }

      if (selectedCast.length) {
        const { error: castError } = await supabase
          .from("movie_cast")
          .insert(selectedCast.map((cast_member_id) => ({ movie_id: movie.id, cast_member_id })));
        if (castError) throw saveStepError("Saving cast links", castError);
      }

      if (wasUpdate) {
        const { error: platformDeleteError } = await supabase
          .from("movie_platform_links")
          .delete()
          .eq("movie_id", movie.id);
        if (platformDeleteError) throw saveStepError("Clearing existing platform links", platformDeleteError);
      }

      const platformId = selectedPlatformId;
      if (platformId) {
        const savedWatchLinkType = watchUrl ? watchLinkType : watchLinkType === "direct_title_page" ? "platform_search" : watchLinkType;
        const { error: platformError } = await supabase.from("movie_platform_links").insert({
          movie_id: movie.id,
          platform_id: platformId,
          watch_url: watchUrl,
          platform_home_url: toNullableString(form.get("platform_home_url")),
          platform_search_url: toNullableString(form.get("platform_search_url")),
          app_deeplink: toNullableString(appDeeplink),
          app_store_url: toNullableString(appStoreUrl),
          play_store_url: toNullableString(playStoreUrl),
          fallback_note: toNullableString(fallbackNote),
          mobile_web_supported: mobileWebSupported,
          desktop_web_supported: desktopWebSupported,
          app_required: appRequired,
          link_type: savedWatchLinkType,
          open_mode: openMode,
          availability_type: availabilityType,
          language: joinLanguages(selectedWatchLanguages) || null,
          quality: selectedQualities.join(", ") || null,
          notes: watchLinkNotes.trim() || null,
          is_official: true,
          is_active: true
        });
        if (platformError) throw saveStepError("Saving platform watch link", platformError);
      }

      if (wasUpdate) {
        const { error: channelDeleteError } = await supabase
          .from("content_channel_items")
          .delete()
          .eq("movie_id", movie.id);
        if (channelDeleteError) throw saveStepError("Clearing existing cartoon/TV channel links", channelDeleteError);
      }

      if (selectedChannelIds.length) {
        const channelMeta = {
          season_number: channelSeasonNumber ? Number(channelSeasonNumber) : null,
          episode_number: channelEpisodeNumber ? Number(channelEpisodeNumber) : null,
          episode_title: channelEpisodeTitle.trim() || null,
          playlist_group: channelPlaylistGroup.trim() || null,
          sort_order: channelSortOrder ? Number(channelSortOrder) : 0
        };
        const { error: channelLinkError } = await supabase
          .from("content_channel_items")
          .insert(selectedChannelIds.map((channel_id) => ({ movie_id: movie.id, channel_id, ...channelMeta })));
        if (channelLinkError) throw saveStepError("Saving cartoon/TV channel links", channelLinkError);
      }

      const licenseDoc = form.get("license_document") as File;
      if (licenseDoc?.size) {
        const uploaded = await uploadLicenseDocumentWithPath(movie.id, licenseDoc);
        const { error: licenseError } = await supabase.from("license_documents").insert({
          movie_id: movie.id,
          file_url: uploaded.publicUrl,
          file_path: uploaded.path,
          file_name: uploaded.fileName,
          license_type: licenseType,
          owner_name: toNullableString(form.get("license_owner_name")),
          notes: toNullableString(form.get("license_notes")),
          uploaded_by: auth.user?.id ?? null
        });
        if (licenseError) throw saveStepError("Saving license document record", licenseError);
      }

      const confirmedRow = await fetchConfirmedMovie(supabase, movie.id).catch((confirmError: unknown) => {
        throw saveStepError("Confirming saved movie row", confirmError);
      });
      if (!confirmedRow) {
        throw new Error("Movie save confirmation failed. Movie was not found after saving.");
      }

      const savedMovie = normalizeConfirmedMovie(confirmedRow);
      const slugNote = !isEditMode ? ` Final slug: ${savedMovie.slug}.` : "";
      const savedTypeLabel = formatType(savedMovie.content_type || savedMovie.type || selectedType);

      setMessage({
        type: "success",
        text: `${isEditMode ? `${savedTypeLabel} updated successfully.` : `${savedTypeLabel} saved as new listing.`}${slugNote} ${getMovieSaveVisibilityMessage(savedMovie)} ${getSaveDebugText(savedMovie)}`
      });
      setSavedMovieSlug(savedMovie.slug);
      setDuplicateAdvisory(null);
      setAllowExactDuplicateId(null);
      allowExactDuplicateIdRef.current = null;
      setPartialSaveMovieId(null);
      onSaved?.(savedMovie);
      if (!isEditMode) resetFormState(formElement);
    } catch (error) {
      const message = formatSaveError(error);
      if (persistedMovieId && !isEditMode) {
        setPartialSaveMovieId(persistedMovieId);
      }
      setMessage({
        type: "error",
        text: persistedMovieId
          ? `Movie row was saved, but confirmation or related data failed: ${message} Press Save again to retry related data on the same saved row, or open the existing movie editor.`
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
  const selectedPlatformIsExternalOnly = isExternalOnlyPlatform(selectedPlatform);
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
          <div className="field"><label>Release Year</label><input name="release_year" inputMode="numeric" defaultValue={initialMovie?.release_year ?? ""} /></div>
          <div className="field"><label>Duration Minutes</label><input name="duration_minutes" inputMode="numeric" defaultValue={initialMovie?.duration_minutes ?? ""} /></div>
          <div className="field"><label>Rating</label><input name="rating" inputMode="decimal" defaultValue={initialMovie?.rating ?? ""} /></div>
          <div className="field"><label>Director</label><input name="director" defaultValue={initialMovie?.director ?? ""} /></div>
          <div className="field"><label>Popularity Score</label><input name="popularity_score" inputMode="numeric" defaultValue={initialMovie?.popularity_score ?? 0} /></div>
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

      <FormSection title="Official Watch Link" helper="Optional. Add only official legal platform links. OTT services usually do not allow embedded playback. Add official title/search link. Only YouTube/official embed plays inside WatchFinder.">
        <div className="form-grid two">
          <div className="field"><label>Official Platform</label><select name="platform_id" value={selectedPlatformId} onChange={(event) => updateOfficialPlatform(event.target.value)}><option value="">Select platform</option>{platforms.map((platform) => <option value={platform.id} key={platform.id}>{platform.name}</option>)}</select></div>
          <div className="field"><label>Watch URL</label><input name="watch_url" placeholder="Optional exact title, search, home, or app link" defaultValue={firstPlatformLink?.watch_url ?? ""} /></div>
          <div className="field"><label>Platform Home URL</label><input name="platform_home_url" placeholder="Optional official home page fallback" defaultValue={firstPlatformLink?.platform_home_url ?? ""} /></div>
          <div className="field"><label>Platform Search URL</label><input name="platform_search_url" placeholder="Optional official search result URL" defaultValue={firstPlatformLink?.platform_search_url ?? ""} /></div>
          <div className="field"><label>App Deep Link</label><input name="app_deeplink" placeholder="Optional official app/web deeplink" value={appDeeplink} onChange={(event) => setAppDeeplink(event.target.value)} /></div>
          <div className="field"><label>Open Mode</label><select name="open_mode" value={openMode} onChange={(event) => setOpenMode(event.target.value)}>{OPEN_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label>Mobile Web Supported</label><select value={mobileWebSupported} onChange={(event) => setMobileWebSupported(normalizePlaybackSupport(event.target.value))}>{PLAYBACK_SUPPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label>Desktop Web Supported</label><select value={desktopWebSupported} onChange={(event) => setDesktopWebSupported(normalizePlaybackSupport(event.target.value))}>{PLAYBACK_SUPPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label>Play Store Link</label><input value={playStoreUrl} onChange={(event) => setPlayStoreUrl(event.target.value)} placeholder="Optional Android app listing" /></div>
          <div className="field"><label>App Store Link</label><input value={appStoreUrl} onChange={(event) => setAppStoreUrl(event.target.value)} placeholder="Optional iOS app listing" /></div>
        </div>
        {selectedPlatformIsExternalOnly ? (
          <p className="form-message info">
            {selectedPlatform?.name} is treated as an external legal platform. OTT platforms may block embedded playback. WatchFinder opens the official page inside an in-app browser when possible, with fallback to official app/site.
          </p>
        ) : null}
        <div className="option-group compact-options">
          <label className="option-card">
            <input checked={appRequired} onChange={(event) => setAppRequired(event.target.checked)} type="checkbox" />
            <span>App Required</span>
            <small>Use when mobile web playback is blocked by the platform.</small>
          </label>
          {selectedPlatformIsExternalOnly ? (
            <button className="button ghost" type="button" onClick={markSelectedPlatformAppRequired}>
              Mark as App Required
            </button>
          ) : null}
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
          <label>Fallback Note</label>
          <textarea
            value={fallbackNote}
            onChange={(event) => setFallbackNote(event.target.value)}
            placeholder="Example: This title is not supported on mobile web playback. Continue in the official JioHotstar app."
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
          <strong>{duplicateAdvisory.reason === "slug" ? "Similar slug already exists" : "This looks like an exact duplicate"}</strong>
          <p>You can open the existing listing, save this upload as a new listing with a unique slug, or change the slug manually.</p>
          <div className="meta-line">
            <span>Existing title: {duplicateAdvisory.title}</span>
            <span>Existing slug: {duplicateAdvisory.slug}</span>
            <span>Status: {duplicateAdvisory.status || "draft"}</span>
            <span>Created: {formatDuplicateDate(duplicateAdvisory.createdAt)}</span>
          </div>
          <div className="save-actions">
            <button className="button primary" type="button" onClick={createExactDuplicateAnyway}>
              Save as new listing anyway
            </button>
            {onDuplicateSlug ? (
              <button className="button" type="button" onClick={() => onDuplicateSlug(duplicateAdvisory.movieId)}>
                Open existing movie editor
              </button>
            ) : null}
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
