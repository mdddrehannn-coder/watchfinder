"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { ACCESS_TYPE_OPTIONS, accessTypeMeta, normalizeAccessType, type AccessType } from "@/lib/access-type";
import { slugify } from "@/lib/format";
import { WATCHFINDER_LANGUAGES } from "@/lib/languages";
import { storageBuckets, uploadPublicFile } from "@/lib/storage";
import type { AiImportDraft } from "@/lib/ai-import-types";
import type { Genre, Series } from "@/types/watchfinder";

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type EpisodeFormState = {
  id?: string;
  localId: string;
  episode_number: string;
  title: string;
  description: string;
  poster_url: string;
  banner_url: string;
  trailer_url: string;
  video_embed_url: string;
  watch_url: string;
  video_provider: string;
  platform_name: string;
  availability_type: string;
  language: string;
  quality: string;
  duration_minutes: string;
  release_date: string;
  status: string;
  sort_order: string;
};

type SeasonFormState = {
  id?: string;
  localId: string;
  season_number: string;
  title: string;
  description: string;
  poster_url: string;
  banner_url: string;
  release_year: string;
  status: string;
  sort_order: string;
  collapsed: boolean;
  episodes: EpisodeFormState[];
};

const VIDEO_PROVIDER_OPTIONS = [
  { label: "Direct Video URL", value: "direct" },
  { label: "YouTube", value: "youtube" },
  { label: "Vimeo", value: "vimeo" },
  { label: "Embed", value: "embed" },
  { label: "Iframe", value: "iframe" },
  { label: "HLS", value: "hls" },
  { label: "M3U8", value: "m3u8" },
  { label: "Google Drive", value: "google_drive" },
  { label: "External OTT Link", value: "external_ott_link" },
  { label: "No playable video", value: "none" },
  { label: "Other", value: "other" }
];

const STATUS_OPTIONS = ["draft", "published", "archived"];

function normalizeVideoProvider(value?: string | null) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "direct";
  if (provider === "youtube_embed") return "youtube";
  if (provider === "external_legal_embed") return "embed";
  if (provider === "google drive" || provider === "googledrive") return "google_drive";
  if (VIDEO_PROVIDER_OPTIONS.some((option) => option.value === provider)) return provider;
  return "direct";
}

function localId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function toNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function toNullableNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && value.trim() ? numberValue : null;
}

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return error instanceof Error ? error.message : "Series save failed.";
  const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return [
    details.message ? String(details.message) : "Series save failed.",
    details.code ? `Code: ${String(details.code)}` : "",
    details.details ? `Details: ${String(details.details)}` : "",
    details.hint ? `Hint: ${String(details.hint)}` : ""
  ].filter(Boolean).join(" ");
}

async function saveSeriesViaApi(body: { seriesId?: string | null; payload: Record<string, unknown>; seasons?: unknown[] }) {
  const response = await fetch("/api/admin/series/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error || "Web series save failed.");
  }
  return result.series;
}

function makeEmptyEpisode(nextEpisodeNumber: number): EpisodeFormState {
  return {
    localId: localId("episode"),
    episode_number: String(nextEpisodeNumber),
    title: "",
    description: "",
    poster_url: "",
    banner_url: "",
    trailer_url: "",
    video_embed_url: "",
    watch_url: "",
    video_provider: "youtube",
    platform_name: "",
    availability_type: "unknown",
    language: "",
    quality: "",
    duration_minutes: "",
    release_date: "",
    status: "published",
    sort_order: String(nextEpisodeNumber)
  };
}

function makeEmptySeason(nextSeasonNumber: number): SeasonFormState {
  return {
    localId: localId("season"),
    season_number: String(nextSeasonNumber),
    title: "",
    description: "",
    poster_url: "",
    banner_url: "",
    release_year: "",
    status: "published",
    sort_order: String(nextSeasonNumber),
    collapsed: false,
    episodes: [makeEmptyEpisode(1)]
  };
}

function stateFromSeries(series: Series | null): SeasonFormState[] {
  if (!series?.seasons?.length) return [makeEmptySeason(1)];

  return series.seasons.map((season) => ({
    id: season.id,
    localId: season.id,
    season_number: String(season.season_number ?? 1),
    title: season.title ?? "",
    description: season.description ?? "",
    poster_url: season.poster_url ?? "",
    banner_url: season.banner_url ?? "",
    release_year: season.release_year ? String(season.release_year) : "",
    status: season.status || (season.is_published ? "published" : "draft"),
    sort_order: season.sort_order == null ? String(season.season_number ?? 1) : String(season.sort_order),
    collapsed: false,
    episodes: season.episodes?.length
      ? season.episodes.map((episode) => ({
          id: episode.id,
          localId: episode.id,
          episode_number: String(episode.episode_number ?? 1),
          title: episode.title ?? "",
          description: episode.description ?? "",
          poster_url: episode.poster_url ?? episode.thumbnail_url ?? "",
          banner_url: episode.banner_url ?? "",
          trailer_url: episode.trailer_url ?? "",
          video_embed_url: episode.video_embed_url ?? "",
          watch_url: episode.watch_url ?? "",
          video_provider: normalizeVideoProvider(episode.video_provider),
          platform_name: episode.platform_name ?? "",
          availability_type: episode.availability_type ?? "unknown",
          language: episode.language ?? "",
          quality: episode.quality ?? "",
          duration_minutes: episode.duration_minutes ? String(episode.duration_minutes) : "",
          release_date: episode.release_date ?? "",
          status: episode.status || (episode.is_published ? "published" : "draft"),
          sort_order: episode.sort_order == null ? String(episode.episode_number ?? 1) : String(episode.sort_order)
        }))
      : [makeEmptyEpisode(1)]
  }));
}

export default function AdminSeriesForm({
  genres,
  initialSeries = null,
  aiDraft = null,
  aiDraftVersion = 0,
  onSaved,
  onAddNew,
  onBackToSeries
}: {
  genres: Genre[];
  initialSeries?: Series | null;
  aiDraft?: AiImportDraft | null;
  aiDraftVersion?: number;
  onSaved?: (series: Series) => void;
  onAddNew?: () => void;
  onBackToSeries?: () => void;
}) {
  const isEditMode = Boolean(initialSeries?.id);
  const [title, setTitle] = useState(initialSeries?.title ?? "");
  const [slug, setSlug] = useState(initialSeries?.slug ?? "");
  const [description, setDescription] = useState(initialSeries?.description ?? "");
  const [posterUrl, setPosterUrl] = useState(initialSeries?.poster_url ?? "");
  const [bannerUrl, setBannerUrl] = useState(initialSeries?.banner_url ?? "");
  const [genre, setGenre] = useState(initialSeries?.genre ?? "");
  const [platformName, setPlatformName] = useState(initialSeries?.platform_name ?? "");
  const [accessType, setAccessType] = useState<AccessType>(normalizeAccessType(initialSeries?.access_type));
  const [language, setLanguage] = useState(initialSeries?.language ?? "");
  const [releaseYear, setReleaseYear] = useState(initialSeries?.release_year ? String(initialSeries.release_year) : "");
  const [rating, setRating] = useState(initialSeries?.rating ?? "");
  const [trailerUrl, setTrailerUrl] = useState(initialSeries?.trailer_url ?? "");
  const [videoEmbedUrl, setVideoEmbedUrl] = useState(initialSeries?.video_embed_url ?? "");
  const [videoProvider, setVideoProvider] = useState(normalizeVideoProvider(initialSeries?.video_provider));
  const [seriesStatus, setSeriesStatus] = useState(initialSeries?.status ?? "draft");
  const [isFeatured, setIsFeatured] = useState(Boolean(initialSeries?.is_featured));
  const [isLatest, setIsLatest] = useState(Boolean(initialSeries?.is_latest));
  const [isTrending, setIsTrending] = useState(Boolean(initialSeries?.is_trending));
  const [isHindiDubbed, setIsHindiDubbed] = useState(Boolean(initialSeries?.is_hindi_dubbed));
  const [isFreeLegal, setIsFreeLegal] = useState(Boolean(initialSeries?.is_free_legal));
  const [isOfficial, setIsOfficial] = useState(Boolean(initialSeries?.is_official));
  const [seoTitle, setSeoTitle] = useState(initialSeries?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(initialSeries?.seo_description ?? "");
  const [seasons, setSeasons] = useState<SeasonFormState[]>(() => stateFromSeries(initialSeries));
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const posterFileRef = useRef<HTMLInputElement | null>(null);
  const bannerFileRef = useRef<HTMLInputElement | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    setTitle(initialSeries?.title ?? "");
    setSlug(initialSeries?.slug ?? "");
    setDescription(initialSeries?.description ?? "");
    setPosterUrl(initialSeries?.poster_url ?? "");
    setBannerUrl(initialSeries?.banner_url ?? "");
    setGenre(initialSeries?.genre ?? "");
    setPlatformName(initialSeries?.platform_name ?? "");
    setAccessType(normalizeAccessType(initialSeries?.access_type));
    setLanguage(initialSeries?.language ?? "");
    setReleaseYear(initialSeries?.release_year ? String(initialSeries.release_year) : "");
    setRating(initialSeries?.rating ?? "");
    setTrailerUrl(initialSeries?.trailer_url ?? "");
    setVideoEmbedUrl(initialSeries?.video_embed_url ?? "");
    setVideoProvider(normalizeVideoProvider(initialSeries?.video_provider));
    setSeriesStatus(initialSeries?.status ?? "draft");
    setIsFeatured(Boolean(initialSeries?.is_featured));
    setIsLatest(Boolean(initialSeries?.is_latest));
    setIsTrending(Boolean(initialSeries?.is_trending));
    setIsHindiDubbed(Boolean(initialSeries?.is_hindi_dubbed));
    setIsFreeLegal(Boolean(initialSeries?.is_free_legal));
    setIsOfficial(Boolean(initialSeries?.is_official));
    setSeoTitle(initialSeries?.seo_title ?? "");
    setSeoDescription(initialSeries?.seo_description ?? "");
    setSeasons(stateFromSeries(initialSeries));
    setMessage(null);
    setPosterPreview(null);
    setBannerPreview(null);
  }, [initialSeries]);

  useEffect(() => {
    if (!aiDraft || isEditMode) return;
    applyAiDraftToSeries(aiDraft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftVersion]);

  const seasonCount = seasons.length;
  const episodeCount = useMemo(() => seasons.reduce((total, season) => total + season.episodes.length, 0), [seasons]);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) setSlug(slugify(value));
  }

  function applyAiDraftToSeries(draft: AiImportDraft) {
    const nextTitle = draft.title || draft.extractedTitle || "";
    setTitle(nextTitle);
    setSlug(slugify(draft.slug || nextTitle));
    setDescription(draft.description || draft.storyOverview || "");
    setPosterUrl(draft.posterUrl || "");
    setBannerUrl(draft.bannerUrl || "");
    setGenre((draft.genres || []).join(", "));
    setPlatformName(draft.platform?.name || "");
    setAccessType(normalizeAccessType(draft.accessType));
    setLanguage(draft.language || "");
    setReleaseYear(draft.releaseYear ? String(draft.releaseYear) : "");
    setRating(draft.rating ? String(Number(draft.rating).toFixed(1)) : "");
    setTrailerUrl(draft.trailerUrl || "");
    setVideoEmbedUrl("");
    setVideoProvider(draft.trailerUrl ? "youtube" : "direct");
    setSeriesStatus("draft");
    setIsFeatured(false);
    setIsLatest(false);
    setIsTrending(false);
    setIsHindiDubbed([...(draft.tags || []), ...(draft.keywords || []), draft.language || ""].join(" ").toLowerCase().includes("hindi dubbed"));
    setIsFreeLegal(false);
    setIsOfficial(Boolean(draft.trailerUrl || draft.officialWatchUrl));
    setSeoTitle(draft.seoTitle || "");
    setSeoDescription(draft.seoDescription || "");
    setPosterPreview(draft.posterUrl || null);
    setBannerPreview(draft.bannerUrl || null);
    setSeasons(draft.seasons.length ? draft.seasons.map((season) => ({
      localId: localId("season"),
      season_number: String(season.seasonNumber),
      title: season.title || `Season ${season.seasonNumber}`,
      description: season.description || "",
      poster_url: season.posterUrl || draft.posterUrl || "",
      banner_url: draft.bannerUrl || "",
      release_year: season.airDate ? String(season.airDate).slice(0, 4) : draft.releaseYear ? String(draft.releaseYear) : "",
      status: "draft",
      sort_order: String(season.seasonNumber),
      collapsed: false,
      episodes: season.episodes.length ? season.episodes.map((episode) => ({
        localId: localId("episode"),
        episode_number: String(episode.episodeNumber),
        title: episode.title || `Episode ${episode.episodeNumber}`,
        description: episode.description || "",
        poster_url: episode.posterUrl || episode.stillUrl || season.posterUrl || draft.posterUrl || "",
        banner_url: episode.stillUrl || draft.bannerUrl || "",
        trailer_url: episode.trailerUrl || "",
        video_embed_url: "",
        watch_url: episode.watchUrl || draft.officialWatchUrl || "",
        video_provider: episode.trailerUrl ? "youtube" : "direct",
        platform_name: episode.platformName || draft.platform?.name || "",
        availability_type: episode.accessType === "premium" ? "subscription" : episode.accessType === "rent" ? "rent" : episode.accessType || "unknown",
        language: episode.language || draft.language || "",
        quality: "",
        duration_minutes: episode.runtimeMinutes ? String(episode.runtimeMinutes) : "",
        release_date: episode.airDate || "",
        status: "draft",
        sort_order: String(episode.episodeNumber)
      })) : [makeEmptyEpisode(1)]
    })) : [makeEmptySeason(1)]);
    setMessage({
      type: "success",
      text: `AI Auto Fill filled ${nextTitle}. Status is Draft. Review seasons and episodes before saving.`
    });
  }

  function updateSeason(localSeasonId: string, patch: Partial<SeasonFormState>) {
    setSeasons((current) => current.map((season) => season.localId === localSeasonId ? { ...season, ...patch } : season));
  }

  function updateEpisode(localSeasonId: string, localEpisodeId: string, patch: Partial<EpisodeFormState>) {
    setSeasons((current) => current.map((season) => {
      if (season.localId !== localSeasonId) return season;
      return {
        ...season,
        episodes: season.episodes.map((episode) => episode.localId === localEpisodeId ? { ...episode, ...patch } : episode)
      };
    }));
  }

  function addSeason() {
    setSeasons((current) => [...current, makeEmptySeason(current.length + 1)]);
  }

  function deleteSeason(localSeasonId: string) {
    const season = seasons.find((item) => item.localId === localSeasonId);
    if (!season) return;
    if (!window.confirm(`Delete Season ${season.season_number}? All episodes inside this season will also be removed after saving.`)) return;
    setSeasons((current) => current.filter((item) => item.localId !== localSeasonId));
  }

  function addEpisode(localSeasonId: string) {
    setSeasons((current) => current.map((season) => {
      if (season.localId !== localSeasonId) return season;
      return {
        ...season,
        episodes: [...season.episodes, makeEmptyEpisode(season.episodes.length + 1)]
      };
    }));
  }

  function deleteEpisode(localSeasonId: string, localEpisodeId: string) {
    if (!window.confirm("Delete this episode from the season? It will be removed from Supabase after saving.")) return;
    setSeasons((current) => current.map((season) => {
      if (season.localId !== localSeasonId) return season;
      return {
        ...season,
        episodes: season.episodes.filter((episode) => episode.localId !== localEpisodeId)
      };
    }));
  }

  function moveEpisode(localSeasonId: string, localEpisodeId: string, targetSeasonId: string) {
    if (localSeasonId === targetSeasonId) return;
    setSeasons((current) => {
      const sourceSeason = current.find((season) => season.localId === localSeasonId);
      const episode = sourceSeason?.episodes.find((item) => item.localId === localEpisodeId);
      if (!episode) return current;
      return current.map((season) => {
        if (season.localId === localSeasonId) {
          return { ...season, episodes: season.episodes.filter((item) => item.localId !== localEpisodeId) };
        }
        if (season.localId === targetSeasonId) {
          return {
            ...season,
            episodes: [
              ...season.episodes,
              { ...episode, episode_number: String(season.episodes.length + 1), sort_order: String(season.episodes.length + 1) }
            ]
          };
        }
        return season;
      });
    });
  }

  function updatePreview(event: ChangeEvent<HTMLInputElement>, type: "poster" | "banner") {
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

  function validate() {
    if (!title.trim()) return "Series title is required.";
    if (!slug.trim()) return "Series slug is required.";

    const seenSeasons = new Set<string>();
    for (const season of seasons) {
      if (!season.season_number.trim()) return "Every season needs a season number.";
      if (seenSeasons.has(season.season_number.trim())) return `Duplicate Season ${season.season_number}. Use a unique season number.`;
      seenSeasons.add(season.season_number.trim());

      const seenEpisodes = new Set<string>();
      for (const episode of season.episodes) {
        if (!episode.episode_number.trim()) return `Season ${season.season_number} has an episode without an episode number.`;
        if (!episode.title.trim()) return `Season ${season.season_number}, Episode ${episode.episode_number} needs a title.`;
        if (!episode.trailer_url.trim() && !episode.video_embed_url.trim() && !episode.watch_url.trim()) {
          return `Season ${season.season_number}, Episode ${episode.episode_number} needs a trailer, embed, or watch URL.`;
        }
        if (seenEpisodes.has(episode.episode_number.trim())) return `Season ${season.season_number} has duplicate Episode ${episode.episode_number}.`;
        seenEpisodes.add(episode.episode_number.trim());
      }
    }

    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage({ type: "info", text: "Saving web series..." });

    try {
      const validationError = validate();
      if (validationError) {
        setMessage({ type: "error", text: validationError });
        return;
      }

      const primaryEpisodeWatchUrl = seasons
        .flatMap((season) => season.episodes)
        .map((episode) => episode.watch_url.trim())
        .find(Boolean) || null;
      const primaryEpisodePlatform = seasons
        .flatMap((season) => season.episodes)
        .map((episode) => episode.platform_name.trim())
        .find(Boolean) || null;

      const seriesPayload = {
        title: title.trim(),
        slug,
        description: toNullableString(description),
        poster_url: toNullableString(posterUrl),
        banner_url: toNullableString(bannerUrl),
        genre: toNullableString(genre),
        platform_name: toNullableString(platformName),
        access_type: accessType,
        language: toNullableString(language),
        release_year: toNullableNumber(releaseYear),
        rating: toNullableString(rating),
        trailer_url: toNullableString(trailerUrl),
        video_embed_url: toNullableString(videoEmbedUrl),
        video_provider: normalizeVideoProvider(videoProvider),
        official_watch_url: primaryEpisodeWatchUrl,
        watch_url: primaryEpisodeWatchUrl,
        official_platform: toNullableString(platformName) || primaryEpisodePlatform,
        open_mode: "auto",
        status: seriesStatus,
        is_featured: isFeatured,
        is_latest: isLatest,
        is_trending: isTrending,
        is_hindi_dubbed: isHindiDubbed,
        is_free_legal: isFreeLegal,
        is_official: isOfficial,
        seo_title: toNullableString(seoTitle),
        seo_description: toNullableString(seoDescription),
        metadata_confidence: aiDraft ? aiDraft.metadataConfidence ?? aiDraft.qualityScore?.score ?? null : null,
        quality_score: aiDraft?.qualityScore?.score ?? null,
        metadata_source: aiDraft?.sourceLabel || aiDraft?.source || null
      };

      const seasonsPayload = seasons.map((season) => ({
        id: season.id,
        season_number: toNullableNumber(season.season_number),
        title: toNullableString(season.title),
        description: toNullableString(season.description),
        poster_url: toNullableString(season.poster_url),
        banner_url: toNullableString(season.banner_url),
        release_year: toNullableNumber(season.release_year),
        status: season.status,
        sort_order: toNullableNumber(season.sort_order) ?? toNullableNumber(season.season_number),
        episodes: season.episodes.map((episode) => ({
          id: episode.id,
          episode_number: toNullableNumber(episode.episode_number),
          title: episode.title.trim(),
          description: toNullableString(episode.description),
          duration_minutes: toNullableNumber(episode.duration_minutes),
          release_date: toNullableString(episode.release_date),
          poster_url: toNullableString(episode.poster_url),
          banner_url: toNullableString(episode.banner_url),
          trailer_url: toNullableString(episode.trailer_url),
          video_embed_url: toNullableString(episode.video_embed_url),
          watch_url: toNullableString(episode.watch_url),
          video_provider: normalizeVideoProvider(episode.video_provider),
          platform_name: toNullableString(episode.platform_name),
          availability_type: toNullableString(episode.availability_type),
          language: toNullableString(episode.language),
          quality: toNullableString(episode.quality),
          status: episode.status,
          sort_order: toNullableNumber(episode.sort_order) ?? toNullableNumber(episode.episode_number)
        }))
      }));

      let confirmed = await saveSeriesViaApi({
        seriesId: initialSeries?.id,
        payload: seriesPayload,
        seasons: seasonsPayload
      });

      const savedSeriesId = confirmed.id as string;
      setSlug(confirmed.slug);

      const imageUpdate: Record<string, string> = {};
      const posterFile = posterFileRef.current?.files?.[0];
      const bannerFile = bannerFileRef.current?.files?.[0];
      if (posterFile) imageUpdate.poster_url = await uploadPublicFile(storageBuckets.posters, `series/${savedSeriesId}/poster`, posterFile);
      if (bannerFile) imageUpdate.banner_url = await uploadPublicFile(storageBuckets.banners, `series/${savedSeriesId}/banner`, bannerFile);
      if (Object.keys(imageUpdate).length) {
        confirmed = await saveSeriesViaApi({
          seriesId: savedSeriesId,
          payload: imageUpdate
        });
      }

      const normalized: Series = {
        ...confirmed,
        is_published: confirmed.status === "published",
        seasons: (confirmed.seasons ?? []).sort((a: any, b: any) => (a.sort_order ?? a.season_number) - (b.sort_order ?? b.season_number)).map((season: any) => ({
          ...season,
          is_published: season.status === "published",
          episodes: (season.episodes ?? []).sort((a: any, b: any) => (a.sort_order ?? a.episode_number) - (b.sort_order ?? b.episode_number)).map((episode: any) => ({
            ...episode,
            thumbnail_url: episode.poster_url ?? episode.banner_url ?? null,
            video_url: episode.video_embed_url ?? episode.trailer_url ?? episode.watch_url ?? "",
            duration: episode.duration_minutes ? `${episode.duration_minutes}m` : null,
            is_published: episode.status === "published"
          }))
        })),
        season_count: (confirmed.seasons ?? []).length,
        episode_count: (confirmed.seasons ?? []).reduce((total: number, season: any) => total + (season.episodes?.length ?? 0), 0)
      };
      setMessage({
        type: "success",
        text: `${isEditMode ? "Web series updated." : "Web series saved."} ${normalized.status === "published" ? "Published series can appear publicly when seasons and episodes are also published." : `Saved as ${normalized.status || "draft"}.`} Final slug: ${normalized.slug}.`
      });
      onSaved?.(normalized);
    } catch (error) {
      setMessage({ type: "error", text: formatSupabaseError(error) });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="form-grid panel admin-series-form" onSubmit={submit}>
      <div className="section-head">
        <div>
          <h2>{isEditMode ? "Edit Web Series" : "Add Web Series"}</h2>
          <p className="muted">Create legal series listings with seasons and episodes. Public users only see published series, seasons, and episodes.</p>
        </div>
        <div className="series-count-pill">
          <strong>{seasonCount}</strong> Seasons
          <span>{episodeCount} Episodes</span>
        </div>
      </div>

      <fieldset className="admin-form-section">
        <legend>Series Basic Details</legend>
        <p className="form-helper">Use strong artwork and clear metadata. Keep as draft until the series is ready.</p>
        <div className="form-grid two">
          <div className="field"><label>Series Title <span className="required">*</span></label><input required value={title} onChange={(event) => updateTitle(event.target.value)} /></div>
          <div className="field"><label>Slug <span className="required">*</span></label><input required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} /></div>
          <div className="field"><label>Poster Image URL</label><input value={posterUrl} onChange={(event) => setPosterUrl(event.target.value)} placeholder="https://..." /></div>
          <div className="field"><label>Poster Upload</label><input ref={posterFileRef} type="file" accept="image/*" onChange={(event) => updatePreview(event, "poster")} /></div>
          <div className="field"><label>Banner Image URL</label><input value={bannerUrl} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://..." /></div>
          <div className="field"><label>Banner Upload</label><input ref={bannerFileRef} type="file" accept="image/*" onChange={(event) => updatePreview(event, "banner")} /></div>
          <div className="field"><label>Genre</label><input list="series-genres" value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="Drama, Action, Thriller" /><datalist id="series-genres">{genres.map((item) => <option key={item.id} value={item.name} />)}</datalist></div>
          <div className="field"><label>Platform</label><input value={platformName} onChange={(event) => setPlatformName(event.target.value)} placeholder="Netflix, Prime Video, YouTube" /></div>
          <div className="field">
            <label>Access Type</label>
            <select value={accessType} onChange={(event) => setAccessType(normalizeAccessType(event.target.value))}>
              {ACCESS_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small className="form-helper">Auto-filled by AI. Badge: {accessTypeMeta(accessType).label} - {accessTypeMeta(accessType).detail}.</small>
          </div>
          <div className="field"><label>Language</label><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">Select language</option>{WATCHFINDER_LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="field"><label>Release Year</label><input inputMode="numeric" value={releaseYear} onChange={(event) => setReleaseYear(event.target.value)} /></div>
          <div className="field"><label>Rating</label><input value={rating} onChange={(event) => setRating(event.target.value)} placeholder="8.4 or TV-14" /></div>
          <div className="field"><label>Trailer URL</label><input value={trailerUrl} onChange={(event) => setTrailerUrl(event.target.value)} placeholder="Official trailer URL" /></div>
          <div className="field"><label>Video Provider</label><select value={videoProvider} onChange={(event) => setVideoProvider(normalizeVideoProvider(event.target.value))}>{VIDEO_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="field"><label>Video Embed URL</label><input value={videoEmbedUrl} onChange={(event) => setVideoEmbedUrl(event.target.value)} placeholder="Optional official embed" /></div>
          <div className="field"><label>Visibility Status</label><select value={seriesStatus} onChange={(event) => setSeriesStatus(event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        </div>
        <div className="field"><label>Description / Story</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="option-group compact-options">
          <label className="option-card"><input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} /> <span>Featured</span></label>
          <label className="option-card"><input type="checkbox" checked={isLatest} onChange={(event) => setIsLatest(event.target.checked)} /> <span>Latest</span></label>
          <label className="option-card"><input type="checkbox" checked={isTrending} onChange={(event) => setIsTrending(event.target.checked)} /> <span>Trending</span></label>
          <label className="option-card"><input type="checkbox" checked={isHindiDubbed} onChange={(event) => setIsHindiDubbed(event.target.checked)} /> <span>Hindi Dubbed</span></label>
          <label className="option-card"><input type="checkbox" checked={isFreeLegal} onChange={(event) => setIsFreeLegal(event.target.checked)} /> <span>Free Legal</span></label>
          <label className="option-card"><input type="checkbox" checked={isOfficial} onChange={(event) => setIsOfficial(event.target.checked)} /> <span>Official</span></label>
        </div>
        <div className="form-grid two">
          <div className="field"><label>SEO Title</label><input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} /></div>
          <div className="field"><label>SEO Description</label><input value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} /></div>
        </div>
        <div className="form-grid two">
          {posterPreview || posterUrl ? <img className="image-preview poster-preview" src={posterPreview || posterUrl} alt="Series poster preview" /> : null}
          {bannerPreview || bannerUrl ? <img className="image-preview banner-preview" src={bannerPreview || bannerUrl} alt="Series banner preview" /> : null}
        </div>
      </fieldset>

      <fieldset className="admin-form-section">
        <legend>Seasons and Episodes</legend>
        <p className="form-helper">Add seasons, then add episodes inside each season. Published episodes remain hidden unless their season and series are also published.</p>
        <div className="season-stack">
          {seasons.map((season) => (
            <article className="series-season-editor" key={season.localId}>
              <div className="series-season-editor-head">
                <button className="season-collapse-button" type="button" onClick={() => updateSeason(season.localId, { collapsed: !season.collapsed })} aria-label={season.collapsed ? "Expand season" : "Collapse season"}>
                  {season.collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
                <div>
                  <strong>Season {season.season_number || "?"}</strong>
                  <p className="muted">{season.episodes.length} episodes - {season.status}</p>
                </div>
                <div className="series-editor-actions">
                  <button className="button ghost" type="button" onClick={() => addEpisode(season.localId)}>
                    <Plus size={16} /> Add Episode
                  </button>
                  <button className="button danger" type="button" onClick={() => deleteSeason(season.localId)}>
                    <Trash2 size={16} /> Delete Season
                  </button>
                </div>
              </div>

              {!season.collapsed ? (
                <div className="series-season-editor-body">
                  <div className="form-grid two">
                    <div className="field"><label>Season Number</label><input inputMode="numeric" value={season.season_number} onChange={(event) => updateSeason(season.localId, { season_number: event.target.value })} /></div>
                    <div className="field"><label>Season Title</label><input value={season.title} onChange={(event) => updateSeason(season.localId, { title: event.target.value })} /></div>
                    <div className="field"><label>Season Poster</label><input value={season.poster_url} onChange={(event) => updateSeason(season.localId, { poster_url: event.target.value })} placeholder="Optional URL" /></div>
                    <div className="field"><label>Season Banner</label><input value={season.banner_url} onChange={(event) => updateSeason(season.localId, { banner_url: event.target.value })} placeholder="Optional URL" /></div>
                    <div className="field"><label>Release Year</label><input inputMode="numeric" value={season.release_year} onChange={(event) => updateSeason(season.localId, { release_year: event.target.value })} /></div>
                    <div className="field"><label>Sort Order</label><input inputMode="numeric" value={season.sort_order} onChange={(event) => updateSeason(season.localId, { sort_order: event.target.value })} /></div>
                    <div className="field"><label>Status</label><select value={season.status} onChange={(event) => updateSeason(season.localId, { status: event.target.value })}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                  </div>
                  <div className="field"><label>Season Description</label><textarea value={season.description} onChange={(event) => updateSeason(season.localId, { description: event.target.value })} /></div>

                  <div className="episode-editor-stack">
                    {season.episodes.map((episode) => (
                      <div className="episode-editor-card" key={episode.localId}>
                        <div className="section-head compact">
                          <div>
                            <strong>Episode {episode.episode_number || "?"}</strong>
                            <p className="muted">{episode.status}</p>
                          </div>
                          <button className="button danger" type="button" onClick={() => deleteEpisode(season.localId, episode.localId)}>
                            <Trash2 size={16} /> Delete Episode
                          </button>
                        </div>
                        <div className="form-grid two">
                          <div className="field"><label>Episode Number</label><input inputMode="numeric" value={episode.episode_number} onChange={(event) => updateEpisode(season.localId, episode.localId, { episode_number: event.target.value })} /></div>
                          <div className="field"><label>Episode Title <span className="required">*</span></label><input value={episode.title} onChange={(event) => updateEpisode(season.localId, episode.localId, { title: event.target.value })} /></div>
                          <div className="field"><label>Episode Poster</label><input value={episode.poster_url} onChange={(event) => updateEpisode(season.localId, episode.localId, { poster_url: event.target.value })} /></div>
                          <div className="field"><label>Episode Banner</label><input value={episode.banner_url} onChange={(event) => updateEpisode(season.localId, episode.localId, { banner_url: event.target.value })} /></div>
                          <div className="field"><label>Trailer URL</label><input value={episode.trailer_url} onChange={(event) => updateEpisode(season.localId, episode.localId, { trailer_url: event.target.value })} placeholder="YouTube or official trailer URL" /></div>
                          <div className="field"><label>Video Embed URL</label><input value={episode.video_embed_url} onChange={(event) => updateEpisode(season.localId, episode.localId, { video_embed_url: event.target.value })} placeholder="Official embed URL" /></div>
                          <div className="field"><label>Watch URL</label><input value={episode.watch_url} onChange={(event) => updateEpisode(season.localId, episode.localId, { watch_url: event.target.value })} placeholder="Official OTT/app/page link" /></div>
                          <div className="field"><label>Video Provider</label><select value={episode.video_provider} onChange={(event) => updateEpisode(season.localId, episode.localId, { video_provider: normalizeVideoProvider(event.target.value) })}>{VIDEO_PROVIDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                          <div className="field"><label>Platform</label><input value={episode.platform_name} onChange={(event) => updateEpisode(season.localId, episode.localId, { platform_name: event.target.value })} placeholder="JioHotstar, YouTube, Netflix" /></div>
                          <div className="field"><label>Availability</label><select value={episode.availability_type} onChange={(event) => updateEpisode(season.localId, episode.localId, { availability_type: event.target.value })}><option value="unknown">Unknown</option><option value="free">Free</option><option value="subscription">Subscription</option><option value="rent">Rent</option><option value="buy">Buy</option></select></div>
                          <div className="field"><label>Language</label><select value={episode.language} onChange={(event) => updateEpisode(season.localId, episode.localId, { language: event.target.value })}><option value="">Select language</option>{WATCHFINDER_LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                          <div className="field"><label>Quality</label><input value={episode.quality} onChange={(event) => updateEpisode(season.localId, episode.localId, { quality: event.target.value })} placeholder="1080p, 4K" /></div>
                          <div className="field"><label>Runtime Minutes</label><input inputMode="numeric" value={episode.duration_minutes} onChange={(event) => updateEpisode(season.localId, episode.localId, { duration_minutes: event.target.value })} placeholder="42" /></div>
                          <div className="field"><label>Release Date</label><input type="date" value={episode.release_date} onChange={(event) => updateEpisode(season.localId, episode.localId, { release_date: event.target.value })} /></div>
                          <div className="field"><label>Sort Order</label><input inputMode="numeric" value={episode.sort_order} onChange={(event) => updateEpisode(season.localId, episode.localId, { sort_order: event.target.value })} /></div>
                          <div className="field"><label>Status</label><select value={episode.status} onChange={(event) => updateEpisode(season.localId, episode.localId, { status: event.target.value })}>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                          <div className="field"><label>Move to Season</label><select value={season.localId} onChange={(event) => moveEpisode(season.localId, episode.localId, event.target.value)}>{seasons.map((targetSeason) => <option key={targetSeason.localId} value={targetSeason.localId}>Season {targetSeason.season_number || "?"}</option>)}</select></div>
                        </div>
                        <div className="field"><label>Episode Description</label><textarea value={episode.description} onChange={(event) => updateEpisode(season.localId, episode.localId, { description: event.target.value })} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        <button className="button" type="button" onClick={addSeason}>
          <Plus size={18} /> Add Season
        </button>
      </fieldset>

      {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
      <div className="save-actions">
        <button className="button primary" type="submit" disabled={saving}>
          <Save size={18} /> {saving ? "Saving..." : isEditMode ? "Update Web Series" : "Save Web Series"}
        </button>
        {isEditMode ? <button className="button ghost" type="button" onClick={onAddNew}>Add New Series</button> : null}
        {onBackToSeries ? <button className="button" type="button" onClick={onBackToSeries}>Back to Web Series</button> : null}
      </div>
    </form>
  );
}
