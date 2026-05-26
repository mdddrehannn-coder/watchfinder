import { createSupabaseAdminClient, createSupabaseAnonServerClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { isActiveWindow } from "@/lib/format";
import { isOptionalMovieRelationError, movieSelect, movieSelectWithoutChannels } from "@/lib/movie-select";
import type {
  AdSlot,
  BlogPost,
  CastMember,
  ContentChannel,
  ContentChannelItem,
  ContentChannelType,
  Genre,
  LicenseDocument,
  Movie,
  MoviePlatformLink,
  Platform,
  Promotion
} from "@/types/watchfinder";

function normalizeMovie(row: any): Movie {
  return {
    ...row,
    genres: (row.movie_genres ?? []).map((item: any) => item.genres).filter(Boolean),
    cast_members: (row.movie_cast ?? []).map((item: any) => item.cast_members).filter(Boolean),
    movie_platform_links: row.movie_platform_links ?? [],
    content_channel_items: row.content_channel_items ?? [],
    content_channels: (row.content_channel_items ?? []).map((item: any) => item.content_channels).filter(Boolean)
  };
}

function contentChannelTableErrorMessage(error: any) {
  if (!error) return null;
  const message = String(error.message || "");
  const code = String(error.code || "");
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    message.toLowerCase().includes("content_channels") ||
    message.toLowerCase().includes("content_channel_items") ||
    message.toLowerCase().includes("schema cache")
  ) {
    return "Cartoon/TV Show tables are missing. Run the Supabase migration.";
  }
  return message || "Cartoon/TV Show channel query failed.";
}

async function runMovieQuery(
  supabase: any,
  buildQuery: (select: string) => any
): Promise<{ data: any[] | null; error: any | null }> {
  const result = await buildQuery(movieSelect);
  if (!result.error || !isOptionalMovieRelationError(result.error)) return result;
  return buildQuery(movieSelectWithoutChannels);
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

  const { data, error } = await runMovieQuery(supabase, (select) => {
    let query = supabase
      .from("movies")
      .select(select)
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

    return query;
  });
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

  const { data: eligibleData, error: eligibleError } = await runMovieQuery(supabase, (select) =>
    supabase
      .from("movies")
      .select(select)
      .eq("status", "published")
      .or("is_featured.eq.true,is_latest.eq.true,is_trending.eq.true")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(6)
  );

  if (eligibleError) {
    if (process.env.NODE_ENV !== "production") console.warn("Homepage hero eligible query failed:", eligibleError);
    return [];
  }

  const heroMovies = (eligibleData ?? []).map(normalizeMovie);
  if (heroMovies.length >= 6) return heroMovies.slice(0, 6);

  const { data: fallbackData, error: fallbackError } = await runMovieQuery(supabase, (select) =>
    supabase
      .from("movies")
      .select(select)
      .eq("status", "published")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(12)
  );

  if (fallbackError) {
    if (process.env.NODE_ENV !== "production") console.warn("Homepage hero fallback query failed:", fallbackError);
    return heroMovies.slice(0, 6);
  }

  const seen = new Set(heroMovies.map((movie) => movie.id));
  for (const movie of (fallbackData ?? []).map(normalizeMovie)) {
    if (seen.has(movie.id)) continue;
    heroMovies.push(movie);
    seen.add(movie.id);
    if (heroMovies.length === 6) break;
  }

  return heroMovies.slice(0, 6);
}

export async function getMovieBySlug(slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;

  const { data, error } = await runMovieQuery(supabase, (select) =>
    supabase
      .from("movies")
      .select(select)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
  );

  if (error || !data) return null;
  return normalizeMovie(data);
}

export async function getAllAdminMovies() {
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) return [] as Movie[];
  const { data } = await runMovieQuery(supabase, (select) =>
    supabase.from("movies").select(select).order("created_at", { ascending: false })
  );
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

  const { data, error } = await query;
  if (error) {
    console.warn(contentChannelTableErrorMessage(error));
    return [] as ContentChannel[];
  }
  return (data ?? []).map((channel: any) => ({
    ...channel,
    item_count: (channel.content_channel_items ?? []).length
  })) as ContentChannel[];
}

export async function getContentChannelBySlug(channelType: ContentChannelType | string, slug: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("content_channels")
    .select("*")
    .eq("channel_type", channelType)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn(contentChannelTableErrorMessage(error));
    return null;
  }

  return (data as ContentChannel | null) ?? null;
}

export async function getMoviesForContentChannel(channelId: string) {
  const items = await getContentChannelItems(channelId);
  return items.map((item) => item.movies).filter(Boolean) as Movie[];
}

export async function getContentChannelItems(channelId: string) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as ContentChannelItem[];

  const { data, error } = await supabase
    .from("content_channel_items")
    .select(`*, movies(${movieSelect})`)
    .eq("channel_id", channelId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("season_number", { ascending: true, nullsFirst: false })
    .order("episode_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    const fallback = await supabase
      .from("content_channel_items")
      .select(`*, movies(${movieSelect})`)
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false });

    return (fallback.data ?? [])
      .map((item: any) => ({ ...item, movies: item.movies ? normalizeMovie(item.movies) : null }))
      .filter((item: any) => item.movies?.status === "published") as ContentChannelItem[];
  }

  return (data ?? [])
    .map((item: any) => ({ ...item, movies: item.movies ? normalizeMovie(item.movies) : null }))
    .filter((item: any) => item.movies?.status === "published") as ContentChannelItem[];
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
      siteSettings: [],
      contentChannels: [],
      contentChannelsError: "Cartoon/TV Show tables are missing. Run the Supabase migration."
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
    })),
    contentChannelsError: contentChannelTableErrorMessage(contentChannels.error)
  };
}

export async function getAdminAnalyticsData() {
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) {
    return {
      events: [],
      sessions: [],
      debug: {
        eventsCount: 0,
        sessionsCount: 0,
        lastEventAt: null,
        lastEventType: null,
        lastSessionAt: null,
        errors: ["Supabase environment variables are not configured."]
      }
    };
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
      const [events, sessions, eventsCount, sessionsCount, lastEvent, lastSession] = await Promise.all([
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
        .limit(500),
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("analytics_sessions")
        .select("id", { count: "exact", head: true }),
        supabase
          .from("analytics_events")
          .select("created_at, event_type")
          .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("analytics_sessions")
        .select("last_seen_at")
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const errors = [events.error, sessions.error, eventsCount.error, sessionsCount.error, lastEvent.error, lastSession.error]
      .filter(Boolean)
      .map((error) => error?.message || "Unknown analytics query error");

    return {
      events: events.data ?? [],
      sessions: sessions.data ?? [],
      debug: {
          eventsCount: eventsCount.count ?? 0,
          sessionsCount: sessionsCount.count ?? 0,
          lastEventAt: lastEvent.data?.created_at ?? null,
          lastEventType: lastEvent.data?.event_type ?? null,
          lastSessionAt: lastSession.data?.last_seen_at ?? null,
        errors
      }
    };
  } catch (error) {
    return {
      events: [],
      sessions: [],
      debug: {
        eventsCount: 0,
        sessionsCount: 0,
        lastEventAt: null,
        lastEventType: null,
        lastSessionAt: null,
        errors: [error instanceof Error ? error.message : "Unknown analytics query failure."]
      }
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
