export type AiImportMode = "url" | "imdb" | "tmdb" | "name" | "bulk" | "auto";
export type AiImportedContentType = "movie" | "web_series" | "tv_show" | "cartoon" | "anime" | "documentary" | "short_film";

export type AiImportedImage = {
  kind: "poster" | "backdrop" | "banner" | "thumbnail" | "logo";
  label: string;
  url: string;
};

export type AiImportedCredit = {
  name: string;
  role?: string | null;
  character?: string | null;
  imageUrl?: string | null;
};

export type AiImportedEpisode = {
  episodeNumber: number;
  title: string;
  description?: string | null;
  runtimeMinutes?: number | null;
  airDate?: string | null;
  posterUrl?: string | null;
  stillUrl?: string | null;
  trailerUrl?: string | null;
};

export type AiImportedSeason = {
  seasonNumber: number;
  title?: string | null;
  description?: string | null;
  airDate?: string | null;
  posterUrl?: string | null;
  episodes: AiImportedEpisode[];
};

export type AiImportPlatform = {
  key: string;
  name: string;
  homeUrl?: string | null;
  searchUrl?: string | null;
};

export type AiImportCandidate = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  releaseDate?: string | null;
  releaseYear?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  rating?: number | null;
  popularity?: number | null;
};

export type AiImportDraft = {
  source: "tmdb" | "fallback";
  sourceLabel: string;
  input: string;
  extractedTitle?: string | null;
  officialWatchUrl?: string | null;
  platform?: AiImportPlatform | null;
  linkType?: "direct_title_page" | "platform_search" | "platform_home" | "app_deeplink";
  openMode?: "auto" | "in_app_browser" | "external" | "trailer_modal";
  contentType: AiImportedContentType;
  title: string;
  originalTitle?: string | null;
  alternativeTitles: string[];
  slug: string;
  tagline?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  storyOverview?: string | null;
  releaseDate?: string | null;
  releaseYear?: number | null;
  runtimeMinutes?: number | null;
  status?: string | null;
  genres: string[];
  subGenres: string[];
  language?: string | null;
  originalLanguage?: string | null;
  country?: string | null;
  budget?: number | null;
  revenue?: number | null;
  productionCompanies: string[];
  director?: string | null;
  writers: string[];
  producers: string[];
  cast: AiImportedCredit[];
  crew: AiImportedCredit[];
  awards: string[];
  rating?: number | null;
  voteCount?: number | null;
  ageRating?: string | null;
  popularityScore?: number | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  thumbnailUrl?: string | null;
  logoUrl?: string | null;
  images: AiImportedImage[];
  trailerUrl?: string | null;
  trailerName?: string | null;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  tags: string[];
  seasons: AiImportedSeason[];
  duplicateWarnings: string[];
  qualityWarnings: string[];
  missingFields: string[];
};

export type AiImportResult = {
  input: string;
  ok: boolean;
  draft?: AiImportDraft;
  candidates?: AiImportCandidate[];
  extractedTitle?: string | null;
  platform?: AiImportPlatform | null;
  error?: string;
};

export type AiImportResponse = {
  ok: boolean;
  draft?: AiImportDraft;
  candidates?: AiImportCandidate[];
  extractedTitle?: string | null;
  platform?: AiImportPlatform | null;
  needsSelection?: boolean;
  results?: AiImportResult[];
  error?: string;
  warnings?: string[];
};
