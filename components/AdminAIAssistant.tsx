"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  Film,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  Rocket,
  Search,
  Sparkles,
  UploadCloud
} from "lucide-react";
import { slugify } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AiImportCandidate, AiImportDraft, AiImportMode, AiImportPlatform, AiImportResponse, AiImportResult } from "@/lib/ai-import-types";

type Message = {
  type: "success" | "error" | "info" | "warning";
  text: string;
};

type ImportTab = AiImportMode | "review" | "publish";

const STORAGE_KEY = "watchfinder_ai_import_review_draft";

const importTabs: Array<{
  id: ImportTab;
  title: string;
  helper: string;
}> = [
  { id: "url", title: "URL Import", helper: "Paste TMDb, IMDb, or official source URL." },
  { id: "imdb", title: "IMDb Import", helper: "Paste an IMDb title ID like tt0111161." },
  { id: "tmdb", title: "TMDb Import", helper: "Paste TMDb movie/TV ID or URL." },
  { id: "name", title: "Movie Name Search", helper: "Search by title, actor, director, or year." },
  { id: "bulk", title: "Bulk Import", helper: "Process up to 50 URLs, IDs, or titles." },
  { id: "auto", title: "Auto Generate", helper: "Generate a safe draft from whatever you paste." },
  { id: "review", title: "Review Data", helper: "Preview images, trailer, SEO, warnings." },
  { id: "publish", title: "Publish", helper: "Save as draft or publish after review." }
];

const AI_IMPORT_STEPS = [
  "Detecting platform",
  "Extracting title",
  "Searching metadata",
  "Fetching cast and trailer",
  "Preparing review"
];

function toNullableString(value?: string | null) {
  const clean = String(value || "").trim();
  return clean || null;
}

function toNumber(value?: number | string | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function compactList(values: Array<string | null | undefined>, limit = 5) {
  const clean = values.map((item) => String(item || "").trim()).filter(Boolean);
  if (!clean.length) return "Not fetched yet";
  const visible = clean.slice(0, limit);
  return clean.length > limit ? `${visible.join(", ")} +${clean.length - limit}` : visible.join(", ");
}

function formatMoney(value?: number | null) {
  if (!value) return "Not fetched";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 1
  }).format(value);
}

function formatRuntime(minutes?: number | null) {
  if (!minutes) return "Not fetched";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function statusClass(type: Message["type"]) {
  if (type === "success") return "form-message success";
  if (type === "error") return "form-message error";
  if (type === "warning") return "form-message warning";
  return "form-message info";
}

function safeProvider(url?: string | null) {
  return url?.includes("youtube.com") || url?.includes("youtu.be") ? "youtube" : "direct";
}

function platformLabel(platform?: AiImportPlatform | null) {
  return platform?.name || "Official Platform";
}

async function resolveUniqueSlug(table: "movies" | "web_series", requestedSlug: string, title: string) {
  const supabase = createSupabaseBrowserClient();
  const base = slugify(requestedSlug || title) || `watchfinder-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from(table).select("id, slug").like("slug", `${base}%`);
  if (error) throw error;

  const exactPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-(\\d+))?$`);
  const existing = new Set(
    (data || [])
      .map((item: { slug?: string | null }) => item.slug || "")
      .filter((item: string) => exactPattern.test(item))
  );
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function schemaHint(error: unknown) {
  const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const message = [
    value?.message ? String(value.message) : error instanceof Error ? error.message : "Save failed.",
    value?.code ? `Code: ${String(value.code)}` : "",
    value?.details ? `Details: ${String(value.details)}` : "",
    value?.hint ? `Hint: ${String(value.hint)}` : ""
  ].filter(Boolean).join(" ");

  if (message.includes("schema cache") || message.includes("Could not find") || String(value?.code) === "PGRST204") {
    return `${message} Run the latest WatchFinder migrations, then reload Supabase/PostgREST schema.`;
  }
  return message;
}

function draftToMoviePayload(draft: AiImportDraft, status: "draft" | "published", finalSlug: string) {
  const trailerProvider = safeProvider(draft.trailerUrl);
  const importedPlatform = platformLabel(draft.platform);
  const hasOfficialWatchUrl = Boolean(draft.officialWatchUrl);
  const platformSearchUrl = draft.platform?.searchUrl && draft.extractedTitle
    ? draft.platform.searchUrl.replace("{query}", encodeURIComponent(draft.title || draft.extractedTitle))
    : null;
  return {
    title: draft.title.trim(),
    slug: finalSlug,
    type: draft.contentType === "movie" ? "movie" : draft.contentType,
    content_type: draft.contentType === "web_series" ? "web_series" : draft.contentType,
    primary_section: "recently_added",
    show_in_hero: false,
    display_title: draft.title.trim(),
    original_title: toNullableString(draft.originalTitle),
    description: toNullableString(draft.description),
    short_description: toNullableString(draft.shortDescription),
    release_year: toNumber(draft.releaseYear),
    duration_minutes: toNumber(draft.runtimeMinutes),
    rating: toNumber(draft.rating),
    imdb_rating: toNumber(draft.rating),
    language: toNullableString(draft.language),
    primary_language: toNullableString(draft.language),
    languages_json: draft.language ? [draft.language] : [],
    genres_json: draft.genres,
    tags_json: draft.tags,
    cast_json: draft.cast,
    poster_url: toNullableString(draft.posterUrl),
    banner_url: toNullableString(draft.bannerUrl),
    thumbnail_url: toNullableString(draft.thumbnailUrl || draft.posterUrl),
    trailer_url: toNullableString(draft.trailerUrl),
    trailer_provider: draft.trailerUrl ? "youtube" : null,
    video_url: null,
    video_embed_url: null,
    video_provider: trailerProvider,
    video_id: null,
    official_platform: hasOfficialWatchUrl ? importedPlatform : draft.trailerUrl ? "YouTube" : null,
    platform_name: hasOfficialWatchUrl ? importedPlatform : draft.trailerUrl ? "YouTube" : null,
    official_watch_url: toNullableString(draft.officialWatchUrl),
    watch_url: toNullableString(draft.officialWatchUrl),
    platform_home_url: toNullableString(draft.platform?.homeUrl),
    platform_search_url: toNullableString(platformSearchUrl),
    app_deeplink: null,
    open_mode: hasOfficialWatchUrl ? "external" : draft.trailerUrl ? "trailer_modal" : "auto",
    mobile_web_supported: "unknown",
    desktop_web_supported: "unknown",
    app_required: false,
    quality: null,
    availability_type: hasOfficialWatchUrl ? "unknown" : draft.trailerUrl ? "official" : "unknown",
    director: toNullableString(draft.director),
    popularity_score: toNumber(draft.popularityScore) ?? 0,
    is_featured: false,
    is_latest: true,
    is_trending: false,
    is_hindi_dubbed: false,
    is_free_legal: false,
    is_official: Boolean(draft.trailerUrl || hasOfficialWatchUrl),
    has_licensed_video: false,
    status,
    seo_title: toNullableString(draft.seoTitle),
    seo_description: toNullableString(draft.seoDescription),
    og_image_url: toNullableString(draft.bannerUrl || draft.posterUrl),
    tmdb_id: toNumber(draft.tmdbId),
    imdb_id: toNullableString(draft.imdbId),
    ai_import_source: draft.source,
    ai_import_payload: draft,
    tagline: toNullableString(draft.tagline),
    original_language: toNullableString(draft.originalLanguage),
    country: toNullableString(draft.country),
    budget: toNumber(draft.budget),
    revenue: toNumber(draft.revenue),
    vote_count: toNumber(draft.voteCount),
    age_rating: toNullableString(draft.ageRating),
    production_companies_json: draft.productionCompanies,
    external_ids_json: {
      tmdb_id: draft.tmdbId ?? null,
      imdb_id: draft.imdbId ?? null
    }
  };
}

function draftToSeriesPayload(draft: AiImportDraft, status: "draft" | "published", finalSlug: string) {
  const importedPlatform = platformLabel(draft.platform);
  const hasOfficialWatchUrl = Boolean(draft.officialWatchUrl);
  return {
    title: draft.title.trim(),
    slug: finalSlug,
    description: toNullableString(draft.description),
    poster_url: toNullableString(draft.posterUrl),
    banner_url: toNullableString(draft.bannerUrl),
    genre: draft.genres.join(", ") || null,
    platform_name: draft.platform?.name || null,
    language: toNullableString(draft.language),
    release_year: toNumber(draft.releaseYear),
    rating: draft.rating ? String(Number(draft.rating).toFixed(1)) : null,
    trailer_url: toNullableString(draft.trailerUrl),
    video_embed_url: null,
    video_provider: safeProvider(draft.trailerUrl),
    official_watch_url: toNullableString(draft.officialWatchUrl),
    watch_url: toNullableString(draft.officialWatchUrl),
    official_platform: hasOfficialWatchUrl ? importedPlatform : draft.trailerUrl ? "YouTube" : null,
    open_mode: hasOfficialWatchUrl ? "external" : draft.trailerUrl ? "trailer_modal" : "auto",
    status,
    is_featured: false,
    is_latest: true,
    is_trending: false,
    is_hindi_dubbed: false,
    is_free_legal: false,
    is_official: Boolean(draft.trailerUrl),
    seo_title: toNullableString(draft.seoTitle),
    seo_description: toNullableString(draft.seoDescription)
  };
}

export default function AdminAIAssistant() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ImportTab>("url");
  const [input, setInput] = useState("");
  const [mediaType, setMediaType] = useState<"auto" | "movie" | "tv">("auto");
  const [includeSeasons, setIncludeSeasons] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AiImportDraft | null>(null);
  const [candidates, setCandidates] = useState<AiImportCandidate[]>([]);
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<AiImportPlatform | null>(null);
  const [officialWatchUrl, setOfficialWatchUrl] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<AiImportResult[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [importStageIndex, setImportStageIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDraft(JSON.parse(saved) as AiImportDraft);
    } catch {
      // Ignore a corrupt local review draft.
    }
  }, []);

  useEffect(() => {
    if (!draft) return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [draft]);

  const selectedDraftStats = useMemo(() => {
    if (!draft) return null;
    const episodeCount = draft.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
    return {
      imageCount: draft.images.length,
      seasonCount: draft.seasons.length,
      episodeCount,
      missingCount: draft.missingFields.length,
      warningCount: draft.qualityWarnings.length + draft.duplicateWarnings.length
    };
  }, [draft]);

  function updateDraft<K extends keyof AiImportDraft>(key: K, value: AiImportDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  async function runImport(tabOverride?: AiImportMode) {
    const mode = tabOverride || (activeTab === "review" || activeTab === "publish" ? "auto" : activeTab);
    if (!input.trim()) {
      setMessage({ type: "error", text: "Paste a URL, IMDb ID, TMDb ID, or movie/series name first." });
      return;
    }

    setLoading(true);
    setImportStageIndex(0);
    setMessage({ type: "info", text: "Detecting platform and title from the official link..." });
    const stageTimer = window.setInterval(() => {
      setImportStageIndex((current) => {
        if (current === null) return 0;
        return Math.min(current + 1, AI_IMPORT_STEPS.length - 1);
      });
    }, 900);
    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", mode, input, mediaType, includeSeasons })
      });
      const json = (await response.json()) as AiImportResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "Import failed.");

      if (json.results) {
        setBulkResults(json.results);
        const first = json.results.find((item) => item.ok && item.draft)?.draft || null;
        setDraft(first);
        setCandidates([]);
        setMessage({
          type: "success",
          text: `Bulk import finished. ${json.results.filter((item) => item.ok).length}/${json.results.length} drafts are ready for review.`
        });
      } else if (json.candidates?.length) {
        setCandidates(json.candidates);
        setExtractedTitle(json.extractedTitle || null);
        setDetectedPlatform(json.platform || null);
        setOfficialWatchUrl(input.trim().startsWith("http") ? input.trim() : null);
        setDraft(null);
        setBulkResults([]);
        setMessage({
          type: "success",
          text: `Found ${json.candidates.length} TMDb match${json.candidates.length === 1 ? "" : "es"} for "${json.extractedTitle || input}". Select the correct title to auto-fill.`
        });
      } else if (json.draft) {
        setDraft(json.draft);
        setCandidates([]);
        setExtractedTitle(json.draft.extractedTitle || null);
        setDetectedPlatform(json.draft.platform || null);
        setOfficialWatchUrl(json.draft.officialWatchUrl || (input.trim().startsWith("http") ? input.trim() : null));
        setBulkResults([]);
        setMessage({ type: "success", text: `${json.draft.sourceLabel} draft ready. Review before publishing.` });
      }
      setImportStageIndex(AI_IMPORT_STEPS.length - 1);
      setActiveTab("review");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "AI import failed." });
    } finally {
      window.clearInterval(stageTimer);
      setLoading(false);
      window.setTimeout(() => setImportStageIndex(null), 900);
    }
  }

  async function selectCandidate(candidate: AiImportCandidate) {
    setLoading(true);
    setMessage({ type: "info", text: `Fetching full TMDb details for ${candidate.title}...` });
    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "details",
          input,
          includeSeasons,
          tmdbId: candidate.tmdbId,
          selectedMediaType: candidate.mediaType,
          officialWatchUrl,
          extractedTitle,
          platform: detectedPlatform
        })
      });
      const json = (await response.json()) as AiImportResponse;
      if (!response.ok || !json.ok || !json.draft) throw new Error(json.error || "Full TMDb details could not be fetched.");
      setDraft(json.draft);
      setCandidates([]);
      setMessage({ type: "success", text: `${json.draft.title} is auto-filled from TMDb. Review before saving.` });
      setActiveTab("review");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Full TMDb details could not be fetched." });
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft(status: "draft" | "published") {
    if (!draft) {
      setMessage({ type: "error", text: "Fetch or select an import draft before saving." });
      return;
    }
    if (!draft.title.trim()) {
      setMessage({ type: "error", text: "Title is required before saving." });
      return;
    }

    setSaving(true);
    setMessage({ type: "info", text: status === "published" ? "Publishing reviewed import..." : "Saving reviewed import as draft..." });
    try {
      const supabase = createSupabaseBrowserClient();
      const isSeries = draft.contentType === "web_series";
      if (isSeries) {
        const finalSlug = await resolveUniqueSlug("web_series", draft.slug, draft.title);
        const { data: seriesRow, error: seriesError } = await supabase
          .from("web_series")
          .insert(draftToSeriesPayload(draft, status, finalSlug))
          .select("id, slug")
          .single();
        if (seriesError || !seriesRow) throw seriesError || new Error("Series row was not saved.");

        for (const season of draft.seasons) {
          const { data: seasonRow, error: seasonError } = await supabase
            .from("web_series_seasons")
            .insert({
              series_id: seriesRow.id,
              season_number: season.seasonNumber,
              title: toNullableString(season.title),
              description: toNullableString(season.description),
              poster_url: toNullableString(season.posterUrl),
              banner_url: toNullableString(draft.bannerUrl),
              release_year: season.airDate ? Number(String(season.airDate).slice(0, 4)) : null,
              status,
              sort_order: season.seasonNumber
            })
            .select("id")
            .single();
          if (seasonError || !seasonRow) throw seasonError || new Error(`Season ${season.seasonNumber} was not saved.`);

          const episodeRows = season.episodes.map((episode) => ({
            series_id: seriesRow.id,
            season_id: seasonRow.id,
            episode_number: episode.episodeNumber,
            title: episode.title,
            description: toNullableString(episode.description),
            duration_minutes: toNumber(episode.runtimeMinutes),
            release_date: toNullableString(episode.airDate),
            poster_url: toNullableString(episode.posterUrl || episode.stillUrl || season.posterUrl || draft.posterUrl),
            banner_url: toNullableString(episode.stillUrl || draft.bannerUrl),
            trailer_url: toNullableString(episode.trailerUrl),
            video_embed_url: null,
            watch_url: null,
            video_provider: safeProvider(episode.trailerUrl),
            platform_name: episode.trailerUrl ? "YouTube" : null,
            availability_type: episode.trailerUrl ? "official" : "unknown",
            language: toNullableString(draft.language),
            quality: null,
            status,
            sort_order: episode.episodeNumber
          }));
          if (episodeRows.length) {
            const { error: episodesError } = await supabase.from("web_series_episodes").insert(episodeRows);
            if (episodesError) throw episodesError;
          }
        }

        setMessage({ type: "success", text: `Web series ${status === "published" ? "published" : "saved as draft"}: ${seriesRow.slug}` });
      } else {
        const finalSlug = await resolveUniqueSlug("movies", draft.slug, draft.title);
        const { data: movieRow, error: movieError } = await supabase
          .from("movies")
          .insert(draftToMoviePayload(draft, status, finalSlug))
          .select("id, slug")
          .single();
        if (movieError || !movieRow) throw movieError || new Error("Movie row was not saved.");

        setMessage({ type: "success", text: `${draft.contentType === "movie" ? "Movie" : draft.contentType} ${status === "published" ? "published" : "saved as draft"}: ${movieRow.slug}` });
      }

      window.localStorage.removeItem(STORAGE_KEY);
      router.refresh();
      setActiveTab("publish");
    } catch (error) {
      setMessage({ type: "error", text: schemaHint(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section ai-assistant-shell">
      <div className="section-head">
        <div>
          <p className="rating-badge">Admin only</p>
          <h2><Sparkles size={24} /> AI Assistant</h2>
          <p className="muted">Import public metadata from TMDb/IMDb IDs or title search, review the draft, then save or publish safely.</p>
        </div>
        <div className="ai-source-stack">
          <span className="chip active">TMDb priority</span>
          <span className="chip">IMDb lookup</span>
          <span className="chip">YouTube trailer</span>
        </div>
      </div>

      {message ? <p className={statusClass(message.type)}>{message.text}</p> : null}

      <div className="ai-mode-grid">
        {importTabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "ai-mode-card active" : "ai-mode-card"}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <strong>{tab.title}</strong>
            <span>{tab.helper}</span>
          </button>
        ))}
      </div>

      <div className="ai-workbench">
        <div className="panel form-grid ai-import-panel">
          <div className="section-head compact">
            <div>
              <h3>{activeTab === "bulk" ? "Bulk Import Queue" : "Import Source"}</h3>
              <p className="muted">Only official/public metadata is fetched. Protected OTT video is never scraped or hosted.</p>
            </div>
            <UploadCloud size={22} />
          </div>

          <label className="field">
            <span>{activeTab === "bulk" ? "URLs, IMDb IDs, TMDb IDs, or titles" : "URL, IMDb ID, TMDb ID, or title"}</span>
            {activeTab === "bulk" ? (
              <textarea
                rows={8}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={"tt0111161\nhttps://www.themoviedb.org/movie/550\nMirzapur"}
              />
            ) : (
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste URL / IMDb ID / TMDb ID / movie or series name"
              />
            )}
          </label>

          <div className="form-grid two">
            <label className="field">
              <span>Content hint</span>
              <select value={mediaType} onChange={(event) => setMediaType(event.target.value as "auto" | "movie" | "tv")}>
                <option value="auto">Auto detect</option>
                <option value="movie">Movie</option>
                <option value="tv">Web Series / TV</option>
              </select>
            </label>
            <label className="language-select-chip ai-checkbox">
              <input checked={includeSeasons} onChange={(event) => setIncludeSeasons(event.target.checked)} type="checkbox" />
              Fetch seasons and episodes
            </label>
          </div>

          <div className="save-actions">
            <button className="button primary" disabled={loading} onClick={() => runImport(activeTab === "bulk" ? "bulk" : undefined)} type="button">
              {loading ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
              {loading ? "Fetching..." : "AI Fetch"}
            </button>
            <button className="button" onClick={() => setManualOpen((value) => !value)} type="button">
              <ClipboardList size={18} /> {manualOpen ? "Hide notes" : "Show workflow"}
            </button>
          </div>

          {importStageIndex !== null ? (
            <div className="ai-progress-steps" aria-live="polite">
              {AI_IMPORT_STEPS.map((step, index) => (
                <span
                  className={index <= importStageIndex ? "active" : ""}
                  key={step}
                >
                  {index < importStageIndex ? <CheckCircle2 size={13} /> : index === importStageIndex && loading ? <Loader2 className="spin-icon" size={13} /> : null}
                  {step}
                </span>
              ))}
            </div>
          ) : null}

          {manualOpen ? (
            <div className="notice-card">
              <strong>Import to AI Processing to Review to Publish</strong>
              <p className="muted">TMDb is the required metadata source. If a pasted OTT URL does not contain a readable title, use Movie Name Search and select the correct TMDb match.</p>
            </div>
          ) : null}

          {candidates.length ? (
            <div className="ai-candidate-panel">
              <div>
                <strong>TMDb matches</strong>
                <p className="muted">
                  {detectedPlatform ? `${detectedPlatform.name} URL detected. ` : ""}
                  {extractedTitle ? `Searching for "${extractedTitle}". ` : ""}
                  Select the exact movie/show to fetch full metadata.
                </p>
              </div>
              <div className="ai-candidate-grid">
                {candidates.map((candidate) => (
                  <button
                    className={`ai-candidate-card${candidate.isBestMatch ? " recommended" : ""}`}
                    disabled={loading}
                    key={`${candidate.mediaType}-${candidate.tmdbId}`}
                    onClick={() => selectCandidate(candidate)}
                    type="button"
                  >
                    {candidate.posterUrl ? <img alt={candidate.title} src={candidate.posterUrl} /> : <span className="ai-candidate-poster"><ImageIcon size={22} /></span>}
                    <span>
                      {candidate.isBestMatch ? <em className="ai-best-match-badge">Best match</em> : null}
                      <strong>{candidate.title}</strong>
                      <small>{candidate.mediaType === "tv" ? "Web Series" : "Movie"} {candidate.releaseYear ? `- ${candidate.releaseYear}` : ""}</small>
                      <small>{candidate.rating ? `Rating ${Number(candidate.rating).toFixed(1)}` : "TMDb result"}{candidate.confidence ? ` - ${Math.round(candidate.confidence)}% match` : ""}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="panel ai-review-panel">
          <div className="section-head compact">
            <div>
              <h3>Review Data</h3>
              <p className="muted">Preview what will be saved before anything becomes live.</p>
            </div>
            <Database size={22} />
          </div>

          {!draft ? (
            <div className="ai-empty-state">
              <Search size={32} />
              <strong>No import draft yet</strong>
              <p className="muted">Paste a source and click AI Fetch. Your review draft will auto-save locally while you work.</p>
            </div>
          ) : (
            <div className="ai-review-stack">
              <div className="ai-hero-preview">
                {draft.bannerUrl || draft.posterUrl ? (
                  <img alt={draft.title} src={draft.bannerUrl || draft.posterUrl || ""} />
                ) : (
                  <span><ImageIcon size={28} /> No banner</span>
                )}
                <div>
                  <span className="rating-badge">{draft.sourceLabel}</span>
                  <h3>{draft.title}</h3>
                  <p>{draft.shortDescription || draft.description || "Review and complete this draft before publishing."}</p>
                </div>
              </div>

              <div className="ai-stat-grid">
                <div className="admin-card"><strong>{draft.contentType.replace("_", " ")}</strong><p className="muted">Detected type</p></div>
                <div className="admin-card"><strong>{draft.releaseYear || "Unknown"}</strong><p className="muted">Release year</p></div>
                <div className="admin-card"><strong>{formatRuntime(draft.runtimeMinutes)}</strong><p className="muted">Runtime</p></div>
                <div className="admin-card"><strong>{draft.rating ? Number(draft.rating).toFixed(1) : "None"}</strong><p className="muted">Rating</p></div>
                <div className="admin-card"><strong>{selectedDraftStats?.seasonCount ?? 0}</strong><p className="muted">Seasons</p></div>
                <div className="admin-card"><strong>{selectedDraftStats?.episodeCount ?? 0}</strong><p className="muted">Episodes</p></div>
              </div>

              <div className="form-grid two">
                <label className="field">
                  <span>Title</span>
                  <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                </label>
                <label className="field">
                  <span>Slug</span>
                  <input value={draft.slug} onChange={(event) => updateDraft("slug", slugify(event.target.value))} />
                </label>
                <label className="field">
                  <span>Poster URL</span>
                  <input value={draft.posterUrl || ""} onChange={(event) => updateDraft("posterUrl", event.target.value)} />
                </label>
                <label className="field">
                  <span>Banner URL</span>
                  <input value={draft.bannerUrl || ""} onChange={(event) => updateDraft("bannerUrl", event.target.value)} />
                </label>
                <label className="field">
                  <span>Official watch URL</span>
                  <input value={draft.officialWatchUrl || ""} onChange={(event) => updateDraft("officialWatchUrl", event.target.value)} placeholder="Original Hotstar/Netflix/Prime/YouTube official URL" />
                </label>
                <label className="field">
                  <span>Detected platform</span>
                  <input
                    value={draft.platform?.name || ""}
                    onChange={(event) => updateDraft("platform", { key: slugify(event.target.value), name: event.target.value })}
                    placeholder="JioHotstar, Netflix, Prime Video"
                  />
                </label>
                <label className="field">
                  <span>Official trailer URL</span>
                  <input value={draft.trailerUrl || ""} onChange={(event) => updateDraft("trailerUrl", event.target.value)} />
                </label>
                <label className="field">
                  <span>SEO title</span>
                  <input value={draft.seoTitle} onChange={(event) => updateDraft("seoTitle", event.target.value)} />
                </label>
              </div>

              <label className="field">
                <span>Description / story overview</span>
                <textarea rows={5} value={draft.description || ""} onChange={(event) => updateDraft("description", event.target.value)} />
              </label>

              <div className="ai-detail-grid">
                <div>
                  <strong>Genres</strong>
                  <p className="muted">{compactList(draft.genres, 8)}</p>
                </div>
                <div>
                  <strong>Director</strong>
                  <p className="muted">{draft.director || "Not fetched"}</p>
                </div>
                <div>
                  <strong>Writers</strong>
                  <p className="muted">{compactList(draft.writers, 5)}</p>
                </div>
                <div>
                  <strong>Cast</strong>
                  <p className="muted">{compactList(draft.cast.map((person) => person.name), 8)}</p>
                </div>
                <div>
                  <strong>Production</strong>
                  <p className="muted">{compactList(draft.productionCompanies, 5)}</p>
                </div>
                <div>
                  <strong>Budget / revenue</strong>
                  <p className="muted">{formatMoney(draft.budget)} / {formatMoney(draft.revenue)}</p>
                </div>
              </div>

              {draft.images.length ? (
                <div>
                  <strong>Image previews</strong>
                  <div className="ai-image-grid">
                    {draft.images.slice(0, 8).map((image) => (
                      <figure key={`${image.kind}-${image.url}`}>
                        <img alt={image.label} src={image.url} />
                        <figcaption>{image.label}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.seasons.length ? (
                <div>
                  <strong>Seasons and episodes</strong>
                  <div className="ai-season-list">
                    {draft.seasons.map((season) => (
                      <details key={season.seasonNumber}>
                        <summary>Season {season.seasonNumber}: {season.title || "Untitled"} <span>{season.episodes.length} episodes</span></summary>
                        <div className="ai-episode-list">
                          {season.episodes.slice(0, 12).map((episode) => (
                            <p key={episode.episodeNumber}><strong>E{episode.episodeNumber}</strong> {episode.title} <span>{episode.airDate || ""}</span></p>
                          ))}
                          {season.episodes.length > 12 ? <p className="muted">+{season.episodes.length - 12} more episodes</p> : null}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : null}

              {(draft.missingFields.length || draft.duplicateWarnings.length || draft.qualityWarnings.length) ? (
                <div className="ai-warning-grid">
                  {draft.missingFields.length ? (
                    <div className="notice-card error">
                      <strong><AlertTriangle size={16} /> Missing fields</strong>
                      <p>{draft.missingFields.join(", ")}</p>
                    </div>
                  ) : null}
                  {draft.duplicateWarnings.length ? (
                    <div className="notice-card">
                      <strong><AlertTriangle size={16} /> Duplicate warnings</strong>
                      <p>{draft.duplicateWarnings.join(" ")}</p>
                    </div>
                  ) : null}
                  {draft.qualityWarnings.length ? (
                    <div className="notice-card">
                      <strong><AlertTriangle size={16} /> Quality warnings</strong>
                      <p>{draft.qualityWarnings.join(" ")}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="form-message success"><CheckCircle2 size={16} /> Quality check looks good. Review legal links before publishing.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {bulkResults.length ? (
        <div className="panel ai-bulk-results">
          <div className="section-head compact">
            <div>
              <h3>Bulk import results</h3>
              <p className="muted">Click any successful result to review and publish it.</p>
            </div>
            <ClipboardList size={22} />
          </div>
          <div className="ai-bulk-grid">
            {bulkResults.map((result) => (
              <button
                className={result.ok ? "ai-bulk-item" : "ai-bulk-item failed"}
                disabled={!result.ok || !result.draft}
                key={result.input}
                onClick={() => {
                  if (result.draft) {
                    setDraft(result.draft);
                    setActiveTab("review");
                  }
                }}
                type="button"
              >
                <strong>{result.draft?.title || result.input}</strong>
                <span>{result.ok ? "Ready for review" : result.error}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel ai-publish-panel">
        <div className="section-head compact">
          <div>
            <h3>Publish Workflow</h3>
            <p className="muted">Save first as draft when warnings remain. Publish only after verifying official/legal trailer and platform data.</p>
          </div>
          <Rocket size={22} />
        </div>
        <div className="ai-workflow-steps">
          <span className="active"><Search size={16} /> Import</span>
          <span className={draft ? "active" : ""}><Sparkles size={16} /> AI Processing</span>
          <span className={draft ? "active" : ""}><ClipboardList size={16} /> Review</span>
          <span><Rocket size={16} /> Publish</span>
        </div>
        <div className="save-actions">
          <button className="button" disabled={!draft || saving} onClick={() => saveDraft("draft")} type="button">
            {saving ? <Loader2 className="spin-icon" size={18} /> : <Film size={18} />} Save Draft
          </button>
          <button className="button primary" disabled={!draft || saving} onClick={() => saveDraft("published")} type="button">
            {saving ? <Loader2 className="spin-icon" size={18} /> : <PlayCircle size={18} />} Publish
          </button>
        </div>
      </div>
    </section>
  );
}
