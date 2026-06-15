import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/admin-access";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { slugify } from "@/lib/format";
import {
  findIntegerMoviePayloadColumn,
  findMovieNumericCoercions,
  isCoreMovieSaveColumn,
  missingMovieColumnFromError,
  normalizeMovieIntegerFallbackValue,
  sanitizeMovieBasePayload,
  sanitizeMovieMetadataPayload,
  sanitizeMoviePayload
} from "@/lib/movie-schema";

type SaveMovieRequest = {
  movieId?: string | null;
  allowDuplicate?: boolean;
  payload?: Record<string, unknown>;
  metadataPayload?: Record<string, unknown>;
  relatedData?: {
    genreIds?: unknown;
    castMemberIds?: unknown;
    platformLink?: Record<string, unknown> | null;
    channelLinks?: unknown;
    licenseDocument?: Record<string, unknown> | null;
  };
};

type DuplicateMovie = {
  movieId: string;
  title: string;
  slug: string;
  status?: string | null;
  createdAt?: string | null;
  reason: "slug" | "exact" | "potential";
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "Movie save failed.");
  }
  return String(error || "Movie save failed.");
}

function jsonError(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanString(value: unknown) {
  const clean = String(value || "").trim();
  return clean || null;
}

function cleanMovieType(value: unknown) {
  const type = cleanString(value) || "movie";
  if (type === "web_series") return "tv_show";
  return type;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanBoolean(value: unknown) {
  return Boolean(value);
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => cleanString(item)).filter(Boolean))) as string[]
    : [];
}

function relationError(table: string, error: unknown) {
  return new Error(`${table} save failed: ${errorMessage(error)}`);
}

function relationColumnFromError(error: unknown) {
  const message = errorMessage(error);
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column ['"]?([^'"\s]+)['"]?/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const column = match?.[1];
    if (column) return column;
  }

  return null;
}

function toDuplicateMovie(movie: any, reason: DuplicateMovie["reason"]): DuplicateMovie | null {
  if (!movie?.id) return null;
  return {
    movieId: movie.id,
    title: movie.title || "Existing movie",
    slug: movie.slug || "",
    status: movie.status || null,
    createdAt: movie.created_at || null,
    reason
  };
}

function filterOutMovieId(query: any, movieId?: string | null) {
  return movieId ? query.neq("id", movieId) : query;
}

async function maybeFindDuplicateByQuery(query: any, reason: DuplicateMovie["reason"]) {
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.warn("WatchFinder duplicate check skipped one rule", error);
    return null;
  }
  return data ? toDuplicateMovie(data, reason) : null;
}

async function findDuplicateMovie(
  admin: any,
  payload: Record<string, unknown>,
  relatedData?: SaveMovieRequest["relatedData"],
  excludeMovieId?: string | null
): Promise<DuplicateMovie | null> {
  const select = "id, title, slug, status, created_at, release_year";
  const title = cleanString(payload.title);
  const releaseYear = cleanNumber(payload.release_year);
  const slug = cleanString(payload.slug);
  const tmdbId = cleanString(payload.tmdb_id);
  const imdbId = cleanString(payload.imdb_id);
  const platformLink = relatedData?.platformLink || {};
  const officialWatchUrl = cleanString(payload.official_watch_url) || cleanString(platformLink.watch_url);

  if (tmdbId) {
    const duplicate = await maybeFindDuplicateByQuery(
      filterOutMovieId(admin.from("movies").select(select).eq("tmdb_id", tmdbId), excludeMovieId),
      "potential"
    );
    if (duplicate) return duplicate;
  }

  if (imdbId) {
    const duplicate = await maybeFindDuplicateByQuery(
      filterOutMovieId(admin.from("movies").select(select).eq("imdb_id", imdbId), excludeMovieId),
      "potential"
    );
    if (duplicate) return duplicate;
  }

  if (officialWatchUrl) {
    const rowDuplicate = await maybeFindDuplicateByQuery(
      filterOutMovieId(admin.from("movies").select(select).eq("official_watch_url", officialWatchUrl), excludeMovieId),
      "potential"
    );
    if (rowDuplicate) return rowDuplicate;

    const { data: link, error: linkError } = await admin
      .from("movie_platform_links")
      .select("movie_id")
      .eq("watch_url", officialWatchUrl)
      .limit(1)
      .maybeSingle();

    if (!linkError && link?.movie_id && link.movie_id !== excludeMovieId) {
      const { data: movie, error: movieError } = await admin.from("movies").select(select).eq("id", link.movie_id).maybeSingle();
      if (!movieError && movie) return toDuplicateMovie(movie, "potential");
    } else if (linkError) {
      console.warn("WatchFinder duplicate platform-link check skipped", linkError);
    }
  }

  if (slug) {
    const duplicate = await maybeFindDuplicateByQuery(
      filterOutMovieId(admin.from("movies").select(select).eq("slug", slug), excludeMovieId),
      "slug"
    );
    if (duplicate) return duplicate;
  }

  if (title && releaseYear !== null) {
    const duplicate = await maybeFindDuplicateByQuery(
      filterOutMovieId(admin.from("movies").select(select).eq("title", title).eq("release_year", releaseYear), excludeMovieId),
      "potential"
    );
    if (duplicate) return duplicate;
  }

  return null;
}

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: jsonError("Supabase is not configured.", 500) };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: jsonError("Login required.", 401) };
  if (!isAdminEmail(data.user.email)) return { error: jsonError("Access denied", 403) };

  return { user: data.user };
}

async function ensurePublishedAt(
  admin: any,
  movieId: string | null,
  payload: Record<string, unknown>,
  skippedColumns: Set<string>
) {
  if (payload.status !== "published" || payload.published_at) return;

  if (!movieId) {
    payload.published_at = new Date().toISOString();
    return;
  }

  const { data, error } = await admin
    .from("movies")
    .select("published_at")
    .eq("id", movieId)
    .maybeSingle();

  const missingColumn = missingMovieColumnFromError(error);
  if (missingColumn === "published_at") {
    skippedColumns.add("published_at");
    return;
  }

  if (error) {
    console.warn("WatchFinder published_at check skipped", error);
    return;
  }

  if (!data?.published_at) payload.published_at = new Date().toISOString();
}

async function resolveUniqueMovieSlug(admin: any, requestedSlug: string, excludeMovieId?: string | null) {
  const base = slugify(requestedSlug) || `movie-${Date.now().toString(36)}`;
  const { data, error } = await admin
    .from("movies")
    .select("id, slug")
    .like("slug", `${base}%`);

  if (error) throw error;

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

async function insertMovieWithRetry(admin: any, payload: Record<string, unknown>, skippedColumns: Set<string>) {
  const safePayload = sanitizeMoviePayload(payload);
  const numericCoercions = findMovieNumericCoercions(payload, safePayload);
  if (numericCoercions.length) {
    console.info("WatchFinder movie save normalized numeric payload values", numericCoercions);
  }

  for (let attempt = 0; attempt < Object.keys(safePayload).length + 8; attempt += 1) {
    const { data, error } = await admin
      .from("movies")
      .insert(safePayload)
      .select("*")
      .single();

    if (!error && data) return data;

    const integerColumn = findIntegerMoviePayloadColumn(error, safePayload) || findIntegerMoviePayloadColumn(error, payload);
    if (integerColumn && Object.prototype.hasOwnProperty.call(safePayload, integerColumn)) {
      console.warn("WatchFinder movie save integer type mismatch", {
        action: "insert",
        column: integerColumn,
        value: safePayload[integerColumn],
        error: errorMessage(error)
      });
      const numeric = Number(safePayload[integerColumn]);
      if (Number.isFinite(numeric)) {
        safePayload[integerColumn] = normalizeMovieIntegerFallbackValue(integerColumn, safePayload[integerColumn]);
        console.warn("WatchFinder movie save retried with integer fallback", {
          action: "insert",
          column: integerColumn,
          fallbackValue: safePayload[integerColumn]
        });
        continue;
      }
    }

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

  throw new Error("Creating movie row failed: Supabase schema cache did not settle after removing unavailable optional columns.");
}

async function updateMovieWithRetry(
  admin: any,
  movieId: string,
  payload: Record<string, unknown>,
  skippedColumns: Set<string>
) {
  const safePayload = sanitizeMoviePayload(payload);
  const numericCoercions = findMovieNumericCoercions(payload, safePayload);
  if (numericCoercions.length) {
    console.info("WatchFinder movie save normalized numeric payload values", numericCoercions);
  }

  if (!Object.keys(safePayload).length) {
    const { data, error } = await admin.from("movies").select("*").eq("id", movieId).single();
    if (error) throw error;
    return data;
  }

  for (let attempt = 0; attempt < Object.keys(safePayload).length + 8; attempt += 1) {
    const { data, error } = await admin
      .from("movies")
      .update(safePayload)
      .eq("id", movieId)
      .select("*")
      .single();

    if (!error && data) return data;

    const integerColumn = findIntegerMoviePayloadColumn(error, safePayload) || findIntegerMoviePayloadColumn(error, payload);
    if (integerColumn && Object.prototype.hasOwnProperty.call(safePayload, integerColumn)) {
      console.warn("WatchFinder movie save integer type mismatch", {
        action: "update",
        column: integerColumn,
        value: safePayload[integerColumn],
        error: errorMessage(error)
      });
      const numeric = Number(safePayload[integerColumn]);
      if (Number.isFinite(numeric)) {
        safePayload[integerColumn] = normalizeMovieIntegerFallbackValue(integerColumn, safePayload[integerColumn]);
        console.warn("WatchFinder movie save retried with integer fallback", {
          action: "update",
          column: integerColumn,
          fallbackValue: safePayload[integerColumn]
        });
        continue;
      }
    }

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

  throw new Error("Updating movie row failed: Supabase schema cache did not settle after removing unavailable optional columns.");
}

async function replaceMovieGenres(admin: any, movieId: string, genreIds: unknown) {
  const ids = cleanStringArray(genreIds);
  const { error: deleteError } = await admin.from("movie_genres").delete().eq("movie_id", movieId);
  if (deleteError) throw relationError("movie_genres", deleteError);
  if (!ids.length) return;

  const { error } = await admin
    .from("movie_genres")
    .insert(ids.map((genre_id) => ({ movie_id: movieId, genre_id })));
  if (error) throw relationError("movie_genres", error);
}

async function replaceMovieCast(admin: any, movieId: string, castMemberIds: unknown) {
  const ids = cleanStringArray(castMemberIds);
  const { error: deleteError } = await admin.from("movie_cast").delete().eq("movie_id", movieId);
  if (deleteError) throw relationError("movie_cast", deleteError);
  if (!ids.length) return;

  const { error } = await admin
    .from("movie_cast")
    .insert(ids.map((cast_member_id) => ({ movie_id: movieId, cast_member_id })));
  if (error) throw relationError("movie_cast", error);
}

async function replaceMoviePlatformLink(admin: any, movieId: string, platformLink?: Record<string, unknown> | null) {
  const { error: deleteError } = await admin.from("movie_platform_links").delete().eq("movie_id", movieId);
  if (deleteError) throw relationError("movie_platform_links", deleteError);
  if (!platformLink?.platform_id) return;

  const row = {
    movie_id: movieId,
    platform_id: cleanString(platformLink.platform_id),
    watch_url: cleanString(platformLink.watch_url),
    platform_home_url: cleanString(platformLink.platform_home_url),
    platform_search_url: cleanString(platformLink.platform_search_url),
    app_deeplink: cleanString(platformLink.app_deeplink),
    app_store_url: cleanString(platformLink.app_store_url),
    play_store_url: cleanString(platformLink.play_store_url),
    fallback_note: cleanString(platformLink.fallback_note),
    mobile_web_supported: cleanString(platformLink.mobile_web_supported) || "unknown",
    desktop_web_supported: cleanString(platformLink.desktop_web_supported) || "unknown",
    app_required: cleanBoolean(platformLink.app_required),
    link_type: cleanString(platformLink.link_type) || "direct_title_page",
    open_mode: cleanString(platformLink.open_mode) || "auto",
    availability_type: cleanString(platformLink.availability_type) || "unknown",
    language: cleanString(platformLink.language),
    quality: cleanString(platformLink.quality),
    notes: cleanString(platformLink.notes),
    is_primary: true,
    region: "IN",
    is_official: true,
    is_active: true
  };

  const coreColumns = new Set(["movie_id", "platform_id", "watch_url"]);
  const skipped = new Set<string>();
  const safeRow: Record<string, unknown> = { ...row };

  for (let attempt = 0; attempt < Object.keys(safeRow).length + 4; attempt += 1) {
    const { error } = await admin.from("movie_platform_links").insert(safeRow);
    if (!error) {
      return Array.from(skipped);
    }

    const missingColumn = relationColumnFromError(error);
    if (missingColumn && !coreColumns.has(missingColumn) && hasOwn(safeRow, missingColumn)) {
      delete safeRow[missingColumn];
      skipped.add(missingColumn);
      continue;
    }

    throw relationError("movie_platform_links", error);
  }

  throw relationError("movie_platform_links", "schema cache did not settle after removing unsupported optional columns");
}

async function replaceContentChannelLinks(admin: any, movieId: string, channelLinks: unknown) {
  const links = Array.isArray(channelLinks) ? channelLinks : [];
  const { error: deleteError } = await admin.from("content_channel_items").delete().eq("movie_id", movieId);
  if (deleteError) throw relationError("content_channel_items", deleteError);
  if (!links.length) return;

  const rows = links
    .map((link) => {
      const item = typeof link === "object" && link ? link as Record<string, unknown> : {};
      const channelId = cleanString(item.channel_id);
      if (!channelId) return null;
      return {
        movie_id: movieId,
        channel_id: channelId,
        season_number: cleanNumber(item.season_number),
        episode_number: cleanNumber(item.episode_number),
        episode_title: cleanString(item.episode_title),
        playlist_group: cleanString(item.playlist_group),
        sort_order: cleanNumber(item.sort_order) ?? 0
      };
    })
    .filter(Boolean);

  if (!rows.length) return;
  const { error } = await admin.from("content_channel_items").insert(rows);
  if (error) throw relationError("content_channel_items", error);
}

async function insertLicenseDocument(admin: any, movieId: string, licenseDocument?: Record<string, unknown> | null) {
  if (!licenseDocument?.file_url || !licenseDocument?.file_path) return;

  const row = {
    movie_id: movieId,
    file_url: cleanString(licenseDocument.file_url),
    file_path: cleanString(licenseDocument.file_path),
    file_name: cleanString(licenseDocument.file_name),
    license_type: cleanString(licenseDocument.license_type),
    owner_name: cleanString(licenseDocument.owner_name),
    notes: cleanString(licenseDocument.notes),
    uploaded_by: cleanString(licenseDocument.uploaded_by)
  };

  const { error } = await admin.from("license_documents").insert(row);
  if (error) throw relationError("license_documents", error);
}

async function saveRelatedData(admin: any, movieId: string, relatedData?: SaveMovieRequest["relatedData"]) {
  const warnings: string[] = [];
  if (!relatedData) return warnings;

  async function runOptional(label: string, save: () => Promise<unknown>) {
    try {
      const result = await save();
      if (Array.isArray(result) && result.length) {
        warnings.push(`${label} saved, but skipped unsupported optional columns: ${result.join(", ")}.`);
      }
    } catch (error) {
      warnings.push(`${label}: ${errorMessage(error)}`);
    }
  }

  if (hasOwn(relatedData, "genreIds")) await runOptional("Genres", () => replaceMovieGenres(admin, movieId, relatedData.genreIds));
  if (hasOwn(relatedData, "castMemberIds")) await runOptional("Cast", () => replaceMovieCast(admin, movieId, relatedData.castMemberIds));
  if (hasOwn(relatedData, "platformLink")) await runOptional("Official platform link", () => replaceMoviePlatformLink(admin, movieId, relatedData.platformLink));
  if (hasOwn(relatedData, "channelLinks")) await runOptional("Channel links", () => replaceContentChannelLinks(admin, movieId, relatedData.channelLinks));
  if (hasOwn(relatedData, "licenseDocument")) await runOptional("License document", () => insertLicenseDocument(admin, movieId, relatedData.licenseDocument));
  return warnings;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);

  let body: SaveMovieRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const skippedColumns = new Set<string>();
  const basePayload = sanitizeMovieBasePayload(body.payload || {});
  const metadataPayload = sanitizeMovieMetadataPayload(body.metadataPayload || {});
  if (basePayload.content_type === "web_series" || basePayload.type === "web_series") {
    basePayload.content_type = "web_series";
    basePayload.type = cleanMovieType("web_series");
    const existingAiPayload = typeof metadataPayload.ai_import_payload === "object" && metadataPayload.ai_import_payload && !Array.isArray(metadataPayload.ai_import_payload)
      ? metadataPayload.ai_import_payload as Record<string, unknown>
      : {};
    metadataPayload.ai_import_payload = {
      ...existingAiPayload,
      contentCategory: "web_series"
    };
  } else if (basePayload.type) {
    basePayload.type = cleanMovieType(basePayload.type);
  }
  const baseNumericCoercions = findMovieNumericCoercions(body.payload || {}, basePayload);
  const metadataNumericCoercions = findMovieNumericCoercions(body.metadataPayload || {}, metadataPayload);
  if (baseNumericCoercions.length || metadataNumericCoercions.length) {
    console.info("WatchFinder movie save normalized AI numeric payload values", {
      base: baseNumericCoercions,
      metadata: metadataNumericCoercions
    });
  }

  if (!body.movieId) {
    if (!basePayload.title) return jsonError("Title is required.");
    if (!basePayload.content_type) return jsonError("Content type is required.");
    if (!basePayload.status) basePayload.status = "draft";
  }

  if (basePayload.status === "published" && !basePayload.official_watch_url && !basePayload.trailer_url) {
    return jsonError("Publish needs an official watch link or trailer URL. Save as Draft if links are not ready yet.");
  }

  let movieId = body.movieId || null;
  let movie: any = null;

  try {
    await ensurePublishedAt(admin, movieId, basePayload, skippedColumns);

    const duplicatePayload = { ...basePayload, ...metadataPayload };
    if (!movieId && !body.allowDuplicate) {
      const duplicate = await findDuplicateMovie(admin, duplicatePayload, body.relatedData, null);
      if (duplicate) {
        return jsonError("This title may already exist.", 409, { duplicate });
      }
    }

    if (basePayload.slug || basePayload.title) {
      basePayload.slug = await resolveUniqueMovieSlug(
        admin,
        String(basePayload.slug || basePayload.title || "movie"),
        movieId
      );
    }

    if (movieId) {
      movie = await updateMovieWithRetry(admin, movieId, basePayload, skippedColumns);
    } else {
      movie = await insertMovieWithRetry(admin, basePayload, skippedColumns);
      movieId = movie.id;
    }

    if (movieId && Object.keys(metadataPayload).length) {
      movie = await updateMovieWithRetry(admin, movieId, metadataPayload, skippedColumns);
    }

    if (movieId) {
      const warnings = await saveRelatedData(admin, movieId, body.relatedData);
      const { data: confirmedMovie, error: confirmError } = await admin.from("movies").select("*").eq("id", movieId).single();
      if (confirmError) throw confirmError;
      movie = confirmedMovie;

      console.info("WatchFinder admin movie server save", {
        movieId,
        sentBaseKeys: Object.keys(basePayload),
        sentMetadataKeys: Object.keys(metadataPayload),
        relatedKeys: body.relatedData ? Object.keys(body.relatedData) : [],
        skippedColumns: Array.from(skippedColumns),
        warnings,
        hasAiImportPayload: Object.prototype.hasOwnProperty.call(metadataPayload, "ai_import_payload")
      });

      if (movie.status === "published") {
        revalidatePath("/");
        revalidatePath("/movies");
        revalidatePath("/ott-releases");
        if (movie.slug) revalidatePath(`/movie/${movie.slug}`);
      }

      return NextResponse.json({
        ok: true,
        success: true,
        movie,
        skippedColumns: Array.from(skippedColumns),
        warnings
      });
    }

    throw new Error("Movie save failed before a movie id was available.");
  } catch (error) {
    const missingColumn = missingMovieColumnFromError(error);
    const integerColumn = findIntegerMoviePayloadColumn(error, body.payload || {}) || findIntegerMoviePayloadColumn(error, body.metadataPayload || {});
    const message = integerColumn
      ? `Save payload contains a decimal value for integer database field: ${integerColumn}. The value is normalized before saving; try saving again if this deployment was just updated.`
      : missingColumn
      ? `Save payload contains unknown database field: ${missingColumn}. It has been removed. Try saving again.`
      : errorMessage(error);
    if (integerColumn) {
      console.warn("WatchFinder movie save failed on integer field", {
        column: integerColumn,
        error: errorMessage(error)
      });
    }
    return jsonError(message, 500, { missingColumn, integerColumn, movieId, movie });
  }
}
