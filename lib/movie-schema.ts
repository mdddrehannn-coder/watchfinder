export const MOVIE_REQUIRED_COLUMNS = [
  "title",
  "slug",
  "type",
  "status",
  "content_type",
  "primary_section",
  "show_in_hero",
  "display_title",
  "original_title",
  "description",
  "short_description",
  "release_year",
  "duration_minutes",
  "rating",
  "imdb_rating",
  "language",
  "primary_language",
  "languages_json",
  "genres_json",
  "tags_json",
  "cast_json",
  "poster_url",
  "banner_url",
  "thumbnail_url",
  "trailer_url",
  "trailer_provider",
  "video_url",
  "video_embed_url",
  "video_provider",
  "video_id",
  "official_platform",
  "platform_name",
  "watch_url",
  "platform_home_url",
  "platform_search_url",
  "app_deeplink",
  "open_mode",
  "mobile_web_supported",
  "desktop_web_supported",
  "app_required",
  "play_store_link",
  "play_store_url",
  "app_store_link",
  "app_store_url",
  "fallback_note",
  "quality",
  "availability_type",
  "director",
  "popularity_score",
  "is_featured",
  "is_latest",
  "is_trending",
  "is_hindi_dubbed",
  "is_free_legal",
  "is_official",
  "has_licensed_video",
  "license_type",
  "license_owner_name",
  "license_start_date",
  "license_expiry_date",
  "license_notes",
  "distribution_territory",
  "season_number",
  "episode_number",
  "episode_title",
  "playlist_group",
  "seo_title",
  "seo_description",
  "og_image_url",
  "updated_at"
] as const;

const REQUIRED_MOVIE_COLUMN_SET = new Set<string>(MOVIE_REQUIRED_COLUMNS);

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
  const missingColumn = missingMovieColumnFromError(error);
  const columnText = missingColumn ? ` Missing field: movies.${missingColumn}.` : "";
  return `Database migration is missing. Run the latest WatchFinder movie schema migration.${columnText}`;
}

export function findUnlistedMoviePayloadColumns(payload: Record<string, unknown>) {
  return Object.keys(payload).filter((column) => !REQUIRED_MOVIE_COLUMN_SET.has(column));
}
