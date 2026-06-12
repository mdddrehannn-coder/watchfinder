import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-access";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { slugify } from "@/lib/format";
import {
  isCoreMovieSaveColumn,
  missingMovieColumnFromError,
  sanitizeMovieBasePayload,
  sanitizeMovieMetadataPayload,
  sanitizeMoviePayload
} from "@/lib/movie-schema";

type SaveMovieRequest = {
  movieId?: string | null;
  payload?: Record<string, unknown>;
  metadataPayload?: Record<string, unknown>;
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

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: jsonError("Supabase is not configured.", 500) };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: jsonError("Login required.", 401) };
  if (!isAdminEmail(data.user.email)) return { error: jsonError("Access denied", 403) };

  return { user: data.user };
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

  for (let attempt = 0; attempt < Object.keys(safePayload).length + 8; attempt += 1) {
    const { data, error } = await admin
      .from("movies")
      .insert(safePayload)
      .select("*")
      .single();

    if (!error && data) return data;

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

  if (!body.movieId) {
    if (!basePayload.title) return jsonError("Title is required.");
    if (!basePayload.content_type) return jsonError("Content type is required.");
    if (!basePayload.status) basePayload.status = "draft";
  }

  if (basePayload.status === "published" && !basePayload.official_watch_url && !basePayload.trailer_url) {
    return jsonError("Publish needs an official watch link or trailer URL. Save as Draft if links are not ready yet.");
  }

  try {
    let movieId = body.movieId || null;
    let movie: any;

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

    console.info("WatchFinder admin movie server save", {
      movieId,
      sentBaseKeys: Object.keys(basePayload),
      sentMetadataKeys: Object.keys(metadataPayload),
      skippedColumns: Array.from(skippedColumns),
      hasAiImportPayload: Object.prototype.hasOwnProperty.call(metadataPayload, "ai_import_payload")
    });

    return NextResponse.json({
      ok: true,
      success: true,
      movie,
      skippedColumns: Array.from(skippedColumns)
    });
  } catch (error) {
    const missingColumn = missingMovieColumnFromError(error);
    const message = missingColumn
      ? `Save payload contains unknown database field: ${missingColumn}. It has been removed. Try saving again.`
      : errorMessage(error);
    return jsonError(message, 500, { missingColumn });
  }
}
