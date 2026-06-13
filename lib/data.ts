import { createSupabaseAdminClient, createSupabaseAnonServerClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/admin-access";
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
  Promotion,
  Series
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

function moviePlacement(movie: Movie) {
  return [movie.homepage_placement, movie.primary_section]
    .map((section) => String(section || "").trim())
    .filter(Boolean);
}

function movieHasPlacement(movie: Movie, placements: string[]) {
  const allowed = new Set(placements);
  return moviePlacement(movie).some((section) => allowed.has(section));
}

function isHeroEligible(movie: Movie) {
  return Boolean(
    movie.show_in_hero ||
    movie.is_featured ||
    movie.is_latest ||
    movie.is_trending ||
    movieHasPlacement(movie, ["hero"])
  );
}

function homepageSectionAliases(section: string) {
  if (section === "ott_release" || section === "new_ott_releases" || section === "latest") {
    return ["ott_release", "new_ott_releases", "latest"];
  }
  if (section === "featured") return ["featured"];
  return [section];
}

function moviePublishedTime(movie: Movie) {
  return Date.parse(movie.published_at || movie.created_at || movie.updated_at || "") || 0;
}

function newestMoviesFirst(movies: Movie[]) {
  return [...movies].sort((left, right) => moviePublishedTime(right) - moviePublishedTime(left));
}

function movieIdentityKey(movie: Movie) {
  return [
    movie.tmdb_id ? `tmdb:${movie.tmdb_id}` : "",
    movie.official_watch_url ? `watch:${movie.official_watch_url}` : "",
    movie.slug ? `slug:${movie.slug}` : "",
    movie.id ? `id:${movie.id}` : ""
  ].find(Boolean) || movie.title;
}

function uniqueMoviesByContent(movies: Movie[]) {
  const seen = new Set<string>();
  return movies.filter((movie) => {
    const key = movieIdentityKey(movie);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesMovieHomepageOptions(movie: Movie, options: {
  primarySection?: string;
  showInHero?: boolean;
  trending?: boolean;
  latest?: boolean;
  featured?: boolean;
}) {
  if (options.primarySection && !movieHasPlacement(movie, homepageSectionAliases(options.primarySection))) return false;
  if (typeof options.showInHero === "boolean") {
    const heroEligible = Boolean(movie.show_in_hero || movieHasPlacement(movie, ["hero"]));
    if (heroEligible !== options.showInHero) return false;
  }
  if (options.trending && !movie.is_trending && !movieHasPlacement(movie, ["trending"])) return false;
  if (options.featured && !movie.is_featured && !movieHasPlacement(movie, ["featured"])) return false;
  if (
    options.latest &&
    !movie.is_latest &&
    !movieHasPlacement(movie, ["latest", "ott_release", "new_ott_releases"])
  ) {
    return false;
  }
  return true;
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

function normalizeSeries(row: any): Series {
  const movie = normalizeMovie(row);
  const aiPayload = typeof movie.ai_import_payload === "object" && movie.ai_import_payload && !Array.isArray(movie.ai_import_payload)
    ? movie.ai_import_payload as Record<string, any>
    : {};
  const seriesPayload = aiPayload.webSeries || aiPayload.web_series || aiPayload.series || {};
  const rawSeasons = seriesPayload.seasons ?? aiPayload.seasons ?? row.seasons ?? [];
  const genreText = movie.genres?.map((genre) => genre.name).join(", ") || row.genre || seriesPayload.genre || null;
  const platformText = movie.official_platform || movie.platform_name || seriesPayload.platform_name || seriesPayload.platform || null;
  const seasons = [...rawSeasons]
    .map((season: any) => ({
      ...season,
      is_published: season.is_published ?? season.status === "published",
      id: season.id || `season-${season.season_number ?? season.sort_order ?? 0}`,
      series_id: movie.id,
      episodes: [...(season.episodes ?? [])]
        .map((episode: any) => ({
          ...episode,
          id: episode.id || `episode-${season.season_number ?? 0}-${episode.episode_number ?? episode.sort_order ?? 0}`,
          series_id: movie.id,
          season_id: season.id || `season-${season.season_number ?? season.sort_order ?? 0}`,
          thumbnail_url: episode.thumbnail_url ?? episode.poster_url ?? episode.banner_url ?? null,
          video_url: episode.video_url ?? episode.video_embed_url ?? episode.trailer_url ?? episode.watch_url ?? "",
          duration: episode.duration ?? (episode.duration_minutes ? `${episode.duration_minutes}m` : null),
          is_published: episode.is_published ?? episode.status === "published"
        }))
        .sort((a: any, b: any) => (a.sort_order ?? a.episode_number ?? 0) - (b.sort_order ?? b.episode_number ?? 0))
    }))
    .sort((a: any, b: any) => (a.sort_order ?? a.season_number ?? 0) - (b.sort_order ?? b.season_number ?? 0));

  return {
    ...movie,
    type: "web_series",
    content_type: "web_series",
    genre: genreText,
    platform_name: platformText,
    official_platform: movie.official_platform || platformText,
    language: movie.primary_language || movie.language || seriesPayload.language || null,
    rating: movie.rating == null ? seriesPayload.rating ?? null : String(movie.rating),
    watch_url: movie.watch_url || movie.official_watch_url || seriesPayload.watch_url || null,
    official_watch_url: movie.official_watch_url || seriesPayload.official_watch_url || seriesPayload.watch_url || null,
    is_published: row.is_published ?? movie.status === "published",
    seasons,
    season_count: seasons.length,
    episode_count: seasons.reduce((total: number, season: any) => total + (season.episodes?.length ?? 0), 0)
  } as Series;
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
    isAdmin: isAdminEmail(session.user?.email)
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
  primarySection?: string;
  showInHero?: boolean;
  createdDesc?: boolean;
  debugLabel?: string;
} = {}) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Movie[];
  const requestedLimit = options.limit ?? 24;
  const hasHomepageFilter = Boolean(
    options.primarySection ||
    typeof options.showInHero === "boolean" ||
    options.trending ||
    options.latest ||
    options.featured
  );

  const orderColumns = options.createdDesc
    ? ["published_at", "created_at", "id"]
    : [options.topRated ? "rating" : "popularity_score"];
  let data: any[] | null = null;
  let error: any | null = null;
  let orderColumnUsed = orderColumns[0];

  for (const orderColumn of orderColumns) {
    const result = await runMovieQuery(supabase, (select) => {
      let query = supabase
        .from("movies")
        .select(select)
        .eq("status", "published")
        .limit(hasHomepageFilter ? Math.max(requestedLimit * 4, 120) : requestedLimit)
        .order(orderColumn, { ascending: false, nullsFirst: false });

      if (options.type) query = query.eq("type", options.type);
      if (options.language) query = query.ilike("language", `%${options.language}%`);
      if (options.year) query = query.eq("release_year", Number(options.year));
      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%,language.ilike.%${options.search}%`);
      }

      return query;
    });

    data = result.data;
    error = result.error;
    orderColumnUsed = orderColumn;
    if (!error) break;
    if (!options.createdDesc) break;
    if (process.env.NODE_ENV !== "production") console.warn(`Movie query ${orderColumn} order failed:`, error);
  }

  if (error || !data) return [];

  let movies = data.map(normalizeMovie);
  const fetchedCount = movies.length;

  if (hasHomepageFilter) {
    movies = movies.filter((movie) => matchesMovieHomepageOptions(movie, options));
  }
  const filteredCount = movies.length;

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

  const orderedMovies = options.createdDesc || hasHomepageFilter ? newestMoviesFirst(movies) : movies;
  const result = uniqueMoviesByContent(orderedMovies).slice(0, requestedLimit);

  if (options.debugLabel) {
    console.info("WatchFinder homepage collection query", {
      label: options.debugLabel,
      fetchedCount,
      filteredCount,
      returnedCount: result.length,
      options: {
        orderColumn: orderColumnUsed,
        trending: Boolean(options.trending),
        latest: Boolean(options.latest),
        featured: Boolean(options.featured),
        primarySection: options.primarySection || null,
        showInHero: typeof options.showInHero === "boolean" ? options.showInHero : null,
        createdDesc: Boolean(options.createdDesc)
      },
      aiRows: result
        .filter((movie) => movie.ai_import_source || movie.metadata_source || movie.ai_import_payload)
        .slice(0, 8)
        .map((movie) => ({
          title: movie.title,
          slug: movie.slug,
          placement: movie.homepage_placement || movie.primary_section || null,
          trending: Boolean(movie.is_trending),
          latest: Boolean(movie.is_latest),
          featured: Boolean(movie.is_featured),
          hindiDubbed: Boolean(movie.is_hindi_dubbed),
          freeLegal: Boolean(movie.is_free_legal)
        }))
    });
  }

  return result;
}

export async function getHomepageHeroMovies() {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Movie[];

  const orderColumns = ["published_at", "created_at", "uploaded_at", "updated_at", "id"];

  for (const column of orderColumns) {
    const { data, error } = await runMovieQuery(supabase, (select) =>
      supabase
        .from("movies")
        .select(select)
        .eq("status", "published")
        .order(column, { ascending: false, nullsFirst: false })
        .limit(18)
    );

    if (error) {
      if (process.env.NODE_ENV !== "production") console.warn(`Homepage hero ${column} query failed:`, error);
      continue;
    }

    const latestMovies = uniqueMoviesByContent(newestMoviesFirst((data ?? []).map(normalizeMovie)));
    const heroEligible = latestMovies.filter(isHeroEligible);
    const heroPool = uniqueMoviesByContent([...heroEligible, ...latestMovies]);
    const latestWithImages = heroPool.filter((movie) => movie.banner_url || movie.poster_url);
    const result = (latestWithImages.length ? latestWithImages : heroPool).slice(0, 6);

    console.info("WatchFinder homepage hero query", {
      orderColumn: column,
      fetchedCount: data?.length ?? 0,
      dedupedCount: latestMovies.length,
      heroEligibleCount: heroEligible.length,
      returnedCount: result.length,
      titles: result.map((movie) => ({
        title: movie.title,
        slug: movie.slug,
        placement: movie.homepage_placement || movie.primary_section || null,
        showInHero: Boolean(movie.show_in_hero),
        featured: Boolean(movie.is_featured),
        latest: Boolean(movie.is_latest),
        trending: Boolean(movie.is_trending)
      }))
    });

    return result;
  }

  return [] as Movie[];
}

export async function getHomepageSectionMovies(section: string, limit = 12) {
  return getMovies({ primarySection: section, limit, createdDesc: true });
}

export async function getPublishedSeries(limit = 12) {
  const supabase = createSupabaseAnonServerClient();
  if (!supabase) return [] as Series[];

  const { data, error } = await runMovieQuery(supabase, (select) =>
    supabase
      .from("movies")
      .select(select)
      .or("content_type.eq.web_series,type.eq.web_series")
    .eq("status", "published")
    .order("created_at", { ascending: false })
      .limit(limit)
  );

  if (error || !data) {
    if (error && process.env.NODE_ENV !== "production") console.warn(error.message || "Web Series movie query failed.");
    return [] as Series[];
  }

  return data.map(normalizeSeries);
}

export async function getSeriesBySlug(slug: string, admin = false) {
  const supabase = admin ? createSupabaseAdminClient() ?? (await createSupabaseServerClient()) : createSupabaseAnonServerClient();
  if (!supabase) return null;

  const { data, error } = await runMovieQuery(supabase, (select) => {
    let query = supabase
      .from("movies")
      .select(select)
      .eq("slug", slug)
      .or("content_type.eq.web_series,type.eq.web_series");

    if (!admin) query = query.eq("status", "published");
    return query;
  });

  const row = data?.[0] ?? null;
  if (error || !row) {
    if (error && process.env.NODE_ENV !== "production") console.warn(error.message || "Web Series movie query failed.");
    return null;
  }

  const series = normalizeSeries(row);
  if (admin) return series;

  return {
    ...series,
    seasons: (series.seasons ?? [])
      .filter((season) => season.status === "published" || season.is_published)
      .map((season) => ({
        ...season,
        episodes: (season.episodes ?? []).filter((episode) => episode.status === "published" || episode.is_published)
      }))
  };
}

export async function getSeriesEpisodeByNumbers(slug: string, seasonNumber: number, episodeNumber: number) {
  const series = await getSeriesBySlug(slug);
  if (!series) return null;

  const season = series.seasons?.find((item) => item.season_number === seasonNumber);
  const episode = season?.episodes?.find((item) => item.episode_number === episodeNumber);
  if (!season || !episode) return null;

  const allEpisodes = (series.seasons ?? [])
    .flatMap((item) => (item.episodes ?? []).map((episodeItem) => ({ season: item, episode: episodeItem })))
    .sort((a, b) => {
      if (a.season.season_number !== b.season.season_number) return a.season.season_number - b.season.season_number;
      return a.episode.episode_number - b.episode.episode_number;
    });
  const currentIndex = allEpisodes.findIndex((item) => item.episode.id === episode.id);

  return {
    series,
    season,
    episode,
    previous: currentIndex > 0 ? allEpisodes[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null
  };
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

export async function getAllAdminSeries() {
  const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
  if (!supabase) return [] as Series[];

  const { data, error } = await runMovieQuery(supabase, (select) =>
    supabase
      .from("movies")
      .select(select)
      .or("content_type.eq.web_series,type.eq.web_series")
      .order("created_at", { ascending: false })
  );

  if (error || !data) {
    if (error) console.warn(error.message || "Web Series movie query failed.");
    return [] as Series[];
  }

  return data.map(normalizeSeries);
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
