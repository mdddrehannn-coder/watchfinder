import { createSupabaseAnonServerClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { isActiveWindow } from "@/lib/format";
import type {
  AdSlot,
  BlogPost,
  CastMember,
  Genre,
  LicenseDocument,
  Movie,
  MoviePlatformLink,
  Platform,
  Promotion
} from "@/types/watchfinder";

const movieSelect = `
  *,
  movie_genres(genres(*)),
  movie_cast(cast_members(*)),
  movie_platform_links(*, platforms(*))
`;

function normalizeMovie(row: any): Movie {
  return {
    ...row,
    genres: (row.movie_genres ?? []).map((item: any) => item.genres).filter(Boolean),
    cast_members: (row.movie_cast ?? []).map((item: any) => item.cast_members).filter(Boolean),
    movie_platform_links: row.movie_platform_links ?? []
  };
}

export async function getCurrentUserAndProfile() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { user: null, profile: null };

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

export async function requireAdminProfile() {
  const session = await getCurrentUserAndProfile();
  return {
    ...session,
    isAdmin: session.profile?.role === "admin"
  };
}

export async function getMovies(options: {
  type?: string;
  genreSlug?: string;
  platformSlug?: string;
  language?: string;
  year?: string | number;
  trending?: boolean;
  latest?: boolean;
  featured?: boolean;
  topRated?: boolean;
  limit?: number;
  search?: string;
} = {}) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Movie[];

  let query = supabase
    .from("movies")
    .select(movieSelect)
    .eq("status", "published")
    .order(options.topRated ? "rating" : "popularity_score", { ascending: false, nullsFirst: false })
    .limit(options.limit ?? 24);

  if (options.type) query = query.eq("type", options.type);
  if (options.language) query = query.ilike("language", `%${options.language}%`);
  if (options.year) query = query.eq("release_year", Number(options.year));
  if (options.trending) query = query.eq("is_trending", true);
  if (options.latest) query = query.eq("is_latest", true);
  if (options.featured) query = query.eq("is_featured", true);
  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%,language.ilike.%${options.search}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let movies = data.map(normalizeMovie);

  if (options.genreSlug) {
    movies = movies.filter((movie) => movie.genres?.some((genre) => genre.slug === options.genreSlug));
  }

  if (options.platformSlug) {
    movies = movies.filter((movie) =>
      movie.movie_platform_links?.some((link) => link.platforms?.slug === options.platformSlug)
    );
  }

  return movies;
}

export async function getMovieBySlug(slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("movies")
    .select(movieSelect)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) return null;
  return normalizeMovie(data);
}

export async function getAllAdminMovies() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as Movie[];
  const { data } = await supabase.from("movies").select(movieSelect).order("created_at", { ascending: false });
  return (data ?? []).map(normalizeMovie);
}

export async function getUserFavoriteMovies() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as Movie[];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("favorites")
    .select(`movies(${movieSelect})`)
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .map((item: any) => item.movies)
    .filter(Boolean)
    .map(normalizeMovie);
}

export async function getUserWatchHistoryMovies() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as Movie[];
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data } = await supabase
    .from("watch_history")
    .select(`movies(${movieSelect})`)
    .eq("user_id", auth.user.id)
    .order("watched_at", { ascending: false });

  return (data ?? [])
    .map((item: any) => item.movies)
    .filter(Boolean)
    .map(normalizeMovie);
}

export async function getGenres() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Genre[];
  const { data } = await supabase.from("genres").select("*").order("name");
  return (data ?? []) as Genre[];
}

export async function getPlatforms() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Platform[];
  const { data } = await supabase.from("platforms").select("*").order("name");
  return (data ?? []) as Platform[];
}

export async function getPlatformBySlug(slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("platforms").select("*").eq("slug", slug).maybeSingle();
  return (data as Platform | null) ?? null;
}

export async function getCastMembers() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as CastMember[];
  const { data } = await supabase.from("cast_members").select("*").order("name");
  return (data ?? []) as CastMember[];
}

export async function getPromotions(placement?: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Promotion[];

  let query = supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: false, nullsFirst: false });

  if (placement) query = query.eq("placement", placement);

  const { data } = await query;
  return ((data ?? []) as Promotion[]).filter((promo) => isActiveWindow(promo.start_date, promo.end_date));
}

export async function getAdSlots(placement?: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as AdSlot[];
  let query = supabase.from("ad_slots").select("*").eq("is_active", true);
  if (placement) query = query.eq("placement", placement);
  const { data } = await query;
  return (data ?? []) as AdSlot[];
}

export async function getBlogPosts(limit = 24) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as BlogPost[];
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as BlogPost[];
}

export async function getBlogPostBySlug(slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function getPopularSearches() {
  const [movies, platforms, genres] = await Promise.all([
    getMovies({ trending: true, limit: 5 }),
    getPlatforms(),
    getGenres()
  ]);

  return [
    ...movies.map((movie) => movie.title),
    ...platforms.slice(0, 4).map((platform) => platform.name),
    ...genres.slice(0, 4).map((genre) => genre.name)
  ].slice(0, 10);
}

export async function getLicenseDocumentsForMovie(movieId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as LicenseDocument[];
  const { data } = await supabase.from("license_documents").select("*").eq("movie_id", movieId);
  return (data ?? []) as LicenseDocument[];
}

export async function getAdminCollections() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      promotions: [],
      adSlots: [],
      blogPosts: [],
      feedbackMessages: [],
      licenseDocuments: [],
      siteSettings: []
    };
  }

  const [promotions, adSlots, blogPosts, feedbackMessages, licenseDocuments, siteSettings] = await Promise.all([
    supabase.from("promotions").select("*").order("priority", { ascending: false, nullsFirst: false }),
    supabase.from("ad_slots").select("*").order("placement"),
    supabase.from("blog_posts").select("*").order("published_at", { ascending: false, nullsFirst: false }),
    supabase.from("feedback_messages").select("*").order("created_at", { ascending: false }),
    supabase.from("license_documents").select("*").order("created_at", { ascending: false }),
    supabase.from("site_settings").select("*")
  ]);

  return {
    promotions: promotions.data ?? [],
    adSlots: adSlots.data ?? [],
    blogPosts: blogPosts.data ?? [],
    feedbackMessages: feedbackMessages.data ?? [],
    licenseDocuments: licenseDocuments.data ?? [],
    siteSettings: siteSettings.data ?? []
  };
}

export async function getSimilarMovies(movie: Movie) {
  const genre = movie.genres?.[0]?.slug;
  const candidates = await getMovies({ type: movie.type, genreSlug: genre, limit: 12 });
  return candidates.filter((candidate) => candidate.id !== movie.id).slice(0, 10);
}

export function firstPlatformLabel(movie: Movie) {
  return movie.movie_platform_links?.find((link: MoviePlatformLink) => link.platforms)?.platforms?.name ?? null;
}
