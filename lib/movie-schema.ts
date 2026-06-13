export const MOVIE_REQUIRED_COLUMNS = [
  "title",
  "slug",
  "description",
  "release_year",
  "duration_minutes",
  "rating",
  "director",
  "content_type",
  "homepage_placement",
  "primary_language",
  "available_languages",
  "languages_json",
  "language",
  "status",
  "poster_url",
  "banner_url",
  "backdrop_url",
  "trailer_url",
  "trailer_provider",
  "official_watch_url",
  "official_platform",
  "seo_title",
  "seo_description",
  "og_image_url",
  "tags",
  "tmdb_id",
  "imdb_id",
  "metadata_source",
  "metadata_confidence",
  "quality_score",
  "ai_import_source",
  "ai_import_payload"
] as const;

export const MOVIE_SAVE_ALLOWED_COLUMNS = MOVIE_REQUIRED_COLUMNS;

const MOVIE_SAVE_ALLOWED_COLUMN_SET = new Set<string>(MOVIE_SAVE_ALLOWED_COLUMNS);
const CORE_MOVIE_SAVE_COLUMNS = new Set<string>(["title", "slug", "content_type", "status"]);
const MOVIE_METADATA_COLUMNS = new Set<string>([
  "tmdb_id",
  "imdb_id",
  "metadata_source",
  "metadata_confidence",
  "quality_score",
  "ai_import_source",
  "ai_import_payload"
]);

function errorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
}

export function movieSchemaErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message || "");
  }
  return String(error || "");
}

export function missingMovieColumnFromError(error: unknown) {
  const message = movieSchemaErrorMessage(error);
  const patterns = [
    /Could not find the '([^']+)' column of 'movies'/i,
    /column ['"]?([^'"\s]+)['"]?.*movies/i,
    /movies[^.]*\.([a-zA-Z0-9_]+)/i
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const column = match?.[1];
    if (column) return column;
  }

  return null;
}

export function isMovieSchemaMismatchError(error: unknown) {
  const code = errorCode(error);
  const message = movieSchemaErrorMessage(error).toLowerCase();
  return (
    code === "PGRST204" ||
    (message.includes("schema cache") && message.includes("movies")) ||
    (message.includes("could not find") && message.includes("movies") && message.includes("column"))
  );
}

export function formatMovieSchemaMismatchError(error: unknown) {
  if (!isMovieSchemaMismatchError(error)) return null;
  const missingColumn = missingMovieColumnFromError(error) || "unknown";
  return `Save payload contains unknown database field: ${missingColumn}. It has been removed. Try saving again.`;
}

export function findRemovedMoviePayloadColumns(payload: Record<string, unknown>) {
  return Object.keys(payload).filter((column) => !MOVIE_SAVE_ALLOWED_COLUMN_SET.has(column));
}

export function findUnlistedMoviePayloadColumns(payload: Record<string, unknown>) {
  return findRemovedMoviePayloadColumns(payload);
}

export function isCoreMovieSaveColumn(column?: string | null) {
  return Boolean(column && CORE_MOVIE_SAVE_COLUMNS.has(column));
}

export function formatMovieSchemaCacheStaleError(column?: string | null) {
  const columnText = column ? ` movies.${column}` : "";
  return `Supabase schema cache is stale or the latest movie migration is not visible yet.${columnText} was not accepted. In Supabase, run: notify pgrst, 'reload schema'; then wait a moment and try saving again.`;
}

export function sanitizeMoviePayload(payload: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  Object.entries(payload).forEach(([column, value]) => {
    if (!MOVIE_SAVE_ALLOWED_COLUMN_SET.has(column)) return;
    if (typeof value === "undefined") return;
    sanitized[column] = value;
  });
  return sanitized;
}

export function sanitizeMovieBasePayload(payload: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  Object.entries(payload).forEach(([column, value]) => {
    if (!MOVIE_SAVE_ALLOWED_COLUMN_SET.has(column)) return;
    if (MOVIE_METADATA_COLUMNS.has(column)) return;
    if (typeof value === "undefined") return;
    sanitized[column] = value;
  });
  return sanitized;
}

export function sanitizeMovieMetadataPayload(payload: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};
  Object.entries(payload).forEach(([column, value]) => {
    if (!MOVIE_SAVE_ALLOWED_COLUMN_SET.has(column)) return;
    if (!MOVIE_METADATA_COLUMNS.has(column)) return;
    if (typeof value === "undefined" || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    sanitized[column] = value;
  });
  return sanitized;
}
