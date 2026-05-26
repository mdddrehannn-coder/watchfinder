"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type AdminMovieActionStatus = "published" | "draft" | "archived" | "hidden";

type SupabaseMutationError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export type AdminMovieActionResult =
  | { ok: true; updatedAt?: string | null; skippedTables?: string[] }
  | { ok: false; message: string; step: string; table?: string; code?: string };

const optionalMovieRelationTables = [
  "movie_genres",
  "movie_platform_links",
  "movie_cast",
  "content_channel_items",
  "license_documents"
] as const;

function errorMessage(error: SupabaseMutationError) {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
}

function isMissingTableError(error: SupabaseMutationError) {
  const message = errorMessage(error).toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function failure(step: string, error: SupabaseMutationError, table?: string): AdminMovieActionResult {
  return {
    ok: false,
    step,
    table,
    code: error.code,
    message: `${step}${table ? ` (${table})` : ""}: ${error.message || "Unknown Supabase error"}`
  };
}

export async function deleteMovieById(movieId: string): Promise<AdminMovieActionResult> {
  const supabase = createSupabaseBrowserClient();
  const skippedTables: string[] = [];

  const { error: analyticsError } = await supabase
    .from("analytics_events")
    .update({ movie_id: null })
    .eq("movie_id", movieId);

  if (analyticsError) {
    if (isMissingTableError(analyticsError)) {
      skippedTables.push("analytics_events");
    } else {
      return failure("Detaching analytics events", analyticsError, "analytics_events");
    }
  }

  for (const table of optionalMovieRelationTables) {
    const { error } = await supabase.from(table).delete().eq("movie_id", movieId);
    if (!error) continue;
    if (isMissingTableError(error)) {
      skippedTables.push(table);
      continue;
    }
    return failure("Deleting related rows", error, table);
  }

  const { data, error } = await supabase
    .from("movies")
    .delete()
    .eq("id", movieId)
    .select("id");

  if (error) return failure("Deleting movie row", error, "movies");
  if (!data?.length) {
    return {
      ok: false,
      step: "Deleting movie row",
      table: "movies",
      message: "Delete failed: no movie row matched the selected movie id."
    };
  }

  return { ok: true, skippedTables };
}

export async function updateMovieStatusById(
  movieId: string,
  status: AdminMovieActionStatus
): Promise<AdminMovieActionResult> {
  const supabase = createSupabaseBrowserClient();
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("movies")
    .update({ status, updated_at: updatedAt })
    .eq("id", movieId)
    .select("id, status, updated_at")
    .maybeSingle();

  if (error) return failure(`Moving movie to ${status}`, error, "movies");
  if (!data) {
    return {
      ok: false,
      step: `Moving movie to ${status}`,
      table: "movies",
      message: "Status update failed: no movie row matched the selected movie id."
    };
  }

  return { ok: true, updatedAt: data.updated_at ?? updatedAt };
}
