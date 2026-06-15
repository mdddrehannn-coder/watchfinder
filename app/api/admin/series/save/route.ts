import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { normalizeAccessType } from "@/lib/access-type";
import { isAdminEmail } from "@/lib/admin-access";
import { slugify } from "@/lib/format";
import {
  isCoreMovieSaveColumn,
  missingMovieColumnFromError,
  sanitizeMoviePayload
} from "@/lib/movie-schema";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

type SaveSeriesRequest = {
  seriesId?: string | null;
  payload?: Record<string, unknown>;
  seasons?: Array<Record<string, unknown> & { episodes?: Array<Record<string, unknown>> }>;
};

function jsonError(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "Series save failed.");
  }
  return String(error || "Series save failed.");
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
}

function cleanString(value: unknown) {
  const clean = String(value || "").trim();
  return clean || null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanBoolean(value: unknown) {
  return Boolean(value);
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function setWhenPresent(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  sourceKey: string,
  targetKey: string,
  map: (value: unknown) => unknown,
  force = false
) {
  if (!force && !hasOwn(source, sourceKey)) return;
  target[targetKey] = map(source[sourceKey]);
}

function cleanStatus(value: unknown, fallback = "draft") {
  const status = cleanString(value) || fallback;
  return ["draft", "published", "archived"].includes(status) ? status : fallback;
}

function databaseMovieTypeForContentType(contentType?: string | null) {
  const value = cleanString(contentType) || "movie";
  if (value === "web_series") return "tv_show";
  return value;
}

function objectPayload(value: unknown) {
  return typeof value === "object" && value && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizeEpisodePayload(episode: Record<string, unknown>, seasonNumber: number) {
  const episodeNumber = cleanNumber(episode.episode_number) ?? 1;
  const id = cleanString(episode.id) || `episode-${seasonNumber}-${episodeNumber}`;
  return {
    id,
    episode_number: episodeNumber,
    title: cleanString(episode.title) || `Episode ${episodeNumber}`,
    description: cleanString(episode.description),
    duration_minutes: cleanNumber(episode.duration_minutes),
    release_date: cleanString(episode.release_date),
    poster_url: cleanString(episode.poster_url),
    banner_url: cleanString(episode.banner_url),
    trailer_url: cleanString(episode.trailer_url),
    video_embed_url: cleanString(episode.video_embed_url),
    watch_url: cleanString(episode.watch_url),
    video_provider: cleanString(episode.video_provider) || "direct",
    platform_name: cleanString(episode.platform_name),
    availability_type: cleanString(episode.availability_type) || "unknown",
    language: cleanString(episode.language),
    quality: cleanString(episode.quality),
    status: cleanStatus(episode.status, "published"),
    sort_order: cleanNumber(episode.sort_order) ?? episodeNumber
  };
}

function normalizeSeasonPayload(season: Record<string, unknown>) {
  const seasonNumber = cleanNumber(season.season_number) ?? 1;
  const episodes = Array.isArray(season.episodes) ? season.episodes : [];
  const id = cleanString(season.id) || `season-${seasonNumber}`;
  return {
    id,
    season_number: seasonNumber,
    title: cleanString(season.title),
    description: cleanString(season.description),
    poster_url: cleanString(season.poster_url),
    banner_url: cleanString(season.banner_url),
    release_year: cleanNumber(season.release_year),
    status: cleanStatus(season.status, "published"),
    sort_order: cleanNumber(season.sort_order) ?? seasonNumber,
    episodes: episodes.map((episode) => normalizeEpisodePayload(episode, seasonNumber))
  };
}

function normalizeSavedSeries(row: any) {
  const aiPayload = objectPayload(row.ai_import_payload);
  const webSeries = objectPayload(aiPayload.webSeries || aiPayload.web_series || aiPayload.series);
  const seasons = Array.isArray(webSeries.seasons) ? webSeries.seasons : Array.isArray(aiPayload.seasons) ? aiPayload.seasons : [];
  const normalizedSeasons = seasons.map((season: any) => ({
    ...season,
    is_published: season.status === "published",
    episodes: (Array.isArray(season.episodes) ? season.episodes : []).map((episode: any) => ({
      ...episode,
      series_id: row.id,
      season_id: season.id || `season-${season.season_number ?? 0}`,
      thumbnail_url: episode.thumbnail_url ?? episode.poster_url ?? episode.banner_url ?? null,
      video_url: episode.video_url ?? episode.video_embed_url ?? episode.trailer_url ?? episode.watch_url ?? "",
      duration: episode.duration ?? (episode.duration_minutes ? `${episode.duration_minutes}m` : null),
      is_published: episode.status === "published"
    }))
  }));

  return {
    ...row,
    type: "web_series",
    content_type: "web_series",
    genre: webSeries.genre || row.genre || null,
    platform_name: row.official_platform || webSeries.platform_name || null,
    access_type: row.access_type || webSeries.access_type || null,
    language: row.primary_language || row.language || webSeries.language || null,
    watch_url: row.watch_url || row.official_watch_url || null,
    is_published: row.status === "published",
    seasons: normalizedSeasons,
    season_count: normalizedSeasons.length,
    episode_count: normalizedSeasons.reduce((total: number, season: any) => total + (season.episodes?.length ?? 0), 0)
  };
}

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: jsonError("Supabase is not configured.", 500) };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: jsonError("Login required.", 401) };
  if (!isAdminEmail(data.user.email)) return { error: jsonError("Access denied", 403) };

  return { user: data.user };
}

async function resolveUniqueMovieSlug(admin: any, requestedSlug: string, excludeMovieId?: string | null) {
  const base = slugify(requestedSlug) || `series-${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from("movies")
    .select("id, slug")
    .like("slug", `${base}%`);

  if (error) throw error;

  const exactPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-(\\d+))?$`);
  const existingSlugs = new Set(
    (data || [])
      .filter((item: { id?: string | null; slug?: string | null }) => item.id !== excludeMovieId)
      .map((item: { slug?: string | null }) => item.slug || "")
      .filter((existingSlug: string) => exactPattern.test(existingSlug))
  );

  if (!existingSlugs.has(base)) return base;

  let suffix = 2;
  while (existingSlugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function saveMovieSeriesRow(admin: any, movieId: string | null, payload: Record<string, unknown>) {
  const safePayload = sanitizeMoviePayload(payload);
  const skippedColumns = new Set<string>();

  for (let attempt = 0; attempt < Object.keys(safePayload).length + 8; attempt += 1) {
    const { data, error } = movieId
      ? await admin.from("movies").update(safePayload).eq("id", movieId).select("*").single()
      : await admin.from("movies").insert(safePayload).select("*").single();

    if (!error && data) return { data, skippedColumns: Array.from(skippedColumns) };

    const missingColumn = missingMovieColumnFromError(error);
    if (
      missingColumn &&
      !isCoreMovieSaveColumn(missingColumn) &&
      Object.prototype.hasOwnProperty.call(safePayload, missingColumn)
    ) {
      delete safePayload[missingColumn];
      skippedColumns.add(missingColumn);
      continue;
    }

    throw error;
  }

  throw new Error("Series save failed: movies schema cache did not settle after removing unsupported optional columns.");
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);

  let body: SaveSeriesRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const requestedPayload = body.payload || {};
  const seriesId = cleanString(body.seriesId);
  const title = cleanString(requestedPayload.title);
  if (!seriesId && !title) return jsonError("Series title is required.");

  try {
    const seasons = Array.isArray(body.seasons) ? body.seasons.map(normalizeSeasonPayload) : null;
    let existingAiPayload: Record<string, any> = {};
    if (seriesId) {
      const { data: existing, error } = await admin
        .from("movies")
        .select("ai_import_payload")
        .eq("id", seriesId)
        .maybeSingle();
      if (error) throw error;
      existingAiPayload = objectPayload(existing?.ai_import_payload);
    }

    const originalRating = cleanString(requestedPayload.rating);
    const numericRating = cleanNumber(requestedPayload.rating);
    const officialWatchUrl = cleanString(requestedPayload.official_watch_url) || cleanString(requestedPayload.watch_url);
    const platformName = cleanString(requestedPayload.official_platform) || cleanString(requestedPayload.platform_name);
    const webSeriesPayload = {
      ...objectPayload(existingAiPayload.webSeries || existingAiPayload.web_series),
      seasons: seasons ?? objectPayload(existingAiPayload.webSeries || existingAiPayload.web_series).seasons ?? existingAiPayload.seasons ?? [],
      genre: cleanString(requestedPayload.genre),
      platform_name: platformName,
      access_type: normalizeAccessType(requestedPayload.access_type as string | null),
      language: cleanString(requestedPayload.language),
      rating_text: numericRating == null ? originalRating : null,
      season_count: seasons ? seasons.length : undefined,
      episode_count: seasons ? seasons.reduce((total, season) => total + season.episodes.length, 0) : undefined
    };

    const aiImportPayload = {
      ...existingAiPayload,
      webSeries: webSeriesPayload,
      content_type: "web_series"
    };

    const basePayload: Record<string, unknown> = {
      type: databaseMovieTypeForContentType("web_series"),
      content_type: "web_series",
      homepage_placement: "web_series",
      primary_section: "web_series",
      ai_import_source: "admin_web_series_form",
      ai_import_payload: aiImportPayload,
      metadata_source: "admin_web_series_form"
    };

    if (!seriesId || hasOwn(requestedPayload, "title")) basePayload.title = title;
    if (hasOwn(requestedPayload, "slug") || !seriesId) {
      basePayload.slug = await resolveUniqueMovieSlug(admin, String(requestedPayload.slug || title || "series"), seriesId);
    }
    setWhenPresent(basePayload, requestedPayload, "description", "description", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "release_year", "release_year", cleanNumber, !seriesId);
    if (!seriesId || hasOwn(requestedPayload, "rating")) basePayload.rating = numericRating;
    setWhenPresent(basePayload, requestedPayload, "director", "director", cleanString);
    setWhenPresent(basePayload, requestedPayload, "language", "primary_language", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "language", "language", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "poster_url", "poster_url", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "banner_url", "banner_url", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "trailer_url", "trailer_url", cleanString, !seriesId);
    if (!seriesId || hasOwn(requestedPayload, "trailer_url")) {
      basePayload.trailer_provider = cleanString(requestedPayload.trailer_url) ? "youtube" : null;
    }
    if (!seriesId || hasOwn(requestedPayload, "official_watch_url") || hasOwn(requestedPayload, "watch_url")) {
      basePayload.official_watch_url = officialWatchUrl;
    }
    if (!seriesId || hasOwn(requestedPayload, "official_platform") || hasOwn(requestedPayload, "platform_name")) {
      basePayload.official_platform = platformName;
    }
    if (!seriesId || hasOwn(requestedPayload, "access_type")) {
      basePayload.access_type = normalizeAccessType(requestedPayload.access_type as string | null);
    }
    if (!seriesId || hasOwn(requestedPayload, "status")) basePayload.status = cleanStatus(requestedPayload.status, "draft");
    if (!seriesId || hasOwn(requestedPayload, "is_featured")) basePayload.is_featured = cleanBoolean(requestedPayload.is_featured);
    if (!seriesId || hasOwn(requestedPayload, "is_latest")) basePayload.is_latest = cleanBoolean(requestedPayload.is_latest);
    if (!seriesId || hasOwn(requestedPayload, "is_trending")) basePayload.is_trending = cleanBoolean(requestedPayload.is_trending);
    if (!seriesId || hasOwn(requestedPayload, "is_hindi_dubbed")) basePayload.is_hindi_dubbed = cleanBoolean(requestedPayload.is_hindi_dubbed);
    if (!seriesId || hasOwn(requestedPayload, "is_free_legal")) basePayload.is_free_legal = cleanBoolean(requestedPayload.is_free_legal);
    if (!seriesId || hasOwn(requestedPayload, "is_official") || hasOwn(requestedPayload, "official_watch_url") || hasOwn(requestedPayload, "watch_url") || hasOwn(requestedPayload, "trailer_url")) {
      basePayload.is_official = cleanBoolean(requestedPayload.is_official) || Boolean(officialWatchUrl || requestedPayload.trailer_url);
    }
    setWhenPresent(basePayload, requestedPayload, "seo_title", "seo_title", cleanString, !seriesId);
    setWhenPresent(basePayload, requestedPayload, "seo_description", "seo_description", cleanString, !seriesId);

    if (basePayload.status === "published") basePayload.published_at = new Date().toISOString();

    const saved = await saveMovieSeriesRow(admin, seriesId, basePayload);
    const normalized = normalizeSavedSeries(saved.data);

    revalidatePath("/");
    revalidatePath("/web-series");
    if (normalized.slug) revalidatePath(`/web-series/${normalized.slug}`);

    return NextResponse.json({
      ok: true,
      success: true,
      series: normalized,
      skippedColumns: saved.skippedColumns
    });
  } catch (error) {
    return jsonError(errorMessage(error), 500, { code: errorCode(error) || null });
  }
}
