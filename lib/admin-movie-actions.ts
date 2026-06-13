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
  | { ok: true; updatedAt?: string | null; skippedTables?: string[]; alreadyDeleted?: boolean; message?: string }
  | { ok: false; message: string; step: string; table?: string; code?: string };

function errorMessage(error: SupabaseMutationError) {
  return [error.message, error.details, error.hint].filter(Boolean).join(" ");
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
  try {
    const response = await fetch("/api/admin/movies/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId })
    });
    const result = await response.json().catch(() => null) as {
      ok?: boolean;
      error?: string;
      message?: string;
      skippedTables?: string[];
      alreadyDeleted?: boolean;
    } | null;

    if (!response.ok || !result?.ok) {
      return {
        ok: false,
        step: "Deleting movie row",
        table: "movies",
        message: result?.error || result?.message || `Delete failed (${response.status}).`
      };
    }

    return {
      ok: true,
      skippedTables: result.skippedTables || [],
      alreadyDeleted: Boolean(result.alreadyDeleted),
      message: result.message || (result.alreadyDeleted ? "This movie was already deleted or no longer exists." : "Movie deleted successfully.")
    };
  } catch (error) {
    return {
      ok: false,
      step: "Deleting movie row",
      table: "movies",
      message: error instanceof Error ? error.message : "Delete failed."
    };
  }
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
