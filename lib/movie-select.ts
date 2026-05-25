export const movieSelect = `
  *,
  movie_genres(genres(*)),
  movie_cast(cast_members(*)),
  movie_platform_links(*, platforms(*)),
  content_channel_items(*, content_channels(*))
`;

export const movieSelectWithoutChannels = `
  *,
  movie_genres(genres(*)),
  movie_cast(cast_members(*)),
  movie_platform_links(*, platforms(*))
`;

export function isOptionalMovieRelationError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "";

  return (
    code === "PGRST200" ||
    code === "PGRST201" ||
    message.toLowerCase().includes("relationship") ||
    message.toLowerCase().includes("content_channel_items")
  );
}
