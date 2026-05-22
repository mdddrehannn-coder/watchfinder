import { createSupabaseAnonServerClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { isActiveWindow } from "@/lib/format";
import type {
  AdSlot,
  BlogPost,
  CastMember,
  ContentChannel,
  ContentChannelType,
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
  movie_platform_links(*, platforms(*)),
  content_channel_items(content_channels(*))
`;

function normalizeMovie(row: any): Movie {
  return {
    ...row,
    genres: (row.movie_genres ?? []).map((item: any) => item.genres).filter(Boolean),
    cast_members: (row.movie_cast ?? []).map((item: any) => item.cast_members).filter(Boolean),
    movie_platform_links: row.movie_platform_links ?? [],
    content_channels: (row.content_channel_items ?? []).map((item: any) => item.content_channels).filter(Boolean)
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
  availability?: string;
  quality?: string;
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

  if (options.availability) {
    movies = movies.filter((movie) =>
      movie.movie_platform_links?.some((link) => link.availability_type === options.availability)
    );
  }

  if (options.quality) {
    movies = movies.filter((movie) =>
      movie.movie_platform_links?.some((link) => link.quality?.includes(options.quality || ""))
    );
  }

  return movies;
}

export async function getHomepageHeroMovies() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Movie[];

  const { data, error } = await supabase
    .from("movies")
    .select(movieSelect)
    .eq("status", "published")
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(80);

  if (error || !data) return [];

  function priority(movie: Movie) {
    if (movie.is_featured) return 0;
    if (movie.is_latest) return 1;
    if (movie.is_trending) return 2;
    return 3;
  }

  function timestamp(movie: Movie) {
    return new Date(movie.updated_at || movie.created_at || 0).getTime() || 0;
  }

  return data
    .map(normalizeMovie)
    .sort((a, b) => {
      const priorityDiff = priority(a) - priority(b);
      if (priorityDiff !== 0) return priorityDiff;
      const popularityDiff = (b.popularity_score || 0) - (a.popularity_score || 0);
      if (popularityDiff !== 0) return popularityDiff;
      return timestamp(b) - timestamp(a);
    })
    .slice(0, 6);
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

export async function getContentChannels(channelType?: ContentChannelType | string, admin = false) {
  const supabase = admin ? await createSupabaseServerClient() : createSupabaseAnonServerClient();
  if (!supabase) return [] as ContentChannel[];

  let query = supabase
    .from("content_channels")
    .select("*, content_channel_items(movie_id)")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (channelType) query = query.eq("channel_type", channelType);
  if (!admin) query = query.eq("is_active", true);

  const { data } = await query;
  return (data ?? []).map((channel: any) => ({
    ...channel,
    item_count: (channel.content_channel_items ?? []).length
  })) as ContentChannel[];
}

export async function getContentChannelBySlug(channelType: ContentChannelType | string, slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("content_channels")
    .select("*")
    .eq("channel_type", channelType)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return (data as ContentChannel | null) ?? null;
}

export async function getMoviesForContentChannel(channelId: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Movie[];

  const { data } = await supabase
    .from("content_channel_items")
    .select(`movies(${movieSelect})`)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .map((item: any) => item.movies)
    .filter((movie: any) => movie?.status === "published")
    .map(normalizeMovie);
}

export async function getChannelLinkedMovies(channelType: ContentChannelType | string, limit = 12) {
  const channels = await getContentChannels(channelType);
  const channelIds = new Set(channels.map((channel) => channel.id));
  const movies = await getMovies({ limit: 160 });
  return movies
    .filter((movie) =>
      movie.content_channels?.some((channel) => channelIds.has(channel.id)) ||
      (channelType === "cartoon" && ["cartoon", "anime"].includes(String(movie.type))) ||
      (channelType === "tv_show" && movie.type === "tv_show")
    )
    .slice(0, limit);
}

export async function getSearchChannels(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [] as ContentChannel[];
  const channels = await getContentChannels();
  return channels
    .filter((channel) =>
      `${channel.name} ${channel.slug} ${channel.description || ""} ${channel.channel_type}`.toLowerCase().includes(trimmed)
    )
    .slice(0, 8);
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

  const [promotions, adSlots, blogPosts, feedbackMessages, licenseDocuments, siteSettings, contentChannels] = await Promise.all([
    supabase.from("promotions").select("*").order("priority", { ascending: false, nullsFirst: false }),
    supabase.from("ad_slots").select("*").order("placement"),
    supabase.from("blog_posts").select("*").order("published_at", { ascending: false, nullsFirst: false }),
    supabase.from("feedback_messages").select("*").order("created_at", { ascending: false }),
    supabase.from("license_documents").select("*").order("created_at", { ascending: false }),
    supabase.from("site_settings").select("*"),
    supabase.from("content_channels").select("*, content_channel_items(movie_id)").order("channel_type").order("sort_order")
  ]);

  return {
    promotions: promotions.data ?? [],
    adSlots: adSlots.data ?? [],
    blogPosts: blogPosts.data ?? [],
    feedbackMessages: feedbackMessages.data ?? [],
    licenseDocuments: licenseDocuments.data ?? [],
    siteSettings: siteSettings.data ?? [],
    contentChannels: (contentChannels.data ?? []).map((channel: any) => ({
      ...channel,
      item_count: (channel.content_channel_items ?? []).length
    }))
  };
}

export async function getAdminAnalyticsData() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      events: [],
      sessions: []
    };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [events, sessions] = await Promise.all([
      supabase
        .from("analytics_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("analytics_sessions")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(500)
    ]);

    return {
      events: events.data ?? [],
      sessions: sessions.data ?? []
    };
  } catch {
    return {
      events: [],
      sessions: []
    };
  }
}

export async function getSimilarMovies(movie: Movie) {
  const genre = movie.genres?.[0]?.slug;
  const candidates = await getMovies({ type: movie.type, genreSlug: genre, limit: 12 });
  return candidates.filter((candidate) => candidate.id !== movie.id).slice(0, 10);
}

export function firstPlatformLabel(movie: Movie) {
  return movie.movie_platform_links?.find((link: MoviePlatformLink) => link.platforms)?.platforms?.name ?? null;
}
