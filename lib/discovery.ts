import { splitLanguages } from "@/lib/languages";
import type { Movie, MoviePlatformLink } from "@/types/watchfinder";

export const FREE_LICENSE_TYPES = ["public_domain", "creator_permission", "self_owned", "purchased_license"];

export function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasOfficialLink(movie: Movie) {
  return Boolean(movie.movie_platform_links?.some((link) => link.watch_url && link.is_official !== false));
}

export function hasFreeAvailability(movie: Movie) {
  return Boolean(movie.movie_platform_links?.some((link) => link.availability_type === "free"));
}

export function hasOfficialYouTube(movie: Movie) {
  return Boolean(
    movie.movie_platform_links?.some((link) =>
      link.watch_url?.toLowerCase().includes("youtube.com") || link.platforms?.name?.toLowerCase().includes("youtube")
    )
  );
}

export function isLegalFreeMovie(movie: Movie) {
  return Boolean(
    movie.has_licensed_video ||
      hasFreeAvailability(movie) ||
      (movie.license_type && FREE_LICENSE_TYPES.includes(movie.license_type)) ||
      hasOfficialYouTube(movie)
  );
}

export function isHindiFriendly(movie: Movie) {
  const movieLanguages = splitLanguages(movie.language).join(" ").toLowerCase();
  const linkLanguages = (movie.movie_platform_links || [])
    .flatMap((link) => splitLanguages(link.language))
    .join(" ")
    .toLowerCase();
  return movieLanguages.includes("hindi") || linkLanguages.includes("hindi");
}

export function movieQualities(movie: Movie) {
  return Array.from(
    new Set((movie.movie_platform_links || []).flatMap((link) => splitCsv(link.quality)))
  );
}

export function movieAvailabilityTypes(movie: Movie) {
  return Array.from(
    new Set((movie.movie_platform_links || []).map((link) => link.availability_type).filter(Boolean) as string[])
  );
}

export function readableAvailability(value?: string | null) {
  const map: Record<string, string> = {
    subscription: "Subscription",
    rent: "Rent",
    buy: "Buy",
    free: "Free",
    official: "Official"
  };
  return value ? map[value] || value : null;
}

export function platformMatches(link: MoviePlatformLink, platformSlug?: string) {
  return platformSlug ? link.platforms?.slug === platformSlug : true;
}

export function filterDiscoveryMovies(
  movies: Movie[],
  filters: {
    type?: string;
    freeLegal?: boolean;
    hindiDubbed?: boolean;
    officialYouTube?: boolean;
    quality?: string;
    availability?: string;
    licenseType?: string;
    platform?: string;
    genre?: string;
    language?: string;
    latest?: boolean;
    trending?: boolean;
  }
) {
  return movies.filter((movie) => {
    if (filters.type && movie.type !== filters.type) return false;
    if (filters.freeLegal && !isLegalFreeMovie(movie)) return false;
    if (filters.hindiDubbed && !isHindiFriendly(movie)) return false;
    if (filters.officialYouTube && !hasOfficialYouTube(movie)) return false;
    if (filters.quality && !movieQualities(movie).includes(filters.quality)) return false;
    if (filters.availability && !movieAvailabilityTypes(movie).includes(filters.availability)) return false;
    if (filters.licenseType && movie.license_type !== filters.licenseType) return false;
    if (filters.platform && !movie.movie_platform_links?.some((link) => platformMatches(link, filters.platform))) return false;
    if (filters.genre && !movie.genres?.some((genre) => genre.slug === filters.genre)) return false;
    if (
      filters.language &&
      !splitLanguages(movie.language).some((language) =>
        language.toLowerCase().includes((filters.language || "").toLowerCase())
      )
    ) {
      return false;
    }
    if (filters.latest && !movie.is_latest) return false;
    if (filters.trending && !movie.is_trending) return false;
    return true;
  });
}

export function matchesDiscoveryQuery(movie: Movie, query?: string) {
  const needle = (query || "").trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    movie.title,
    movie.description,
    movie.language,
    movie.license_type,
    ...movieQualities(movie),
    ...movieAvailabilityTypes(movie),
    ...(movie.genres || []).map((genre) => genre.name),
    ...(movie.movie_platform_links || []).flatMap((link) => [
      link.platforms?.name,
      link.platforms?.slug,
      link.availability_type,
      link.quality,
      link.language
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (needle.includes("free legal")) return isLegalFreeMovie(movie);
  if (needle.includes("hindi dubbed")) return isHindiFriendly(movie);
  if (needle.includes("official youtube")) return hasOfficialYouTube(movie);
  if (needle.includes("public domain")) return movie.license_type === "public_domain";
  return haystack.includes(needle);
}

export function movieSmartBadges(movie: Movie) {
  const badges: string[] = [];
  if (isLegalFreeMovie(movie)) badges.push("Free Legal");
  if (movie.license_type === "public_domain") badges.push("Public Domain");
  if (hasOfficialYouTube(movie)) badges.push("Official YouTube");
  if (isHindiFriendly(movie)) badges.push("Hindi Dubbed");
  if (!movie.has_licensed_video) badges.push("Trailer Only");
  if (hasOfficialLink(movie)) badges.push("Official");
  if (movie.license_type) badges.push(movie.license_type.replaceAll("_", " "));
  movieQualities(movie).slice(0, 2).forEach((quality) => badges.push(quality));
  return Array.from(new Set(badges)).slice(0, 7);
}
