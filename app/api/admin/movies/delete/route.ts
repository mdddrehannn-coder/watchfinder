import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-access";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

type DeleteMovieRequest = {
  movieId?: string | null;
};

const relatedMovieTables = [
  "movie_genres",
  "movie_cast",
  "movie_platform_links",
  "movie_languages",
  "movie_channel_links",
  "content_channel_items",
  "license_documents"
] as const;

function jsonError(error: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "Admin movie delete failed.");
  }
  return String(error || "Admin movie delete failed.");
}

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
}

function isMissingOptionalTableOrColumn(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache")
  );
}

async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: jsonError("Supabase is not configured.", 500) };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: jsonError("Login required.", 401) };
  if (!isAdminEmail(data.user.email)) return { error: jsonError("Access denied", 403) };

  return { user: data.user };
}

async function detachAnalytics(admin: any, movieId: string, skippedTables: string[]) {
  const { error } = await admin
    .from("analytics_events")
    .update({ movie_id: null })
    .eq("movie_id", movieId);

  if (!error) return;
  if (isMissingOptionalTableOrColumn(error)) {
    skippedTables.push("analytics_events");
    return;
  }
  throw new Error(`Detaching analytics_events failed: ${errorMessage(error)}`);
}

async function deleteRelatedRows(admin: any, movieId: string, skippedTables: string[]) {
  for (const table of relatedMovieTables) {
    const { error } = await admin.from(table).delete().eq("movie_id", movieId);
    if (!error) continue;
    if (isMissingOptionalTableOrColumn(error)) {
      skippedTables.push(table);
      continue;
    }
    throw new Error(`Deleting ${table} failed: ${errorMessage(error)}`);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("SUPABASE_SERVICE_ROLE_KEY is not configured.", 500);

  let body: DeleteMovieRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.");
  }

  const movieId = String(body.movieId || "").trim();
  if (!movieId) return jsonError("Movie id is required.");

  try {
    const { data: existingMovie, error: fetchError } = await admin
      .from("movies")
      .select("id, title, slug, status")
      .eq("id", movieId)
      .maybeSingle();

    if (fetchError) throw new Error(`Checking movie row failed: ${errorMessage(fetchError)}`);

    if (!existingMovie) {
      return NextResponse.json({
        ok: true,
        alreadyDeleted: true,
        movieId,
        message: "This movie was already deleted or no longer exists."
      });
    }

    const skippedTables: string[] = [];
    await detachAnalytics(admin, movieId, skippedTables);
    await deleteRelatedRows(admin, movieId, skippedTables);

    const { data: deletedRows, error: deleteError } = await admin
      .from("movies")
      .delete()
      .eq("id", movieId)
      .select("id");

    if (deleteError) throw new Error(`Deleting movie row failed: ${errorMessage(deleteError)}`);

    if (!deletedRows?.length) {
      return NextResponse.json({
        ok: true,
        alreadyDeleted: true,
        movieId,
        message: "This movie was already deleted or no longer exists.",
        skippedTables
      });
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      movieId,
      movie: existingMovie,
      skippedTables,
      message: "Movie deleted successfully."
    });
  } catch (error) {
    return jsonError(errorMessage(error), 500, { movieId });
  }
}
