"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bug,
  Download,
  Edit3,
  Eye,
  Film,
  Link2,
  MousePointerClick,
  Plus,
  Radio,
  Search,
  Smartphone,
  Trash2,
  TrendingUp,
  Users
} from "lucide-react";
import AdminAIAssistant from "@/components/AdminAIAssistant";
import AdminAdSlotForm from "@/components/AdminAdSlotForm";
import AdminBlogForm from "@/components/AdminBlogForm";
import AdminChannelManager from "@/components/AdminChannelManager";
import AdminLicenseForm from "@/components/AdminLicenseForm";
import AdminMovieForm from "@/components/AdminMovieForm";
import AdminSeriesForm from "@/components/AdminSeriesForm";
import ChannelLogo from "@/components/ChannelLogo";
import { getMovieVisibilityCheck } from "@/lib/admin-visibility";
import { deleteMovieById, updateMovieStatusById, type AdminMovieActionStatus } from "@/lib/admin-movie-actions";
import AdminPromotionForm from "@/components/AdminPromotionForm";
import { trackEvent } from "@/lib/analytics";
import { formatType } from "@/lib/format";
import { movieSelect } from "@/lib/movie-select";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CastMember, ContentChannel, Genre, Movie, Platform, Series } from "@/types/watchfinder";

type AdminSection =
  | "dashboard"
  | "movies"
  | "web-series"
  | "ai-assistant"
  | "analytics"
  | "add-movie"
  | "genres"
  | "platforms"
  | "cast-members"
  | "cartoon-channels"
  | "tv-show-channels"
  | "channel-links"
  | "promotions"
  | "ad-slots"
  | "blog-posts"
  | "feedback-messages"
  | "license-documents"
  | "site-settings";

type MovieEditorContentType = "movie" | "trailer" | "tv_show" | "cartoon" | "short_film";
type ContentEditorType = MovieEditorContentType | "series";

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: "dashboard", label: "Dashboard Overview" },
  { id: "movies", label: "Movies" },
  { id: "web-series", label: "Web Series" },
  { id: "ai-assistant", label: "AI Assistant" },
  { id: "analytics", label: "Analytics" },
  { id: "add-movie", label: "Add Content" },
  { id: "genres", label: "Genres" },
  { id: "platforms", label: "Platforms" },
  { id: "cast-members", label: "Cast Members" },
  { id: "cartoon-channels", label: "Cartoon Channels" },
  { id: "tv-show-channels", label: "TV Show Channels" },
  { id: "channel-links", label: "Manage Channel Links" },
  { id: "promotions", label: "Promotions" },
  { id: "ad-slots", label: "Ad Slots" },
  { id: "blog-posts", label: "Blog Posts" },
  { id: "feedback-messages", label: "Feedback Messages" },
  { id: "license-documents", label: "License Documents" },
  { id: "site-settings", label: "Site Settings" }
];

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusClass(status?: string | null) {
  if (status === "published") return "status-badge status-published";
  if (status === "archived") return "status-badge status-archived";
  if (status === "hidden") return "status-badge status-hidden";
  return "status-badge status-draft";
}

function isJioHotstarPlatformName(value?: string | null) {
  const normalized = String(value || "").toLowerCase().replace(/\+/g, "plus").replace(/[^a-z0-9]+/g, "-");
  return ["hotstar", "jiohotstar", "jio-hotstar", "disney-hotstar", "disney-plus-hotstar"].some((token) => normalized.includes(token));
}

function hasJioHotstarAppRequiredWarning(movie: Movie) {
  return Boolean(movie.movie_platform_links?.some((link) => {
    const platformText = `${link.platforms?.name || ""} ${link.platforms?.slug || ""}`;
    return isJioHotstarPlatformName(platformText) && (link.app_required || link.mobile_web_supported === "no");
  }));
}

function normalizeAdminMovie(row: any): Movie {
  return {
    ...row,
    genres: (row.movie_genres ?? []).map((item: any) => item.genres).filter(Boolean),
    cast_members: (row.movie_cast ?? []).map((item: any) => item.cast_members).filter(Boolean),
    movie_platform_links: row.movie_platform_links ?? [],
    content_channel_items: row.content_channel_items ?? [],
    content_channels: (row.content_channel_items ?? []).map((item: any) => item.content_channels).filter(Boolean)
  } as Movie;
}

type AnalyticsEvent = {
  id: string;
  event_type: string;
  user_id?: string | null;
  anonymous_session_id?: string | null;
  movie_id?: string | null;
  movie_slug?: string | null;
  page_path?: string | null;
  search_query?: string | null;
  platform_name?: string | null;
  video_provider?: string | null;
  watch_seconds?: number | null;
  progress_percent?: number | null;
  device_type?: string | null;
  browser_name?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type AnalyticsSession = {
  id: string;
  anonymous_session_id: string;
  user_id?: string | null;
  last_seen_at?: string | null;
  page_views?: number | null;
  total_watch_seconds?: number | null;
  current_page?: string | null;
  device_type?: string | null;
  browser_name?: string | null;
};

type PendingMovieAction = {
  kind: "delete" | "archive" | "draft";
  movie: Movie;
  error?: string | null;
  isSubmitting?: boolean;
};

type PendingSeriesAction = {
  kind: "delete" | "archive" | "draft";
  series: Series;
  error?: string | null;
  isSubmitting?: boolean;
};

type AnalyticsData = {
  events: AnalyticsEvent[];
  sessions: AnalyticsSession[];
  debug?: {
    eventsCount: number;
    sessionsCount: number;
    lastEventAt?: string | null;
    lastEventType?: string | null;
    lastSessionAt?: string | null;
    errors?: string[];
  };
};

type MovieAnalyticsSummary = {
  views: number;
  uniqueSessions: number;
  watchSeconds: number;
  trailerPlays: number;
  linkClicks: number;
  completions: number;
  progressEvents: number;
  progressPercentTotal: number;
  todayViews: number;
  lastViewedAt?: string | null;
};

type AnalyticsRange = "today" | "yesterday" | "7d" | "28d" | "90d" | "all";
type MovieSort = "views" | "watchTime" | "linkClicks" | "latestViewed";
type AnalyticsTab = "overview" | "content" | "audience" | "traffic" | "search" | "platforms" | "live" | "debug";

const analyticsRanges: Array<{ label: string; value: AnalyticsRange }> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 28 days", value: "28d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" }
];

const movieSortOptions: Array<{ label: string; value: MovieSort }> = [
  { label: "Views", value: "views" },
  { label: "Watch time", value: "watchTime" },
  { label: "Link clicks", value: "linkClicks" },
  { label: "Latest viewed", value: "latestViewed" }
];

const analyticsTabs: Array<{ label: string; value: AnalyticsTab; icon: ReactNode }> = [
  { label: "Overview", value: "overview", icon: <BarChart3 size={16} /> },
  { label: "Content", value: "content", icon: <Film size={16} /> },
  { label: "Audience", value: "audience", icon: <Users size={16} /> },
  { label: "Traffic", value: "traffic", icon: <TrendingUp size={16} /> },
  { label: "Search", value: "search", icon: <Search size={16} /> },
  { label: "Platforms", value: "platforms", icon: <Link2 size={16} /> },
  { label: "Live", value: "live", icon: <Radio size={16} /> },
  { label: "Debug", value: "debug", icon: <Bug size={16} /> }
];

const addContentTypes: Array<{
  label: string;
  value: ContentEditorType;
  helper: string;
  highlighted?: boolean;
}> = [
  { label: "Movie", value: "movie", helper: "Use the normal movie upload form", highlighted: true },
  { label: "Trailer", value: "trailer", helper: "Save this listing with a Trailer badge" },
  { label: "TV Show", value: "tv_show", helper: "Save this listing with a TV Show badge" },
  { label: "Cartoon", value: "cartoon", helper: "Save this listing with a Cartoon badge" },
  { label: "Short Film", value: "short_film", helper: "Save this listing with a Short Film badge" },
  { label: "Web Series", value: "series", helper: "Create seasons and episodes", highlighted: true }
];

function normalizeContentEditorType(value?: string | null): ContentEditorType {
  if (value === "trailer" || value === "tv_show" || value === "cartoon" || value === "short_film") return value;
  if (value === "series") return "series";
  return "movie";
}

function compactNumber(value = 0) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function secondsLabel(seconds = 0) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function readableEventType(value?: string | null) {
  if (!value) return "Unknown event";
  const labels: Record<string, string> = {
    test_event: "Test Event",
    app_install_prompt_shown: "App install prompt shown"
  };
  if (labels[value]) return labels[value];
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function cleanPath(value?: string | null) {
  if (!value) return "/";
  try {
    const path = value.startsWith("http") ? new URL(value).pathname : value;
    return path.length > 44 ? `${path.slice(0, 41)}...` : path;
  } catch {
    return value.length > 44 ? `${value.slice(0, 41)}...` : value;
  }
}

function cleanPlatformName(value?: string | null) {
  if (!value) return "Official Trailer";
  const lowered = value.toLowerCase();
  if (lowered.includes("official trailer") || lowered.includes("trailer")) return "Official Trailer";
  if (lowered.includes("official video")) return "Official Video";
  return value;
}

function shortGuestId(value?: string | null) {
  if (!value) return "Guest";
  return `Guest ${value.replace(/-/g, "").slice(0, 6)}`;
}

function resultCountLabel(metadata?: Record<string, unknown> | null) {
  const count = metadata?.resultCount ?? metadata?.result_count;
  return typeof count === "number" ? compactNumber(count) : "Not tracked";
}

function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function isYesterday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

function eventInRange(event: AnalyticsEvent, range: AnalyticsRange) {
  if (range === "all") return true;
  if (!event.created_at) return false;
  const created = new Date(event.created_at).getTime();
  const now = Date.now();
  if (range === "today") return isToday(event.created_at);
  if (range === "yesterday") return isYesterday(event.created_at);
  const days = range === "7d" ? 7 : range === "28d" ? 28 : 90;
  return created >= now - days * 24 * 60 * 60 * 1000;
}

function sessionInRange(session: AnalyticsSession, range: AnalyticsRange) {
  if (range === "all") return true;
  const seenAt = session.last_seen_at;
  if (!seenAt) return false;
  if (range === "today") return isToday(seenAt);
  if (range === "yesterday") return isYesterday(seenAt);
  const days = range === "7d" ? 7 : range === "28d" ? 28 : 90;
  return new Date(seenAt).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function eventSessionKey(event: AnalyticsEvent) {
  return event.user_id || event.anonymous_session_id || event.id;
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "No activity";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(value);
}

function incrementCount(map: Map<string, number>, key?: string | null) {
  const cleanKey = key || "Unknown";
  map.set(cleanKey, (map.get(cleanKey) ?? 0) + 1);
}

function AnalyticsMetricCard({
  label,
  value,
  note,
  icon,
  trend
}: {
  label: string;
  value: string | number;
  note?: string;
  icon?: ReactNode;
  trend?: string;
}) {
  return (
    <div className="analytics-metric-card">
      <div className="analytics-metric-icon" aria-hidden="true">{icon || <Activity size={17} />}</div>
      <strong>{value}</strong>
      <span>{label}</span>
      {note || trend ? <small>{trend || note}</small> : null}
    </div>
  );
}

function AnalyticsEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="analytics-empty-inline">
      <span>No data</span>
      <p>{children}</p>
    </div>
  );
}

export default function AdminDashboard({
  initialMovies,
  initialSeries,
  genres,
  platforms,
  castMembers,
  collections,
  analytics
}: {
  initialMovies: Movie[];
  initialSeries: Series[];
  genres: Genre[];
  platforms: Platform[];
  castMembers: CastMember[];
  collections: any;
  analytics: AnalyticsData;
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [series, setSeries] = useState<Series[]>(initialSeries);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [contentEditorType, setContentEditorType] = useState<ContentEditorType>("movie");
  const [movieSearch, setMovieSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [flagFilter, setFlagFilter] = useState("");
  const [movieMessage, setMovieMessage] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("today");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overview");
  const [movieSort, setMovieSort] = useState<MovieSort>("views");
  const [analyticsTestMessage, setAnalyticsTestMessage] = useState<string | null>(null);
  const [pendingMovieAction, setPendingMovieAction] = useState<PendingMovieAction | null>(null);
  const [pendingSeriesAction, setPendingSeriesAction] = useState<PendingSeriesAction | null>(null);
  const [movieActionLoadingKey, setMovieActionLoadingKey] = useState<string | null>(null);
  const [seriesActionLoadingKey, setSeriesActionLoadingKey] = useState<string | null>(null);
  const contentChannels = (collections.contentChannels ?? []) as ContentChannel[];
  const contentChannelsError = typeof collections.contentChannelsError === "string" ? collections.contentChannelsError : null;

  const filteredMovies = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();
    return movies.filter((movie) => {
      if (query && !`${movie.title} ${movie.slug} ${movie.language || ""}`.toLowerCase().includes(query)) return false;
      if (statusFilter && movie.status !== statusFilter) return false;
      if (typeFilter && (movie.content_type || movie.type) !== typeFilter) return false;
      if (languageFilter && !String(movie.language || "").toLowerCase().includes(languageFilter.toLowerCase())) return false;
      if (flagFilter === "featured" && !movie.is_featured) return false;
      if (flagFilter === "latest" && !movie.is_latest) return false;
      if (flagFilter === "trending" && !movie.is_trending) return false;
      if (flagFilter === "homepage" && !getMovieVisibilityCheck(movie).visibleOnHomepageSlider) return false;
      return true;
    });
  }, [movies, movieSearch, statusFilter, typeFilter, languageFilter, flagFilter]);

  const analyticsStats = useMemo(() => {
    const allEvents = analytics?.events ?? [];
    const allSessions = analytics?.sessions ?? [];
    const events = allEvents.filter((event) => eventInRange(event, analyticsRange));
    const todayEvents = allEvents.filter((event) => isToday(event.created_at));
    const yesterdayEvents = allEvents.filter((event) => isYesterday(event.created_at));
    const rangeSessions = allSessions.filter((session) => sessionInRange(session, analyticsRange));
    const activeCutoff = Date.now() - 5 * 60 * 1000;
    const activeSessions = allSessions.filter((session) => {
      if (!session.last_seen_at) return false;
      return new Date(session.last_seen_at).getTime() >= activeCutoff;
    });
    const totalVisitorKeys = new Set([
      ...allSessions.map((session) => session.user_id || session.anonymous_session_id).filter(Boolean),
      ...allEvents.map(eventSessionKey).filter(Boolean)
    ]);
    const rangeVisitorKeys = new Set([
      ...rangeSessions.map((session) => session.user_id || session.anonymous_session_id).filter(Boolean),
      ...events.map(eventSessionKey).filter(Boolean)
    ]);
    const todayVisitorKeys = new Set([
      ...allSessions.filter((session) => isToday(session.last_seen_at)).map((session) => session.user_id || session.anonymous_session_id).filter(Boolean),
      ...todayEvents.map(eventSessionKey).filter(Boolean)
    ]);

    const movieMap = new Map<string, MovieAnalyticsSummary>();
    for (const event of events) {
      const key = event.movie_id || event.movie_slug;
      if (!key) continue;
      const current = movieMap.get(key) ?? {
        views: 0,
        uniqueSessions: 0,
        watchSeconds: 0,
        trailerPlays: 0,
        linkClicks: 0,
        completions: 0,
        progressEvents: 0,
        progressPercentTotal: 0,
        todayViews: 0,
        lastViewedAt: null
      };
      if (event.event_type === "movie_view") {
        current.views += 1;
        if (isToday(event.created_at)) current.todayViews += 1;
        if (!current.lastViewedAt || new Date(event.created_at || 0) > new Date(current.lastViewedAt)) {
          current.lastViewedAt = event.created_at;
        }
      }
      if (event.event_type === "trailer_play" || event.event_type === "trailer_open") current.trailerPlays += 1;
      if (event.event_type === "trailer_complete" || event.event_type === "licensed_video_complete") current.completions += 1;
      if (event.progress_percent !== null && event.progress_percent !== undefined) {
        current.progressEvents += 1;
        current.progressPercentTotal += event.progress_percent;
      }
      if (event.event_type === "watch_link_click") current.linkClicks += 1;
      if (event.watch_seconds) current.watchSeconds += event.watch_seconds;
      movieMap.set(key, current);
    }

    for (const [key, summary] of movieMap.entries()) {
      const sessions = new Set(
        events
          .filter((event) => (event.movie_id || event.movie_slug) === key)
          .map((event) => event.user_id || event.anonymous_session_id)
          .filter(Boolean)
      );
      summary.uniqueSessions = sessions.size;
    }

    const movieStatsById = new Map<string, MovieAnalyticsSummary>();
    for (const movie of movies) {
      const summary = movieMap.get(movie.id) || movieMap.get(movie.slug);
      if (summary) movieStatsById.set(movie.id, summary);
    }

    const topMoviesBase = Array.from(movieStatsById.entries())
      .map(([movieId, summary]) => ({ movie: movies.find((item) => item.id === movieId), summary }))
      .filter((item) => item.movie);

    const topMovies = [...topMoviesBase]
      .sort((a, b) => {
        if (movieSort === "watchTime") return b.summary.watchSeconds - a.summary.watchSeconds;
        if (movieSort === "linkClicks") return b.summary.linkClicks - a.summary.linkClicks;
        if (movieSort === "latestViewed") return new Date(b.summary.lastViewedAt || 0).getTime() - new Date(a.summary.lastViewedAt || 0).getTime();
        return b.summary.views - a.summary.views;
      })
      .slice(0, 10);

    const topWatchTime = [...topMoviesBase].sort((a, b) => b.summary.watchSeconds - a.summary.watchSeconds).slice(0, 10);

    const searches = new Map<string, { query: string; count: number; last: string | null }>();
    for (const event of events.filter((item) => item.event_type === "search" && item.search_query)) {
      const key = String(event.search_query).trim().toLowerCase();
      const current = searches.get(key) ?? { query: String(event.search_query), count: 0, last: null };
      current.count += 1;
      if (!current.last || new Date(event.created_at || 0) > new Date(current.last)) current.last = event.created_at || null;
      searches.set(key, current);
    }

    const platformClicks = new Map<string, { platform: string; clicks: number; last: string | null; movies: Set<string> }>();
    for (const event of events.filter((item) => item.event_type === "watch_link_click")) {
      const key = event.platform_name || "Official link";
      const current = platformClicks.get(key) ?? { platform: key, clicks: 0, last: null, movies: new Set<string>() };
      current.clicks += 1;
      if (event.movie_slug) current.movies.add(event.movie_slug);
      if (!current.last || new Date(event.created_at || 0) > new Date(current.last)) current.last = event.created_at || null;
      platformClicks.set(key, current);
    }

    const dailyMap = new Map<string, { date: string; pageViews: number; movieViews: number; watchSeconds: number; searches: number; linkClicks: number }>();
    for (const event of events) {
      const date = (event.created_at || "").slice(0, 10) || "Unknown";
      const current = dailyMap.get(date) ?? { date, pageViews: 0, movieViews: 0, watchSeconds: 0, searches: 0, linkClicks: 0 };
      if (event.event_type === "page_view") current.pageViews += 1;
      if (event.event_type === "movie_view") current.movieViews += 1;
      if (event.event_type === "search") current.searches += 1;
      if (event.event_type === "watch_link_click") current.linkClicks += 1;
      if (event.watch_seconds) current.watchSeconds += event.watch_seconds;
      dailyMap.set(date, current);
    }

    const pageMap = new Map<string, { path: string; views: number; sessions: Set<string>; last: string | null }>();
    for (const event of events.filter((item) => item.event_type === "page_view" && item.page_path)) {
      const key = event.page_path || "/";
      const current = pageMap.get(key) ?? { path: key, views: 0, sessions: new Set<string>(), last: null };
      current.views += 1;
      current.sessions.add(eventSessionKey(event));
      if (!current.last || new Date(event.created_at || 0) > new Date(current.last)) current.last = event.created_at || null;
      pageMap.set(key, current);
    }

    const referrerMap = new Map<string, { referrer: string; views: number; last: string | null }>();
    for (const event of events.filter((item) => item.event_type === "page_view" && item.referrer)) {
      const key = event.referrer || "Direct";
      const current = referrerMap.get(key) ?? { referrer: key, views: 0, last: null };
      current.views += 1;
      if (!current.last || new Date(event.created_at || 0) > new Date(current.last)) current.last = event.created_at || null;
      referrerMap.set(key, current);
    }

    const entryPageMap = new Map<string, AnalyticsEvent>();
    for (const event of [...events].filter((item) => item.event_type === "page_view" && item.page_path).sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())) {
      const key = eventSessionKey(event);
      if (!entryPageMap.has(key)) entryPageMap.set(key, event);
    }
    const entryPages = new Map<string, { path: string; entries: number }>();
    for (const event of entryPageMap.values()) {
      const key = event.page_path || "/";
      const current = entryPages.get(key) ?? { path: key, entries: 0 };
      current.entries += 1;
      entryPages.set(key, current);
    }

    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    for (const session of rangeSessions) {
      incrementCount(deviceMap, session.device_type || "Unknown");
      incrementCount(browserMap, session.browser_name || "Unknown");
    }
    if (!rangeSessions.length) {
      for (const event of events) {
        incrementCount(deviceMap, event.device_type || "Unknown");
        incrementCount(browserMap, event.browser_name || "Unknown");
      }
    }

    const loggedInVisitors = new Set([
      ...events.filter((event) => event.user_id).map((event) => event.user_id),
      ...rangeSessions.filter((session) => session.user_id).map((session) => session.user_id)
    ].filter(Boolean));
    const guestVisitors = new Set([
      ...events.filter((event) => !event.user_id).map((event) => event.anonymous_session_id),
      ...rangeSessions.filter((session) => !session.user_id).map((session) => session.anonymous_session_id)
    ].filter(Boolean));
    const selectedRangeLabel = analyticsRanges.find((range) => range.value === analyticsRange)?.label || "Selected range";
    const todayPageViews = todayEvents.filter((event) => event.event_type === "page_view").length;
    const yesterdayPageViews = yesterdayEvents.filter((event) => event.event_type === "page_view").length;
    const pageViewCompare = yesterdayPageViews
      ? `${Math.round(((todayPageViews - yesterdayPageViews) / yesterdayPageViews) * 100)}% vs yesterday`
      : "vs yesterday";

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
    const activePageMap = new Map<string, number>();
    for (const session of activeSessions) {
      incrementCount(activePageMap, session.current_page || "No page");
    }

    return {
      events,
      rangeSessions,
      activeSessions,
      selectedRangeLabel,
      todayVisitors: todayVisitorKeys.size,
      rangeVisitors: rangeVisitorKeys.size,
      totalVisitors: totalVisitorKeys.size,
      pageViewsToday: todayPageViews,
      movieViewsToday: todayEvents.filter((event) => event.event_type === "movie_view").length,
      watchSecondsToday: todayEvents.reduce((total, event) => total + (event.watch_seconds || 0), 0),
      watchLinkClicksToday: todayEvents.filter((event) => event.event_type === "watch_link_click").length,
      searchesToday: todayEvents.filter((event) => event.event_type === "search").length,
      rangePageViews: events.filter((event) => event.event_type === "page_view").length,
      rangeMovieViews: events.filter((event) => event.event_type === "movie_view").length,
      rangeWatchSeconds: events.reduce((total, event) => total + (event.watch_seconds || 0), 0),
      rangeWatchLinkClicks: events.filter((event) => event.event_type === "watch_link_click").length,
      rangeSearches: events.filter((event) => event.event_type === "search").length,
      totalWatchSeconds: allEvents.reduce((total, event) => total + (event.watch_seconds || 0), 0),
      pageViewCompare,
      movieStatsById,
      topMovies,
      topWatchTime,
      topVideos: [...topMoviesBase].sort((a, b) => (b.summary.trailerPlays + b.summary.watchSeconds) - (a.summary.trailerPlays + a.summary.watchSeconds)).slice(0, 10),
      recentMovieActivity: events
        .filter((event) => event.movie_id || event.movie_slug)
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12),
      topSearches: Array.from(searches.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      recentSearches: events
        .filter((event) => event.event_type === "search")
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12),
      platformClicks: Array.from(platformClicks.values())
        .map((item) => ({ platform: item.platform, clicks: item.clicks, last: item.last, movies: Array.from(item.movies).slice(0, 3) }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10),
      recentPlatformClicks: events
        .filter((event) => event.event_type === "watch_link_click")
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12),
      dailyTrend,
      maxDailyMetric: Math.max(1, ...dailyTrend.map((day) => Math.max(day.pageViews, day.movieViews, day.searches, day.linkClicks))),
      topPages: Array.from(pageMap.values())
        .map((item) => ({ path: item.path, views: item.views, uniqueSessions: item.sessions.size, last: item.last }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
      recentPageViews: events
        .filter((event) => event.event_type === "page_view")
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12),
      topReferrers: Array.from(referrerMap.values()).sort((a, b) => b.views - a.views).slice(0, 10),
      entryPages: Array.from(entryPages.values()).sort((a, b) => b.entries - a.entries).slice(0, 10),
      recentEvents: [...events]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 20),
      activePages: Array.from(activePageMap.entries()).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      deviceBreakdown: Array.from(deviceMap.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      browserBreakdown: Array.from(browserMap.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      loggedInVisitors: loggedInVisitors.size,
      guestVisitors: guestVisitors.size
    };
  }, [analytics, analyticsRange, movieSort, movies]);

  function showAddMovie(type: MovieEditorContentType = "movie") {
    setEditingMovie(null);
    setEditingSeries(null);
    setContentEditorType(type);
    setActiveSection("add-movie");
    setMovieMessage(null);
  }

  function showEditMovie(movie: Movie) {
    setEditingMovie(movie);
    setEditingSeries(null);
    setContentEditorType(normalizeContentEditorType(movie.content_type || movie.type));
    setActiveSection("add-movie");
    setMovieMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showAddSeries() {
    setEditingMovie(null);
    setEditingSeries(null);
    setContentEditorType("series");
    setActiveSection("add-movie");
    setMovieMessage(null);
  }

  function showEditSeries(seriesItem: Series) {
    setEditingMovie(null);
    setEditingSeries(seriesItem);
    setContentEditorType("series");
    setActiveSection("add-movie");
    setMovieMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openMovieById(movieId: string) {
    const movie = movies.find((item) => item.id === movieId);
    if (movie) {
      showEditMovie(movie);
      return;
    }

    setMovieMessage("Loading existing movie editor...");
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("movies")
      .select(movieSelect)
      .eq("id", movieId)
      .maybeSingle();

    if (error || !data) {
      setMovieMessage(error?.message || "Existing movie was not found.");
      return;
    }

    const loadedMovie = normalizeAdminMovie(data);
    setMovies((current) => current.some((item) => item.id === loadedMovie.id) ? current : [loadedMovie, ...current]);
    showEditMovie(loadedMovie);
  }

  function exportAdminBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      movies,
      series,
      genres,
      platforms,
      contentChannels
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `watchfinder-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function sendTestAnalyticsEvent() {
    setAnalyticsTestMessage("Sending test event...");
    await trackEvent({ event_type: "test_event", page_path: "/admin", metadata: { source: "admin_analytics_button" } });
    setAnalyticsTestMessage("Test event sent. Refreshing analytics data...");
    router.refresh();
    window.setTimeout(() => setAnalyticsTestMessage(null), 3500);
  }

  function handleSaved(savedMovie: Movie) {
    setMovies((current) => {
      const exists = current.some((movie) => movie.id === savedMovie.id);
      if (exists) {
        return current.map((movie) => movie.id === savedMovie.id ? { ...movie, ...savedMovie } : movie);
      }
      return [{ ...savedMovie, genres: [], cast_members: [], movie_platform_links: [] }, ...current];
    });
  }

  function handleSavedSeries(savedSeries: Series) {
    setSeries((current) => {
      const exists = current.some((item) => item.id === savedSeries.id);
      if (exists) return current.map((item) => item.id === savedSeries.id ? savedSeries : item);
      return [savedSeries, ...current];
    });
    setEditingSeries(savedSeries);
  }

  async function performSeriesStatusUpdate(seriesItem: Series, status: "published" | "draft" | "archived") {
    const loadingKey = `${seriesItem.id}:${status}`;
    setSeriesActionLoadingKey(loadingKey);
    setMovieMessage(`${status === "published" ? "Publishing" : `Moving to ${status}`} ${seriesItem.title}...`);

    const supabase = createSupabaseBrowserClient();
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("web_series")
      .update({ status, updated_at: updatedAt })
      .eq("id", seriesItem.id);

    setSeriesActionLoadingKey(null);

    if (error) {
      const message = `Series update failed: ${error.message}`;
      setMovieMessage(message);
      return { ok: false, message };
    }

    setSeries((current) => current.map((item) => (
      item.id === seriesItem.id ? { ...item, status, is_published: status === "published", updated_at: updatedAt } : item
    )));
    setEditingSeries((current) => current?.id === seriesItem.id ? { ...current, status, is_published: status === "published", updated_at: updatedAt } : current);
    setMovieMessage(`${seriesItem.title} ${status === "published" ? "published" : `moved to ${status}`}.`);
    router.refresh();
    return { ok: true, message: "Series updated." };
  }

  function requestSeriesAction(seriesItem: Series, kind: PendingSeriesAction["kind"]) {
    setPendingSeriesAction({ kind, series: seriesItem, error: null, isSubmitting: false });
    setMovieMessage(null);
  }

  async function performMovieStatusUpdate(movie: Movie, status: AdminMovieActionStatus) {
    const loadingKey = `${movie.id}:${status}`;
    setMovieActionLoadingKey(loadingKey);
    setMovieMessage(`${status === "published" ? "Publishing" : `Moving to ${status}`} ${movie.title}...`);

    const result = await updateMovieStatusById(movie.id, status);
    setMovieActionLoadingKey(null);

    if (!result.ok) {
      setMovieMessage(result.message);
      return result;
    }

    setMovies((current) => current.map((item) => (
      item.id === movie.id ? { ...item, status, updated_at: result.updatedAt ?? item.updated_at } : item
    )));
    setEditingMovie((current) => current?.id === movie.id ? { ...current, status, updated_at: result.updatedAt ?? current.updated_at } : current);
    setMovieMessage(`${movie.title} ${status === "published" ? "published" : `moved to ${status}`}.`);
    router.refresh();
    return result;
  }

  function requestMovieAction(movie: Movie, kind: PendingMovieAction["kind"]) {
    setPendingMovieAction({ kind, movie, error: null, isSubmitting: false });
    setMovieMessage(null);
  }

  async function confirmMovieAction() {
    if (!pendingMovieAction || pendingMovieAction.isSubmitting) return;
    const { movie, kind } = pendingMovieAction;
    setPendingMovieAction({ ...pendingMovieAction, isSubmitting: true, error: null });

    if (kind === "delete") {
      setMovieMessage(`Deleting ${movie.title}...`);
      const result = await deleteMovieById(movie.id);
      if (!result.ok) {
        setPendingMovieAction({ ...pendingMovieAction, isSubmitting: false, error: result.message });
        setMovieMessage(`Delete failed: ${result.message}`);
        return;
      }

      setMovies((current) => current.filter((item) => item.id !== movie.id));
      if (editingMovie?.id === movie.id) {
        setEditingMovie(null);
        setActiveSection("movies");
      }
      setPendingMovieAction(null);
      setMovieMessage("Movie deleted successfully.");
      router.refresh();
      return;
    }

    const nextStatus = kind === "archive" ? "archived" : "draft";
    const result = await performMovieStatusUpdate(movie, nextStatus);
    if (!result.ok) {
      setPendingMovieAction((current) => current ? { ...current, isSubmitting: false, error: result.message } : current);
      return;
    }
    setPendingMovieAction(null);
  }

  async function confirmSeriesAction() {
    if (!pendingSeriesAction || pendingSeriesAction.isSubmitting) return;
    const { series: seriesItem, kind } = pendingSeriesAction;
    setPendingSeriesAction({ ...pendingSeriesAction, isSubmitting: true, error: null });

    if (kind === "delete") {
      setMovieMessage(`Deleting ${seriesItem.title}...`);
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("web_series").delete().eq("id", seriesItem.id);
      if (error) {
        const message = `Delete failed: ${error.message}`;
        setPendingSeriesAction({ ...pendingSeriesAction, isSubmitting: false, error: message });
        setMovieMessage(message);
        return;
      }

      setSeries((current) => current.filter((item) => item.id !== seriesItem.id));
      if (editingSeries?.id === seriesItem.id) {
        setEditingSeries(null);
        setActiveSection("web-series");
      }
      setPendingSeriesAction(null);
      setMovieMessage("Web series deleted successfully.");
      router.refresh();
      return;
    }

    const nextStatus = kind === "archive" ? "archived" : "draft";
    const result = await performSeriesStatusUpdate(seriesItem, nextStatus);
    if (!result.ok) {
      setPendingSeriesAction((current) => current ? { ...current, isSubmitting: false, error: result.message } : current);
      return;
    }
    setPendingSeriesAction(null);
  }

  function actionModalCopy(action: PendingMovieAction) {
    if (action.kind === "delete") {
      return {
        title: "Delete this movie?",
        body: "This will permanently remove this movie and its related links. This cannot be undone.",
        confirm: "Delete permanently",
        danger: true
      };
    }
    if (action.kind === "archive") {
      return {
        title: "Archive this movie?",
        body: "This will hide the movie from the public website but keep it in admin.",
        confirm: "Archive movie",
        danger: false
      };
    }
    return {
      title: "Move this movie to draft?",
      body: "This will hide the movie from the public website while keeping it editable in admin.",
      confirm: "Move to draft",
      danger: false
    };
  }

  function seriesActionModalCopy(action: PendingSeriesAction) {
    if (action.kind === "delete") {
      return {
        title: "Delete this web series?",
        body: "This will permanently remove this series, its seasons, and its episodes. This cannot be undone.",
        confirm: "Delete permanently",
        danger: true
      };
    }
    if (action.kind === "archive") {
      return {
        title: "Archive this web series?",
        body: "This will hide the series from the public website but keep it editable in admin.",
        confirm: "Archive series",
        danger: false
      };
    }
    return {
      title: "Move this web series to draft?",
      body: "This will hide the series from the public website while keeping it editable in admin.",
      confirm: "Move to draft",
      danger: false
    };
  }

  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Admin sections">
        {sections.map((section) => (
          <button
            className={activeSection === section.id ? "chip active" : "chip"}
            key={section.id}
            onClick={() => {
              if (section.id === "add-movie") {
                setEditingMovie(null);
                setEditingSeries(null);
              }
              setActiveSection(section.id);
            }}
            type="button"
          >
            {section.label}
          </button>
        ))}
        <Link className="chip" href="/">Public site</Link>
      </nav>

      <div className="admin-content">
        {activeSection === "dashboard" ? (
          <section className="section">
            <h2>Dashboard overview</h2>
            <div className="grid">
              <div className="admin-card"><strong>{movies.length}</strong><p className="muted">Movies</p></div>
              <div className="admin-card"><strong>{series.length}</strong><p className="muted">Web series</p></div>
              <div className="admin-card"><strong>{genres.length}</strong><p className="muted">Genres</p></div>
              <div className="admin-card"><strong>{platforms.length}</strong><p className="muted">Platforms</p></div>
              <div className="admin-card"><strong>{collections.feedbackMessages.length}</strong><p className="muted">Feedback messages</p></div>
              <div className="admin-card"><strong>{analyticsStats.pageViewsToday}</strong><p className="muted">Page views today</p></div>
              <div className="admin-card"><strong>{analyticsStats.activeSessions.length}</strong><p className="muted">Active users now</p></div>
            </div>
          </section>
        ) : null}

        {activeSection === "movies" ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Movies</h2>
                <p className="muted">Search, edit, view, or archive saved movie listings.</p>
              </div>
              <button className="button primary" type="button" onClick={() => showAddMovie()}>
                <Plus size={18} /> Add Movie
              </button>
              <button className="button" type="button" onClick={showAddSeries}>
                <Plus size={18} /> Add Web Series
              </button>
              <button className="button" type="button" onClick={exportAdminBackup}>
                <Download size={18} /> Export JSON Backup
              </button>
            </div>
            {movieMessage ? <p className="form-message info">{movieMessage}</p> : null}
            <div className="panel form-grid admin-movie-filters">
              <label className="search-pill admin-search">
                <Search size={18} />
                <input value={movieSearch} onChange={(event) => setMovieSearch(event.target.value)} placeholder="Search title, slug, language" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="hidden">Hidden</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                <option value="movie">Movie</option>
                <option value="trailer">Trailer</option>
                <option value="tv_show">TV Show</option>
                <option value="cartoon">Cartoon</option>
                <option value="anime">Anime</option>
                <option value="short_film">Short Film</option>
              </select>
              <input value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} placeholder="Language filter" />
              <select value={flagFilter} onChange={(event) => setFlagFilter(event.target.value)}>
                <option value="">All flags</option>
                <option value="featured">Featured</option>
                <option value="latest">Latest</option>
                <option value="trending">Trending</option>
                <option value="homepage">Homepage visible</option>
              </select>
            </div>
            <div className="admin-movie-list">
              {filteredMovies.map((movie) => {
                const visibility = getMovieVisibilityCheck(movie);
                const platformsLabel = movie.movie_platform_links?.map((link) => link.platforms?.name).filter(Boolean).join(", ");
                return (
                  <article className="admin-movie-row" key={movie.id}>
                    <div className="admin-movie-thumb">
                      {movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span>{movie.title.slice(0, 1)}</span>}
                    </div>
                    <div className="admin-movie-main">
                      <strong>{movie.title}</strong>
                      <p className="muted">{movie.slug}</p>
                      <div className="meta-line">
                        <span className={statusClass(movie.status)}>{movie.status || "draft"}</span>
                        <span>{formatType(movie.content_type || movie.type)}</span>
                        <span>{movie.language || "No language"}</span>
                        <span>{platformsLabel || "No platform"}</span>
                        <span>{movie.content_channels?.map((channel) => channel.name).join(", ") || "No channel"}</span>
                        <span>Created {formatDate(movie.created_at)}</span>
                        <span>Updated {formatDate(movie.updated_at || movie.created_at)}</span>
                      </div>
                      <div className="meta-line">
                        {movie.is_featured ? <span className="platform-badge">Featured</span> : null}
                        {movie.is_latest ? <span className="platform-badge">Latest</span> : null}
                        {movie.is_trending ? <span className="platform-badge">Trending</span> : null}
                        {movie.primary_section ? <span className="platform-badge">Section: {movie.primary_section}</span> : null}
                        {movie.show_in_hero ? <span className="platform-badge">Hero</span> : null}
                        <span className={visibility.visibleOnPublicPages ? "legal-badge" : "status-badge status-draft"}>
                          Public: {visibility.visibleOnPublicPages ? "Visible" : visibility.publicReasons.join(", ")}
                        </span>
                        <span className={visibility.visibleOnHomepageSlider ? "legal-badge" : "status-badge status-draft"}>
                          Homepage: {visibility.homepageReasons.join(", ")}
                        </span>
                        {hasJioHotstarAppRequiredWarning(movie) ? (
                          <span className="status-badge status-draft">JioHotstar App Required</span>
                        ) : null}
                        {visibility.warnings.map((warning) => <span className="status-badge status-draft" key={warning}>{warning}</span>)}
                      </div>
                      {analyticsStats.movieStatsById.get(movie.id) ? (
                        <div className="meta-line">
                          <span>{analyticsStats.movieStatsById.get(movie.id)?.views ?? 0} views</span>
                          <span>{analyticsStats.movieStatsById.get(movie.id)?.trailerPlays ?? 0} trailer plays</span>
                          <span>{secondsLabel(analyticsStats.movieStatsById.get(movie.id)?.watchSeconds ?? 0)} watch time</span>
                          <span>{analyticsStats.movieStatsById.get(movie.id)?.linkClicks ?? 0} link clicks</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="admin-row-actions">
                      <button className="button" type="button" onClick={() => showEditMovie(movie)}>
                        <Edit3 size={16} /> Edit
                      </button>
                      <Link className="button" href={`/movie/${movie.slug}`}>
                        <Eye size={16} /> View
                      </Link>
                      {movie.status !== "published" ? (
                        <button className="button" type="button" disabled={movieActionLoadingKey === `${movie.id}:published`} onClick={() => performMovieStatusUpdate(movie, "published")}>
                          {movieActionLoadingKey === `${movie.id}:published` ? "Publishing..." : "Publish"}
                        </button>
                      ) : null}
                      {movie.status !== "draft" ? (
                        <button className="button ghost" type="button" onClick={() => requestMovieAction(movie, "draft")}>Move to Draft</button>
                      ) : null}
                      {movie.status !== "archived" ? (
                        <button className="button ghost" type="button" onClick={() => requestMovieAction(movie, "archive")}>Archive</button>
                      ) : null}
                      <button className="button danger" type="button" onClick={() => requestMovieAction(movie, "delete")}>
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </article>
                );
              })}
              {!filteredMovies.length ? <div className="empty">No movies found. Add your first movie.</div> : null}
            </div>
          </section>
        ) : null}

        {activeSection === "web-series" ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Web Series</h2>
                <p className="muted">Manage premium series, seasons, and legal episode links without touching movie uploads.</p>
              </div>
              <button className="button primary" type="button" onClick={showAddSeries}>
                <Plus size={18} /> Add Web Series
              </button>
            </div>
            <div className="admin-movie-list">
              {series.map((seriesItem) => (
                <article className="admin-movie-row" key={seriesItem.id}>
                  <div className="admin-movie-thumb">
                    {seriesItem.poster_url ? <img src={seriesItem.poster_url} alt="" /> : <span>{seriesItem.title.slice(0, 1)}</span>}
                  </div>
                  <div className="admin-movie-main">
                    <strong>{seriesItem.title}</strong>
                    <p className="muted">{seriesItem.slug}</p>
                    <div className="meta-line">
                      <span className={statusClass(seriesItem.status)}>{seriesItem.status || "draft"}</span>
                      <span>{seriesItem.language || "No language"}</span>
                      <span>{seriesItem.genre || "No genre"}</span>
                      <span>{seriesItem.platform_name || "No platform"}</span>
                      <span>{seriesItem.season_count ?? seriesItem.seasons?.length ?? 0} seasons</span>
                      <span>{seriesItem.episode_count ?? seriesItem.seasons?.reduce((total, season) => total + (season.episodes?.length ?? 0), 0) ?? 0} episodes</span>
                      {seriesItem.is_featured ? <span className="platform-badge">Featured</span> : null}
                      {seriesItem.is_latest ? <span className="platform-badge">Latest</span> : null}
                      {seriesItem.is_trending ? <span className="platform-badge">Trending</span> : null}
                    </div>
                  </div>
                  <div className="admin-row-actions">
                    <button className="button" type="button" onClick={() => showEditSeries(seriesItem)}>
                      <Edit3 size={16} /> Edit
                    </button>
                    <Link className="button" href={`/web-series/${seriesItem.slug}`}>
                      <Eye size={16} /> View
                    </Link>
                    {seriesItem.status !== "published" ? (
                      <button className="button" type="button" disabled={seriesActionLoadingKey === `${seriesItem.id}:published`} onClick={() => performSeriesStatusUpdate(seriesItem, "published")}>
                        {seriesActionLoadingKey === `${seriesItem.id}:published` ? "Publishing..." : "Publish"}
                      </button>
                    ) : null}
                    {seriesItem.status !== "draft" ? (
                      <button className="button ghost" type="button" onClick={() => requestSeriesAction(seriesItem, "draft")}>Move to Draft</button>
                    ) : null}
                    {seriesItem.status !== "archived" ? (
                      <button className="button ghost" type="button" onClick={() => requestSeriesAction(seriesItem, "archive")}>Archive</button>
                    ) : null}
                    <button className="button danger" type="button" onClick={() => requestSeriesAction(seriesItem, "delete")}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </article>
              ))}
              {!series.length ? <div className="empty">No web series yet. Add your first web series.</div> : null}
            </div>
          </section>
        ) : null}

        {activeSection === "ai-assistant" ? <AdminAIAssistant /> : null}

        {activeSection === "analytics" ? (
          <section className="section analytics-dashboard analytics-dashboard-v2">
            <div className="section-head analytics-hero-head">
              <div>
                <p className="rating-badge">Studio analytics</p>
                <h2>Analytics</h2>
                <p className="muted">Clean performance views for audience, content, search, platforms and live activity. WatchFinder does not store raw IP addresses.</p>
              </div>
              <div className="chip-row analytics-range-tabs" aria-label="Analytics time range">
                {analyticsRanges.map((range) => (
                  <button
                    className={analyticsRange === range.value ? "chip active" : "chip"}
                    key={range.value}
                    onClick={() => setAnalyticsRange(range.value)}
                    type="button"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {analytics.debug?.errors?.length ? (
              <div className="notice-card error">
                <strong>Analytics query failed.</strong>
                <p>Analytics query failed. Check Supabase RLS or analytics table policies.</p>
                <div className="meta-line">
                  {analytics.debug?.errors?.map((error) => (
                    <span key={error}>{error}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {!analyticsStats.events.length && !analyticsStats.activeSessions.length ? (
              <div className="notice-card analytics-empty-state">
                <strong>No analytics data yet.</strong>
                <p>Open the public site, search a movie, view a movie page, or click a trailer to start collecting analytics.</p>
                <p className="muted">Use the Debug tab for developer-only test events.</p>
              </div>
            ) : null}

            <div className="analytics-tabs" aria-label="Analytics sections">
              {analyticsTabs.map((tab) => (
                <button
                  className={analyticsTab === tab.value ? "analytics-tab active" : "analytics-tab"}
                  key={tab.value}
                  onClick={() => setAnalyticsTab(tab.value)}
                  type="button"
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {analyticsTab === "overview" ? (
              <div className="analytics-tab-panel">
                <div className="analytics-metric-grid">
                  <AnalyticsMetricCard icon={<Radio size={17} />} label="Active Users Now" value={compactNumber(analyticsStats.activeSessions.length)} note="Last 5 minutes" />
                  <AnalyticsMetricCard icon={<Users size={17} />} label="Today's Visitors" value={compactNumber(analyticsStats.todayVisitors)} note="Unique sessions today" />
                  <AnalyticsMetricCard icon={<Users size={17} />} label="Total Visitors" value={compactNumber(analyticsStats.totalVisitors)} note="All time unique sessions" />
                  <AnalyticsMetricCard icon={<BarChart3 size={17} />} label="Page Views" value={compactNumber(analyticsStats.rangePageViews)} trend={analyticsStats.pageViewCompare} />
                  <AnalyticsMetricCard icon={<Film size={17} />} label="Movie Views" value={compactNumber(analyticsStats.rangeMovieViews)} note={analyticsStats.selectedRangeLabel} />
                  <AnalyticsMetricCard icon={<Activity size={17} />} label="Watch Time" value={secondsLabel(analyticsStats.rangeWatchSeconds)} note={analyticsStats.selectedRangeLabel} />
                  <AnalyticsMetricCard icon={<MousePointerClick size={17} />} label="Watch Link Clicks" value={compactNumber(analyticsStats.rangeWatchLinkClicks)} note={analyticsStats.selectedRangeLabel} />
                  <AnalyticsMetricCard icon={<Search size={17} />} label="Searches" value={compactNumber(analyticsStats.rangeSearches)} note={analyticsStats.selectedRangeLabel} />
                </div>

                <div className="panel analytics-performance-panel">
                  <div className="section-head">
                    <div>
                      <h3>Performance over time</h3>
                      <p className="muted">Page views, movie views, watch time, searches and official link clicks.</p>
                    </div>
                  </div>
                  <div className="analytics-chart">
                    {analyticsStats.dailyTrend.map((day) => (
                      <div className="analytics-chart-day" key={day.date}>
                        <div className="analytics-bars" aria-label={`${day.date} performance`}>
                          <span style={{ height: `${Math.max(6, (day.pageViews / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.pageViews} page views`} />
                          <span style={{ height: `${Math.max(6, (day.movieViews / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.movieViews} movie views`} />
                          <span style={{ height: `${Math.max(6, (day.searches / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.searches} searches`} />
                          <span style={{ height: `${Math.max(6, (day.linkClicks / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.linkClicks} link clicks`} />
                        </div>
                        <small>{day.date.slice(5)}</small>
                      </div>
                    ))}
                  </div>
                  <div className="analytics-legend">
                    <span>Page views</span>
                    <span>Movie views</span>
                    <span>Searches</span>
                    <span>Link clicks</span>
                  </div>
                  <div className="analytics-card-list analytics-trend-list">
                    {analyticsStats.dailyTrend.map((day) => (
                      <article className="analytics-list-card" key={day.date}>
                        <strong>{day.date}</strong>
                        <span>{compactNumber(day.pageViews)} page views</span>
                        <span>{compactNumber(day.movieViews)} movie views</span>
                        <span>{secondsLabel(day.watchSeconds)} watch time</span>
                        <span>{compactNumber(day.searches)} searches</span>
                        <span>{compactNumber(day.linkClicks)} link clicks</span>
                      </article>
                    ))}
                    {!analyticsStats.dailyTrend.length ? <AnalyticsEmptyState>No daily trend yet.</AnalyticsEmptyState> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "content" ? (
              <div className="analytics-tab-panel">
                <div className="panel">
                  <div className="section-head">
                    <div>
                      <h3>Top Movies</h3>
                      <p className="muted">Ranked by the selected content metric.</p>
                    </div>
                    <div className="chip-row">
                      {movieSortOptions.map((option) => (
                        <button className={movieSort === option.value ? "chip active" : "chip"} key={option.value} onClick={() => setMovieSort(option.value)} type="button">
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="analytics-card-list">
                    {analyticsStats.topMovies.map(({ movie, summary }) => {
                      const averageWatch = summary.trailerPlays || summary.views ? Math.round(summary.watchSeconds / Math.max(summary.trailerPlays || summary.views, 1)) : 0;
                      return (
                        <article className="analytics-content-card" key={movie?.id}>
                          <div className="analytics-title-with-poster">
                            {movie?.poster_url ? <img src={movie.poster_url} alt="" /> : <span className="analytics-poster-fallback">{movie?.title?.slice(0, 1) || "W"}</span>}
                            <div>
                              <strong>{movie?.title}</strong>
                              <span>{formatTimeAgo(summary.lastViewedAt)}</span>
                            </div>
                          </div>
                          <div className="analytics-stat-strip">
                            <span><b>{compactNumber(summary.views)}</b> views</span>
                            <span><b>{compactNumber(summary.uniqueSessions)}</b> viewers</span>
                            <span><b>{secondsLabel(summary.watchSeconds)}</b> watch</span>
                            <span><b>{secondsLabel(averageWatch)}</b> avg</span>
                            <span><b>{compactNumber(summary.trailerPlays)}</b> trailer</span>
                            <span><b>{compactNumber(summary.linkClicks)}</b> links</span>
                          </div>
                        </article>
                      );
                    })}
                    {!analyticsStats.topMovies.length ? <AnalyticsEmptyState>No movie analytics yet.</AnalyticsEmptyState> : null}
                  </div>
                </div>

                <div className="form-grid two">
                  <div className="panel">
                    <h3>Top Videos / Trailers</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.topVideos.map(({ movie, summary }) => (
                        <article className="analytics-list-card" key={movie?.id}>
                          <strong>{movie?.title}</strong>
                          <span>{compactNumber(summary.trailerPlays)} opens / plays</span>
                          <span>{secondsLabel(summary.watchSeconds)} watch time</span>
                          <span>{summary.completions ? `${compactNumber(summary.completions)} completions` : "Not enough completion data"}</span>
                        </article>
                      ))}
                      {!analyticsStats.topVideos.length ? <AnalyticsEmptyState>No trailer data yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>

                  <div className="panel">
                    <h3>Movie Retention / Engagement</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.topWatchTime.map(({ movie, summary }) => {
                        const averageWatch = summary.trailerPlays || summary.views ? Math.round(summary.watchSeconds / Math.max(summary.trailerPlays || summary.views, 1)) : 0;
                        const completionRate = summary.trailerPlays ? Math.round((summary.completions / summary.trailerPlays) * 100) : 0;
                        const dropOff = summary.progressEvents ? Math.max(0, 100 - Math.round(summary.progressPercentTotal / summary.progressEvents)) : null;
                        return (
                          <article className="analytics-list-card" key={movie?.id}>
                            <strong>{movie?.title}</strong>
                            <span>Total {secondsLabel(summary.watchSeconds)}</span>
                            <span>Average {secondsLabel(averageWatch)}</span>
                            <span>{summary.completions ? `${completionRate}% complete` : "Not enough watch data yet"}</span>
                            <span>{dropOff !== null ? `${dropOff}% drop-off estimate` : "No progress data"}</span>
                          </article>
                        );
                      })}
                      {!analyticsStats.topWatchTime.length ? <AnalyticsEmptyState>Not enough watch data yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h3>Recent Movie Activity</h3>
                  <div className="analytics-card-list compact-list">
                    {analyticsStats.recentMovieActivity.map((event) => {
                      const movie = movies.find((item) => item.id === event.movie_id || item.slug === event.movie_slug);
                      return (
                        <article className="analytics-list-card" key={event.id}>
                          <strong>{movie?.title || event.movie_slug || "Unknown movie"}</strong>
                          <span>{readableEventType(event.event_type)}</span>
                          <span>{formatTimeAgo(event.created_at)}</span>
                        </article>
                      );
                    })}
                    {!analyticsStats.recentMovieActivity.length ? <AnalyticsEmptyState>No recent movie activity.</AnalyticsEmptyState> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "audience" ? (
              <div className="analytics-tab-panel">
                <div className="analytics-metric-grid compact">
                  <AnalyticsMetricCard icon={<Users size={17} />} label="Logged-in Users" value={compactNumber(analyticsStats.loggedInVisitors)} note={analyticsStats.selectedRangeLabel} />
                  <AnalyticsMetricCard icon={<Users size={17} />} label="Guest Users" value={compactNumber(analyticsStats.guestVisitors)} note={analyticsStats.selectedRangeLabel} />
                  <AnalyticsMetricCard icon={<Smartphone size={17} />} label="Active Sessions" value={compactNumber(analyticsStats.activeSessions.length)} note="Last 5 minutes" />
                  <AnalyticsMetricCard icon={<Activity size={17} />} label="Total Watch Time" value={secondsLabel(analyticsStats.totalWatchSeconds)} note="All time" />
                </div>
                <div className="form-grid two">
                  <div className="panel">
                    <h3>Device breakdown</h3>
                    <div className="audience-breakdown-grid">
                      {analyticsStats.deviceBreakdown.map((item) => <p className="breakdown-row" key={item.label}><span>{item.label}</span><b>{compactNumber(item.count)}</b></p>)}
                      {!analyticsStats.deviceBreakdown.length ? <AnalyticsEmptyState>No device data yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Browser breakdown</h3>
                    <div className="audience-breakdown-grid">
                      {analyticsStats.browserBreakdown.map((item) => <p className="breakdown-row" key={item.label}><span>{item.label}</span><b>{compactNumber(item.count)}</b></p>)}
                      {!analyticsStats.browserBreakdown.length ? <AnalyticsEmptyState>No browser data yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
                <div className="panel">
                  <h3>Active sessions</h3>
                  <div className="analytics-card-list">
                    {analyticsStats.activeSessions.slice(0, 12).map((session) => (
                      <article className="analytics-list-card" key={session.id}>
                        <strong>{session.user_id ? `User ${session.user_id.slice(0, 8)}` : shortGuestId(session.anonymous_session_id)}</strong>
                        <span className="analytics-path">{cleanPath(session.current_page)}</span>
                        <span>{session.device_type || "device"} / {session.browser_name || "browser"}</span>
                        <span>{formatTimeAgo(session.last_seen_at)}</span>
                      </article>
                    ))}
                    {!analyticsStats.activeSessions.length ? <AnalyticsEmptyState>No active sessions in the last 5 minutes.</AnalyticsEmptyState> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "traffic" ? (
              <div className="analytics-tab-panel">
                <div className="form-grid two">
                  <div className="panel">
                    <h3>Top Pages</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.topPages.map((page) => (
                        <article className="analytics-list-card" key={page.path}>
                          <strong className="analytics-path">{cleanPath(page.path)}</strong>
                          <span>{compactNumber(page.views)} views</span>
                          <span>{compactNumber(page.uniqueSessions)} unique sessions</span>
                          <span>{formatTimeAgo(page.last)}</span>
                        </article>
                      ))}
                      {!analyticsStats.topPages.length ? <AnalyticsEmptyState>No page views tracked yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Recent Page Views</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.recentPageViews.map((event) => (
                        <article className="analytics-list-card" key={event.id}>
                          <strong className="analytics-path">{cleanPath(event.page_path)}</strong>
                          <span>{event.device_type || "device"} / {event.browser_name || "browser"}</span>
                          <span>{formatTimeAgo(event.created_at)}</span>
                        </article>
                      ))}
                      {!analyticsStats.recentPageViews.length ? <AnalyticsEmptyState>No recent page views.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
                <div className="form-grid two">
                  <div className="panel">
                    <h3>Referrers</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.topReferrers.map((item) => (
                        <article className="analytics-list-card" key={item.referrer}>
                          <strong className="analytics-path">{cleanPath(item.referrer)}</strong>
                          <span>{compactNumber(item.views)} referred views</span>
                          <span>{formatTimeAgo(item.last)}</span>
                        </article>
                      ))}
                      {!analyticsStats.topReferrers.length ? <AnalyticsEmptyState>No referrers tracked yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Entry Pages</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.entryPages.map((page) => (
                        <article className="analytics-list-card" key={page.path}>
                          <strong className="analytics-path">{cleanPath(page.path)}</strong>
                          <span>{compactNumber(page.entries)} entries</span>
                        </article>
                      ))}
                      {!analyticsStats.entryPages.length ? <AnalyticsEmptyState>No entry page data yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "search" ? (
              <div className="analytics-tab-panel">
                <div className="form-grid two">
                  <div className="panel">
                    <h3>Top Search Queries</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.topSearches.map((search) => (
                        <article className="analytics-list-card" key={search.query}>
                          <strong>{search.query}</strong>
                          <span>{compactNumber(search.count)} searches</span>
                          <span>{formatTimeAgo(search.last)}</span>
                        </article>
                      ))}
                      {!analyticsStats.topSearches.length ? <AnalyticsEmptyState>No searches tracked yet. Try searching from the public site.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Recent Searches</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.recentSearches.map((event) => (
                        <article className="analytics-list-card" key={event.id}>
                          <strong>{event.search_query || "Unknown search"}</strong>
                          <span>{resultCountLabel(event.metadata)} results</span>
                          <span>{formatTimeAgo(event.created_at)}</span>
                        </article>
                      ))}
                      {!analyticsStats.recentSearches.length ? <AnalyticsEmptyState>No recent searches.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "platforms" ? (
              <div className="analytics-tab-panel">
                <div className="form-grid two">
                  <div className="panel">
                    <h3>Top Watch Platforms</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.platformClicks.map((item) => (
                        <article className="analytics-list-card" key={item.platform}>
                          <strong>{cleanPlatformName(item.platform)}</strong>
                          <span>{compactNumber(item.clicks)} clicks</span>
                          <span>{item.movies.join(", ") || "Multiple titles"}</span>
                          <span>{formatTimeAgo(item.last)}</span>
                        </article>
                      ))}
                      {!analyticsStats.platformClicks.length ? <AnalyticsEmptyState>No platform clicks yet.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Recent Link Clicks</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.recentPlatformClicks.map((event) => {
                        const movie = movies.find((item) => item.id === event.movie_id || item.slug === event.movie_slug);
                        return (
                          <article className="analytics-list-card" key={event.id}>
                            <strong>{cleanPlatformName(event.platform_name)}</strong>
                            <span>{movie?.title || event.movie_slug || "No movie attached"}</span>
                            <span>{formatTimeAgo(event.created_at)}</span>
                          </article>
                        );
                      })}
                      {!analyticsStats.recentPlatformClicks.length ? <AnalyticsEmptyState>No recent link clicks.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "live" ? (
              <div className="analytics-tab-panel">
                <div className="analytics-metric-grid compact">
                  <AnalyticsMetricCard icon={<Radio size={17} />} label="Active Users Now" value={compactNumber(analyticsStats.activeSessions.length)} note="Last 5 minutes" />
                  <AnalyticsMetricCard icon={<BarChart3 size={17} />} label="Live Pages" value={compactNumber(analyticsStats.activePages.length)} note="Pages active in last 5 minutes" />
                </div>
                <div className="form-grid two">
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <h3>Live pages</h3>
                        <p className="muted">Where active users are right now.</p>
                      </div>
                      <button className="button" type="button" onClick={() => router.refresh()}>Refresh</button>
                    </div>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.activePages.map((page) => (
                        <article className="analytics-list-card" key={page.path}>
                          <strong className="analytics-path">{cleanPath(page.path)}</strong>
                          <span>{compactNumber(page.count)} active</span>
                        </article>
                      ))}
                      {!analyticsStats.activePages.length ? <AnalyticsEmptyState>No live pages right now.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                  <div className="panel">
                    <h3>Recent Activity Feed</h3>
                    <div className="analytics-card-list compact-list">
                      {analyticsStats.recentEvents.slice(0, 14).map((event) => {
                        const movie = movies.find((item) => item.id === event.movie_id || item.slug === event.movie_slug);
                        return (
                          <article className="analytics-list-card" key={event.id}>
                            <strong>{readableEventType(event.event_type)}</strong>
                            <span>{movie?.title || cleanPath(event.page_path) || event.search_query || "WatchFinder"}</span>
                            <span>{event.device_type || "device"} / {formatTimeAgo(event.created_at)}</span>
                          </article>
                        );
                      })}
                      {!analyticsStats.recentEvents.length ? <AnalyticsEmptyState>No recent events in this range.</AnalyticsEmptyState> : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {analyticsTab === "debug" ? (
              <div className="analytics-tab-panel">
                <div className="panel analytics-debug-panel">
                  <div>
                    <h3>Analytics Debug</h3>
                    <p className="muted">Admin/developer-only diagnostics. Technical checks live here so the main dashboard stays clean.</p>
                  </div>
                  <div className="analytics-metric-grid compact">
                    <AnalyticsMetricCard icon={<Bug size={17} />} label="Total Events" value={compactNumber(analytics.debug?.eventsCount ?? analytics.events.length)} />
                    <AnalyticsMetricCard icon={<Bug size={17} />} label="Total Sessions" value={compactNumber(analytics.debug?.sessionsCount ?? analytics.sessions.length)} />
                    <AnalyticsMetricCard icon={<Activity size={17} />} label="Last Event" value={analytics.debug?.lastEventAt ? formatTimeAgo(analytics.debug.lastEventAt) : "None"} />
                    <AnalyticsMetricCard icon={<Activity size={17} />} label="Last Event Type" value={readableEventType(analytics.debug?.lastEventType)} />
                    <AnalyticsMetricCard icon={<Activity size={17} />} label="Last Session" value={analytics.debug?.lastSessionAt ? formatTimeAgo(analytics.debug.lastSessionAt) : "None"} />
                  </div>
                  <div className="chip-row">
                    <button className="button primary" type="button" onClick={sendTestAnalyticsEvent}>
                      <Activity size={16} /> Send Test Analytics Event
                    </button>
                    {analyticsTestMessage ? <span className="chip active">{analyticsTestMessage}</span> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {false && activeSection === "analytics" ? (
          <section className="section analytics-dashboard">
            <div className="section-head analytics-hero-head">
              <div>
                <p className="rating-badge">Studio analytics</p>
                <h2>Analytics</h2>
                <p className="muted">Privacy-friendly audience, content, search and platform performance. WatchFinder does not store raw IP addresses.</p>
              </div>
              <div className="chip-row analytics-range-tabs">
                {analyticsRanges.map((range) => (
                  <button
                    className={analyticsRange === range.value ? "chip active" : "chip"}
                    key={range.value}
                    onClick={() => setAnalyticsRange(range.value)}
                    type="button"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {analytics.debug?.errors?.length ? (
              <div className="notice-card error">
                <strong>Analytics query failed.</strong>
                <p>Analytics query failed. Check Supabase RLS or analytics table policies.</p>
                <div className="meta-line">
                  {analytics.debug?.errors?.map((error) => (
                    <span key={error}>{error}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {!analyticsStats.events.length && !analyticsStats.activeSessions.length ? (
              <div className="notice-card analytics-empty-state">
                <strong>No analytics data yet.</strong>
                <p>Open the public site, search a movie, view a movie page, or click a trailer to start collecting analytics.</p>
                <button className="button primary" type="button" onClick={sendTestAnalyticsEvent}>
                  <Activity size={16} /> Send Test Analytics Event
                </button>
                {analyticsTestMessage ? <span className="chip active">{analyticsTestMessage}</span> : null}
              </div>
            ) : null}

            <div className="analytics-metric-grid">
              <AnalyticsMetricCard label="Active Users Now" value={compactNumber(analyticsStats.activeSessions.length)} note="Last 5 minutes" />
              <AnalyticsMetricCard label="Today's Visitors" value={compactNumber(analyticsStats.todayVisitors)} note="Unique sessions today" />
              <AnalyticsMetricCard label="Total Visitors" value={compactNumber(analyticsStats.totalVisitors)} note="All time unique sessions" />
              <AnalyticsMetricCard label="Page Views" value={compactNumber(analyticsStats.rangePageViews)} note={analyticsStats.pageViewCompare} />
              <AnalyticsMetricCard label="Movie Views" value={compactNumber(analyticsStats.rangeMovieViews)} note={analyticsStats.selectedRangeLabel} />
              <AnalyticsMetricCard label="Watch Time" value={secondsLabel(analyticsStats.rangeWatchSeconds)} note={analyticsStats.selectedRangeLabel} />
              <AnalyticsMetricCard label="Total Watch Time" value={secondsLabel(analyticsStats.totalWatchSeconds)} note="All time" />
              <AnalyticsMetricCard label="Searches" value={compactNumber(analyticsStats.rangeSearches)} note={analyticsStats.selectedRangeLabel} />
              <AnalyticsMetricCard label="Watch Link Clicks" value={compactNumber(analyticsStats.rangeWatchLinkClicks)} note={analyticsStats.selectedRangeLabel} />
            </div>

            <div className="panel analytics-performance-panel">
              <div className="section-head">
                <div>
                  <h3>Performance over time</h3>
                  <p className="muted">Page views, movie views, watch time, searches and official link clicks.</p>
                </div>
              </div>
              <div className="analytics-chart">
                {analyticsStats.dailyTrend.map((day) => (
                  <div className="analytics-chart-day" key={day.date}>
                    <div className="analytics-bars" aria-label={`${day.date} performance`}>
                      <span style={{ height: `${Math.max(6, (day.pageViews / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.pageViews} page views`} />
                      <span style={{ height: `${Math.max(6, (day.movieViews / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.movieViews} movie views`} />
                      <span style={{ height: `${Math.max(6, (day.searches / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.searches} searches`} />
                      <span style={{ height: `${Math.max(6, (day.linkClicks / analyticsStats.maxDailyMetric) * 100)}%` }} title={`${day.linkClicks} link clicks`} />
                    </div>
                    <small>{day.date.slice(5)}</small>
                  </div>
                ))}
              </div>
              <div className="analytics-legend">
                <span>Page views</span>
                <span>Movie views</span>
                <span>Searches</span>
                <span>Link clicks</span>
              </div>
              <div className="admin-mini-table analytics-table">
                <div className="admin-mini-row table-head">
                  <strong>Date</strong>
                  <span>Page Views</span>
                  <span>Movie Views</span>
                  <span>Watch Time</span>
                  <span>Searches</span>
                  <span>Link Clicks</span>
                </div>
                {analyticsStats.dailyTrend.map((day) => (
                  <div className="admin-mini-row analytics-wide-row" key={day.date}>
                    <strong>{day.date}</strong>
                    <span>{compactNumber(day.pageViews)}</span>
                    <span>{compactNumber(day.movieViews)}</span>
                    <span>{secondsLabel(day.watchSeconds)}</span>
                    <span>{compactNumber(day.searches)}</span>
                    <span>{compactNumber(day.linkClicks)}</span>
                  </div>
                ))}
                {!analyticsStats.dailyTrend.length ? <p className="muted">No daily trend yet.</p> : null}
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Top Movies</h3>
                  <p className="muted">YouTube Studio style content performance ranked by the selected metric.</p>
                </div>
                <div className="chip-row">
                  {movieSortOptions.map((option) => (
                    <button className={movieSort === option.value ? "chip active" : "chip"} key={option.value} onClick={() => setMovieSort(option.value)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-mini-table analytics-table">
                <div className="admin-mini-row analytics-movie-row table-head">
                  <strong>Movie</strong>
                  <span>Views</span>
                  <span>Watch time</span>
                  <span>Avg watch</span>
                  <span>Trailer plays</span>
                  <span>Link clicks</span>
                  <span>Last viewed</span>
                </div>
                {analyticsStats.topMovies.map(({ movie, summary }) => {
                  const averageWatch = summary.trailerPlays || summary.views ? Math.round(summary.watchSeconds / Math.max(summary.trailerPlays || summary.views, 1)) : 0;
                  return (
                    <div className="admin-mini-row analytics-movie-row" key={movie?.id}>
                      <strong className="analytics-movie-title">
                        {movie?.poster_url ? <img src={movie.poster_url} alt="" /> : null}
                        <span>{movie?.title}</span>
                      </strong>
                      <span>{compactNumber(summary.views)}</span>
                      <span>{secondsLabel(summary.watchSeconds)}</span>
                      <span>{secondsLabel(averageWatch)}</span>
                      <span>{compactNumber(summary.trailerPlays)}</span>
                      <span>{compactNumber(summary.linkClicks)}</span>
                      <span>{formatTimeAgo(summary.lastViewedAt)}</span>
                    </div>
                  );
                })}
                {!analyticsStats.topMovies.length ? <p className="muted">No movie analytics yet.</p> : null}
              </div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Movie Retention / Engagement</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topWatchTime.map(({ movie, summary }) => {
                    const averageWatch = summary.trailerPlays || summary.views ? Math.round(summary.watchSeconds / Math.max(summary.trailerPlays || summary.views, 1)) : 0;
                    const completionRate = summary.trailerPlays ? Math.round((summary.completions / summary.trailerPlays) * 100) : 0;
                    const dropOff = summary.progressEvents ? Math.max(0, 100 - Math.round(summary.progressPercentTotal / summary.progressEvents)) : null;
                    return (
                      <div className="admin-mini-row analytics-engagement-row" key={movie?.id}>
                        <strong>{movie?.title}</strong>
                        <span>Total {secondsLabel(summary.watchSeconds)}</span>
                        <span>Avg {secondsLabel(averageWatch)}</span>
                        <span>{summary.completions ? `${completionRate}% complete` : "Not enough watch data yet"}</span>
                        <span>{dropOff !== null ? `${dropOff}% drop-off est.` : "No progress data"}</span>
                      </div>
                    );
                  })}
                  {!analyticsStats.topWatchTime.length ? <p className="muted">Not enough watch data yet.</p> : null}
                </div>
              </div>

              <div className="panel">
                <h3>Live Activity</h3>
                <div className="admin-mini-table">
                  <div className="admin-mini-row analytics-live-row table-head">
                    <strong>User / Guest</strong>
                    <span>Current Page</span>
                    <span>Device</span>
                    <span>Last Seen</span>
                  </div>
                  {analyticsStats.activeSessions.slice(0, 12).map((session) => (
                    <div className="admin-mini-row analytics-live-row" key={session.id}>
                      <strong>{session.user_id ? `User ${session.user_id.slice(0, 8)}` : `Guest ${session.anonymous_session_id.slice(0, 8)}`}</strong>
                      <span>{session.current_page || "No page"}</span>
                      <span>{session.device_type || "device"} · {session.browser_name || "browser"}</span>
                      <span>{formatTimeAgo(session.last_seen_at)}</span>
                    </div>
                  ))}
                  {!analyticsStats.activeSessions.length ? <p className="muted">No active sessions in the last 5 minutes.</p> : null}
                </div>
              </div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Audience</h3>
                <div className="audience-breakdown-grid">
                  <div>
                    <strong>Device breakdown</strong>
                    {analyticsStats.deviceBreakdown.map((item) => <p className="breakdown-row" key={item.label}><span>{item.label}</span><b>{compactNumber(item.count)}</b></p>)}
                  </div>
                  <div>
                    <strong>Browser breakdown</strong>
                    {analyticsStats.browserBreakdown.map((item) => <p className="breakdown-row" key={item.label}><span>{item.label}</span><b>{compactNumber(item.count)}</b></p>)}
                  </div>
                  <div>
                    <strong>Logged-in vs Guest</strong>
                    <p className="breakdown-row"><span>Logged-in</span><b>{compactNumber(analyticsStats.loggedInVisitors)}</b></p>
                    <p className="breakdown-row"><span>Guest</span><b>{compactNumber(analyticsStats.guestVisitors)}</b></p>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h3>Top Searches</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topSearches.map((search) => (
                    <div className="admin-mini-row analytics-search-row" key={search.query}>
                      <strong>{search.query}</strong>
                      <span>{compactNumber(search.count)} searches</span>
                      <span>{formatTimeAgo(search.last)}</span>
                    </div>
                  ))}
                  {!analyticsStats.topSearches.length ? <p className="muted">No searches tracked yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Top Watch Platforms</h3>
                <div className="admin-mini-table">
                  {analyticsStats.platformClicks.map((item) => (
                    <div className="admin-mini-row analytics-platform-row" key={item.platform}>
                      <strong>{item.platform}</strong>
                      <span>{compactNumber(item.clicks)} clicks</span>
                      <span>{item.movies.join(", ") || "Multiple titles"}</span>
                      <span>{formatTimeAgo(item.last)}</span>
                    </div>
                  ))}
                  {!analyticsStats.platformClicks.length ? <p className="muted">No platform clicks yet.</p> : null}
                </div>
              </div>

              <div className="panel">
                <h3>Top Pages</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topPages.map((page) => (
                    <div className="admin-mini-row analytics-page-row" key={page.path}>
                      <strong>{page.path}</strong>
                      <span>{compactNumber(page.views)} views</span>
                      <span>{compactNumber(page.uniqueSessions)} unique</span>
                      <span>{formatTimeAgo(page.last)}</span>
                    </div>
                  ))}
                  {!analyticsStats.topPages.length ? <p className="muted">No page views tracked yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="panel analytics-debug-panel">
              <div>
                <h3>Analytics debug</h3>
                <p className="muted">Use this to confirm inserts and admin reads are working.</p>
              </div>
              <div className="analytics-metric-grid compact">
                <AnalyticsMetricCard label="Total events" value={compactNumber(analytics.debug?.eventsCount ?? analytics.events.length)} />
                <AnalyticsMetricCard label="Total sessions" value={compactNumber(analytics.debug?.sessionsCount ?? analytics.sessions.length)} />
                <AnalyticsMetricCard label="Last event" value={analytics.debug?.lastEventAt ? formatTimeAgo(analytics.debug?.lastEventAt) : "None"} />
                <AnalyticsMetricCard label="Last event type" value={analytics.debug?.lastEventType || "None"} />
                <AnalyticsMetricCard label="Last session" value={analytics.debug?.lastSessionAt ? formatTimeAgo(analytics.debug?.lastSessionAt) : "None"} />
              </div>
              <div className="chip-row">
                <button className="button primary" type="button" onClick={sendTestAnalyticsEvent}>
                  <Activity size={16} /> Send Test Analytics Event
                </button>
                {analyticsTestMessage ? <span className="chip active">{analyticsTestMessage}</span> : null}
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "add-movie" ? (
          <section className="section">
            {movieMessage ? <p className="form-message info">{movieMessage}</p> : null}
            {!editingMovie && !editingSeries ? (
              <div className="panel content-type-switcher">
                <p className="rating-badge">Content Type</p>
                <h2>What are you adding?</h2>
                <p className="muted">Movie, trailer, TV show, cartoon, and short film use the existing upload flow. Web Series opens a season and episode editor.</p>
                <div className="option-group compact-options">
                  {addContentTypes.map((type) => (
                    <label className={type.highlighted ? "option-card option-card-published" : "option-card"} key={type.value}>
                      <input
                        checked={contentEditorType === type.value}
                        name="admin_content_editor_type"
                        onChange={() => {
                          setEditingMovie(null);
                          setEditingSeries(null);
                          setContentEditorType(type.value);
                          setMovieMessage(null);
                        }}
                        type="radio"
                        value={type.value}
                      />
                      <span>{type.label}</span>
                      <small>{type.helper}</small>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {contentEditorType !== "series" ? (
              <AdminMovieForm
                key={editingMovie?.id || `new-${contentEditorType}`}
                genres={genres}
                castMembers={castMembers}
                platforms={platforms}
                initialMovie={editingMovie}
                initialContentType={contentEditorType}
                onSaved={handleSaved}
                onDuplicateSlug={openMovieById}
                onArchiveMovie={(movie) => requestMovieAction(movie, "archive")}
                onDeleteMovie={(movie) => requestMovieAction(movie, "delete")}
                onBackToMovies={() => setActiveSection("movies")}
                onAddNew={() => showAddMovie(contentEditorType)}
                movieAnalytics={editingMovie ? analyticsStats.movieStatsById.get(editingMovie.id) : undefined}
                contentChannels={contentChannels}
                contentChannelsError={contentChannelsError}
              />
            ) : (
              <AdminSeriesForm
                key={editingSeries?.id || "new-series"}
                genres={genres}
                initialSeries={editingSeries}
                onSaved={handleSavedSeries}
                onAddNew={showAddSeries}
                onBackToSeries={() => setActiveSection("web-series")}
              />
            )}
          </section>
        ) : null}

        {activeSection === "genres" ? <section className="section"><h2>Genres</h2><div className="chip-row">{genres.map((genre) => <span className="chip" key={genre.id}>{genre.name}</span>)}</div></section> : null}
        {activeSection === "platforms" ? <section className="section"><h2>Platforms</h2><div className="chip-row">{platforms.map((platform) => <span className="chip" key={platform.id}>{platform.name}</span>)}</div></section> : null}
        {activeSection === "cast-members" ? <section className="section"><h2>Cast Members</h2><div className="chip-row">{castMembers.map((member) => <span className="chip" key={member.id}>{member.name}</span>)}</div></section> : null}
        {activeSection === "cartoon-channels" ? <section className="section"><AdminChannelManager initialChannels={contentChannels} channelType="cartoon" title="Cartoon Channels" tableError={contentChannelsError} /></section> : null}
        {activeSection === "tv-show-channels" ? <section className="section"><AdminChannelManager initialChannels={contentChannels} channelType="tv_show" title="TV Show Channels" tableError={contentChannelsError} /></section> : null}
        {activeSection === "channel-links" ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Manage Channel Links</h2>
                <p className="muted">Channel links are stored in Supabase content_channel_items. Open a movie editor to connect cartoons and TV shows to one or more channels.</p>
              </div>
              <button className="button primary" type="button" onClick={() => showAddMovie()}>
                <Plus size={18} /> Add Movie
              </button>
            </div>
            {contentChannelsError ? (
              <div className="notice-card error">
                <strong>Cartoon/TV Show tables are missing.</strong>
                <p>{contentChannelsError}</p>
              </div>
            ) : null}
            <div className="form-grid two">
              <div className="panel">
                <h3>Supabase Channels</h3>
                <div className="admin-movie-list compact-list">
                  {contentChannels.map((channel) => (
                    <article className="admin-movie-row" key={channel.id}>
                      <div className="admin-movie-thumb">
                        <ChannelLogo channel={channel} />
                      </div>
                      <div className="admin-movie-main">
                        <strong>{channel.name}</strong>
                        <p className="muted">{channel.slug}</p>
                        <div className="meta-line">
                          <span>{channel.channel_type === "cartoon" ? "Cartoon" : "TV Show"}</span>
                          <span>{channel.item_count || 0} linked titles</span>
                          <span>{channel.is_active === false ? "inactive" : "active"}</span>
                        </div>
                      </div>
                      <div className="admin-row-actions">
                        <button
                          className="button"
                          type="button"
                          onClick={() => setActiveSection(channel.channel_type === "cartoon" ? "cartoon-channels" : "tv-show-channels")}
                        >
                          Edit Channel
                        </button>
                      </div>
                    </article>
                  ))}
                  {!contentChannels.length && !contentChannelsError ? <div className="empty">No Supabase channels yet. Run the migration or add a channel.</div> : null}
                </div>
              </div>
              <div className="panel">
                <h3>Linked Movies</h3>
                <div className="admin-movie-list compact-list">
                  {movies
                    .filter((movie) => movie.content_channels?.length)
                    .map((movie) => (
                      <article className="admin-movie-row" key={movie.id}>
                        <div className="admin-movie-thumb">
                          {movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span>{movie.title.slice(0, 1)}</span>}
                        </div>
                        <div className="admin-movie-main">
                          <strong>{movie.title}</strong>
                          <p className="muted">{movie.slug}</p>
                          <div className="meta-line">
                            <span>{movie.content_channels?.map((channel) => channel.name).join(", ")}</span>
                          </div>
                        </div>
                        <div className="admin-row-actions">
                          <button className="button" type="button" onClick={() => showEditMovie(movie)}>
                            <Edit3 size={16} /> Edit Links
                          </button>
                        </div>
                      </article>
                    ))}
                  {!movies.some((movie) => movie.content_channels?.length) ? (
                    <div className="empty">No movie is linked to a cartoon or TV channel yet. Edit a movie and use the Cartoon / TV Show Channel section.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}
        {activeSection === "promotions" ? <section className="section"><h2>Promotions</h2><AdminPromotionForm /><div className="form-grid section">{collections.promotions.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.placement} - {item.is_active ? "active" : "inactive"}</p></div>)}</div></section> : null}
        {activeSection === "ad-slots" ? <section className="section"><h2>Ad Slots</h2><AdminAdSlotForm /><div className="form-grid section">{collections.adSlots.map((item: any) => <div className="panel" key={item.id}><strong>{item.slot_name}</strong><p className="muted">{item.placement} - {item.is_active ? "active" : "inactive"}</p></div>)}</div></section> : null}
        {activeSection === "blog-posts" ? <section className="section"><h2>Blog Posts</h2><AdminBlogForm /><div className="form-grid section">{collections.blogPosts.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.status} - {item.category}</p></div>)}</div></section> : null}
        {activeSection === "feedback-messages" ? <section className="section"><h2>Feedback Messages</h2><div className="form-grid">{collections.feedbackMessages.map((item: any) => <div className="panel" key={item.id}><strong>{item.subject || item.email || "Feedback"}</strong><p className="muted">{item.message}</p></div>)}</div></section> : null}
        {activeSection === "license-documents" ? <section className="section"><h2>License Documents</h2><AdminLicenseForm movies={movies} /><div className="form-grid section">{collections.licenseDocuments.map((item: any) => <div className="panel" key={item.id}><strong>{item.license_type || "License"}</strong><p className="muted">{item.movie_id}</p></div>)}</div></section> : null}
        {activeSection === "site-settings" ? <section className="section"><h2>Site Settings</h2><div className="form-grid">{collections.siteSettings.map((item: any) => <div className="panel" key={item.id}><strong>{item.key || item.id}</strong><p className="muted">{String(item.value ?? "")}</p></div>)}</div></section> : null}
      </div>
      {pendingMovieAction ? (() => {
        const copy = actionModalCopy(pendingMovieAction);
        const movie = pendingMovieAction.movie;
        return (
          <div className="admin-action-modal-backdrop" role="presentation" onMouseDown={() => !pendingMovieAction.isSubmitting && setPendingMovieAction(null)}>
            <section
              aria-labelledby="admin-movie-action-title"
              aria-modal="true"
              className="admin-action-modal"
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="section-head">
                <div>
                  <p className={copy.danger ? "status-badge status-hidden" : "status-badge status-draft"}>{copy.danger ? "Danger action" : "Visibility action"}</p>
                  <h2 id="admin-movie-action-title">{copy.title}</h2>
                  <p className="muted">{copy.body}</p>
                </div>
              </div>
              <div className="admin-action-movie-card">
                <div className="admin-movie-thumb">
                  {movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span>{movie.title.slice(0, 1)}</span>}
                </div>
                <div className="admin-movie-main">
                  <strong>{movie.title}</strong>
                  <p className="muted">{movie.slug}</p>
                  <div className="meta-line">
                    <span className={statusClass(movie.status)}>{movie.status || "draft"}</span>
                    <span>ID: {movie.id}</span>
                  </div>
                </div>
              </div>
              {pendingMovieAction.error ? (
                <p className="form-message error">{pendingMovieAction.error}</p>
              ) : null}
              <div className="admin-action-modal-actions">
                <button
                  className="button ghost"
                  disabled={pendingMovieAction.isSubmitting}
                  onClick={() => setPendingMovieAction(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={copy.danger ? "button danger" : "button primary"}
                  disabled={pendingMovieAction.isSubmitting}
                  onClick={confirmMovieAction}
                  type="button"
                >
                  {pendingMovieAction.isSubmitting ? (
                    pendingMovieAction.kind === "delete" ? "Deleting..." : "Updating..."
                  ) : copy.confirm}
                </button>
              </div>
            </section>
          </div>
        );
      })() : null}
      {pendingSeriesAction ? (() => {
        const copy = seriesActionModalCopy(pendingSeriesAction);
        const seriesItem = pendingSeriesAction.series;
        return (
          <div className="admin-action-modal-backdrop" role="presentation" onMouseDown={() => !pendingSeriesAction.isSubmitting && setPendingSeriesAction(null)}>
            <section
              aria-labelledby="admin-series-action-title"
              aria-modal="true"
              className="admin-action-modal"
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="section-head">
                <div>
                  <p className={copy.danger ? "status-badge status-hidden" : "status-badge status-draft"}>{copy.danger ? "Danger action" : "Visibility action"}</p>
                  <h2 id="admin-series-action-title">{copy.title}</h2>
                  <p className="muted">{copy.body}</p>
                </div>
              </div>
              <div className="admin-action-movie-card">
                <div className="admin-movie-thumb">
                  {seriesItem.poster_url ? <img src={seriesItem.poster_url} alt="" /> : <span>{seriesItem.title.slice(0, 1)}</span>}
                </div>
                <div className="admin-movie-main">
                  <strong>{seriesItem.title}</strong>
                  <p className="muted">{seriesItem.slug}</p>
                  <div className="meta-line">
                    <span className={statusClass(seriesItem.status)}>{seriesItem.status || "draft"}</span>
                    <span>{seriesItem.season_count ?? seriesItem.seasons?.length ?? 0} seasons</span>
                    <span>{seriesItem.episode_count ?? seriesItem.seasons?.reduce((total, season) => total + (season.episodes?.length ?? 0), 0) ?? 0} episodes</span>
                  </div>
                </div>
              </div>
              {pendingSeriesAction.error ? (
                <p className="form-message error">{pendingSeriesAction.error}</p>
              ) : null}
              <div className="admin-action-modal-actions">
                <button
                  className="button ghost"
                  disabled={pendingSeriesAction.isSubmitting}
                  onClick={() => setPendingSeriesAction(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={copy.danger ? "button danger" : "button primary"}
                  disabled={pendingSeriesAction.isSubmitting}
                  onClick={confirmSeriesAction}
                  type="button"
                >
                  {pendingSeriesAction.isSubmitting ? (
                    pendingSeriesAction.kind === "delete" ? "Deleting..." : "Updating..."
                  ) : copy.confirm}
                </button>
              </div>
            </section>
          </div>
        );
      })() : null}
    </div>
  );
}
