"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit3, Eye, Plus, Search } from "lucide-react";
import AdminAdSlotForm from "@/components/AdminAdSlotForm";
import AdminBlogForm from "@/components/AdminBlogForm";
import AdminLicenseForm from "@/components/AdminLicenseForm";
import AdminMovieForm from "@/components/AdminMovieForm";
import AdminPromotionForm from "@/components/AdminPromotionForm";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CastMember, Genre, Movie, Platform } from "@/types/watchfinder";

type AdminSection =
  | "dashboard"
  | "movies"
  | "analytics"
  | "add-movie"
  | "genres"
  | "platforms"
  | "cast-members"
  | "promotions"
  | "ad-slots"
  | "blog-posts"
  | "feedback-messages"
  | "license-documents"
  | "site-settings";

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: "dashboard", label: "Dashboard Overview" },
  { id: "movies", label: "Movies" },
  { id: "analytics", label: "Analytics" },
  { id: "add-movie", label: "Add Movie" },
  { id: "genres", label: "Genres" },
  { id: "platforms", label: "Platforms" },
  { id: "cast-members", label: "Cast Members" },
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
  return "status-badge status-draft";
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
  created_at?: string | null;
};

type AnalyticsSession = {
  id: string;
  anonymous_session_id: string;
  user_id?: string | null;
  last_seen_at?: string | null;
  page_views?: number | null;
  total_watch_seconds?: number | null;
  device_type?: string | null;
  browser_name?: string | null;
};

type AnalyticsData = {
  events: AnalyticsEvent[];
  sessions: AnalyticsSession[];
};

type MovieAnalyticsSummary = {
  views: number;
  uniqueSessions: number;
  watchSeconds: number;
  trailerPlays: number;
  linkClicks: number;
  todayViews: number;
  lastViewedAt?: string | null;
};

function secondsLabel(seconds = 0) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function isToday(value?: string | null) {
  if (!value) return false;
  return new Date(value).toDateString() === new Date().toDateString();
}

function eventInRange(event: AnalyticsEvent, range: string) {
  if (range === "all") return true;
  if (!event.created_at) return false;
  const created = new Date(event.created_at).getTime();
  const now = Date.now();
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  if (range === "today") return isToday(event.created_at);
  return created >= now - days * 24 * 60 * 60 * 1000;
}

export default function AdminDashboard({
  initialMovies,
  genres,
  platforms,
  castMembers,
  collections,
  analytics
}: {
  initialMovies: Movie[];
  genres: Genre[];
  platforms: Platform[];
  castMembers: CastMember[];
  collections: any;
  analytics: AnalyticsData;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [movieSearch, setMovieSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [movieMessage, setMovieMessage] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState("today");

  const filteredMovies = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();
    return movies.filter((movie) => {
      if (query && !`${movie.title} ${movie.slug} ${movie.language || ""}`.toLowerCase().includes(query)) return false;
      if (statusFilter && movie.status !== statusFilter) return false;
      if (typeFilter && movie.type !== typeFilter) return false;
      return true;
    });
  }, [movies, movieSearch, statusFilter, typeFilter]);

  const analyticsStats = useMemo(() => {
    const events = (analytics?.events ?? []).filter((event) => eventInRange(event, analyticsRange));
    const todayEvents = (analytics?.events ?? []).filter((event) => isToday(event.created_at));
    const activeCutoff = Date.now() - 5 * 60 * 1000;
    const activeSessions = (analytics?.sessions ?? []).filter((session) => {
      if (!session.last_seen_at) return false;
      return new Date(session.last_seen_at).getTime() >= activeCutoff;
    });

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
      if (event.event_type === "trailer_play") current.trailerPlays += 1;
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

    const topMovies = Array.from(movieStatsById.entries())
      .map(([movieId, summary]) => ({ movie: movies.find((item) => item.id === movieId), summary }))
      .filter((item) => item.movie)
      .sort((a, b) => b.summary.views - a.summary.views)
      .slice(0, 10);

    const topWatchTime = [...topMovies].sort((a, b) => b.summary.watchSeconds - a.summary.watchSeconds).slice(0, 10);

    const searches = new Map<string, { query: string; count: number; last: string | null }>();
    for (const event of events.filter((item) => item.event_type === "search" && item.search_query)) {
      const key = String(event.search_query).trim().toLowerCase();
      const current = searches.get(key) ?? { query: String(event.search_query), count: 0, last: null };
      current.count += 1;
      if (!current.last || new Date(event.created_at || 0) > new Date(current.last)) current.last = event.created_at || null;
      searches.set(key, current);
    }

    const platformClicks = new Map<string, number>();
    for (const event of events.filter((item) => item.event_type === "watch_link_click")) {
      const key = event.platform_name || "Official link";
      platformClicks.set(key, (platformClicks.get(key) ?? 0) + 1);
    }

    const dailyMap = new Map<string, { date: string; pageViews: number; movieViews: number; watchSeconds: number; searches: number }>();
    for (const event of events) {
      const date = (event.created_at || "").slice(0, 10) || "Unknown";
      const current = dailyMap.get(date) ?? { date, pageViews: 0, movieViews: 0, watchSeconds: 0, searches: 0 };
      if (event.event_type === "page_view") current.pageViews += 1;
      if (event.event_type === "movie_view") current.movieViews += 1;
      if (event.event_type === "search") current.searches += 1;
      if (event.watch_seconds) current.watchSeconds += event.watch_seconds;
      dailyMap.set(date, current);
    }

    return {
      events,
      activeSessions,
      pageViewsToday: todayEvents.filter((event) => event.event_type === "page_view").length,
      movieViewsToday: todayEvents.filter((event) => event.event_type === "movie_view").length,
      watchSecondsToday: todayEvents.reduce((total, event) => total + (event.watch_seconds || 0), 0),
      watchLinkClicksToday: todayEvents.filter((event) => event.event_type === "watch_link_click").length,
      searchesToday: todayEvents.filter((event) => event.event_type === "search").length,
      movieStatsById,
      topMovies,
      topWatchTime,
      topSearches: Array.from(searches.values()).sort((a, b) => b.count - a.count).slice(0, 10),
      platformClicks: Array.from(platformClicks.entries()).map(([platform, clicks]) => ({ platform, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 10),
      dailyTrend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
    };
  }, [analytics, analyticsRange, movies]);

  function showAddMovie() {
    setEditingMovie(null);
    setActiveSection("add-movie");
    setMovieMessage(null);
  }

  function showEditMovie(movie: Movie) {
    setEditingMovie(movie);
    setActiveSection("add-movie");
    setMovieMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function archiveMovie(movie: Movie) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("movies").update({ status: "archived" }).eq("id", movie.id);
    if (error) {
      setMovieMessage(error.message);
      return;
    }
    setMovies((current) => current.map((item) => item.id === movie.id ? { ...item, status: "archived" } : item));
    setMovieMessage(`${movie.title} archived.`);
  }

  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Admin sections">
        {sections.map((section) => (
          <button
            className={activeSection === section.id ? "chip active" : "chip"}
            key={section.id}
            onClick={() => {
              if (section.id === "add-movie") setEditingMovie(null);
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
              <button className="button primary" type="button" onClick={showAddMovie}>
                <Plus size={18} /> Add Movie
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
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                <option value="movie">Movie</option>
                <option value="tv_show">TV Show</option>
                <option value="anime">Anime</option>
                <option value="short_film">Short Film</option>
              </select>
            </div>
            <div className="admin-movie-list">
              {filteredMovies.map((movie) => (
                <article className="admin-movie-row" key={movie.id}>
                  <div className="admin-movie-thumb">
                    {movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span>{movie.title.slice(0, 1)}</span>}
                  </div>
                  <div className="admin-movie-main">
                    <strong>{movie.title}</strong>
                    <p className="muted">{movie.slug}</p>
                    <div className="meta-line">
                      <span className={statusClass(movie.status)}>{movie.status || "draft"}</span>
                      <span>{movie.type}</span>
                      <span>{movie.language || "No language"}</span>
                      <span>Updated {formatDate(movie.updated_at || movie.created_at)}</span>
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
                    <button className="button ghost" type="button" onClick={() => archiveMovie(movie)}>
                      Archive
                    </button>
                  </div>
                </article>
              ))}
              {!filteredMovies.length ? <div className="empty">No movies match your filters.</div> : null}
            </div>
          </section>
        ) : null}

        {activeSection === "analytics" ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Analytics</h2>
                <p className="muted">Privacy-friendly audience, content, search and platform performance. WatchFinder does not store raw IP addresses.</p>
              </div>
              <div className="chip-row">
                {[
                  { label: "Today", value: "today" },
                  { label: "Last 7 days", value: "7d" },
                  { label: "Last 30 days", value: "30d" },
                  { label: "All time", value: "all" }
                ].map((range) => (
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

            <div className="grid">
              <div className="admin-card"><strong>{analyticsStats.activeSessions.length}</strong><p className="muted">Active users now</p></div>
              <div className="admin-card"><strong>{analyticsStats.pageViewsToday}</strong><p className="muted">Page views today</p></div>
              <div className="admin-card"><strong>{analyticsStats.movieViewsToday}</strong><p className="muted">Movie views today</p></div>
              <div className="admin-card"><strong>{secondsLabel(analyticsStats.watchSecondsToday)}</strong><p className="muted">Watch time today</p></div>
              <div className="admin-card"><strong>{analyticsStats.watchLinkClicksToday}</strong><p className="muted">Watch link clicks today</p></div>
              <div className="admin-card"><strong>{analyticsStats.searchesToday}</strong><p className="muted">Searches today</p></div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Top movies by views</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topMovies.map(({ movie, summary }) => (
                    <div className="admin-mini-row" key={movie?.id}>
                      <span>{movie?.poster_url ? <img src={movie.poster_url} alt="" /> : null}</span>
                      <strong>{movie?.title}</strong>
                      <span>{summary.views} views</span>
                      <span>{summary.uniqueSessions} unique</span>
                      <span>{summary.trailerPlays} trailer</span>
                      <span>{summary.linkClicks} links</span>
                    </div>
                  ))}
                  {!analyticsStats.topMovies.length ? <p className="muted">No movie analytics yet.</p> : null}
                </div>
              </div>

              <div className="panel">
                <h3>Top movies by watch time</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topWatchTime.map(({ movie, summary }) => {
                    const completionRate = summary.trailerPlays ? Math.round((summary.watchSeconds / (summary.trailerPlays * 60)) * 100) : 0;
                    return (
                      <div className="admin-mini-row" key={movie?.id}>
                        <strong>{movie?.title}</strong>
                        <span>{secondsLabel(summary.watchSeconds)}</span>
                        <span>Avg {summary.trailerPlays ? secondsLabel(Math.round(summary.watchSeconds / summary.trailerPlays)) : "0s"}</span>
                        <span>{Math.min(completionRate, 100)}% est.</span>
                      </div>
                    );
                  })}
                  {!analyticsStats.topWatchTime.length ? <p className="muted">No watch time yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Active sessions</h3>
                <div className="admin-mini-table">
                  {analyticsStats.activeSessions.slice(0, 12).map((session) => (
                    <div className="admin-mini-row" key={session.id}>
                      <strong>{session.user_id ? `User ${session.user_id.slice(0, 8)}` : `Guest ${session.anonymous_session_id.slice(0, 8)}`}</strong>
                      <span>{session.device_type || "device"}</span>
                      <span>{session.browser_name || "browser"}</span>
                      <span>{session.page_views || 0} pages</span>
                      <span>{secondsLabel(session.total_watch_seconds || 0)}</span>
                    </div>
                  ))}
                  {!analyticsStats.activeSessions.length ? <p className="muted">No active sessions in the last 5 minutes.</p> : null}
                </div>
              </div>

              <div className="panel">
                <h3>Top search queries</h3>
                <div className="admin-mini-table">
                  {analyticsStats.topSearches.map((search) => (
                    <div className="admin-mini-row" key={search.query}>
                      <strong>{search.query}</strong>
                      <span>{search.count} searches</span>
                      <span>{formatDate(search.last)}</span>
                    </div>
                  ))}
                  {!analyticsStats.topSearches.length ? <p className="muted">No searches tracked yet.</p> : null}
                </div>
              </div>
            </div>

            <div className="form-grid two section">
              <div className="panel">
                <h3>Platform clicks</h3>
                <div className="admin-mini-table">
                  {analyticsStats.platformClicks.map((item) => (
                    <div className="admin-mini-row" key={item.platform}>
                      <strong>{item.platform}</strong>
                      <span>{item.clicks} clicks</span>
                    </div>
                  ))}
                  {!analyticsStats.platformClicks.length ? <p className="muted">No platform clicks yet.</p> : null}
                </div>
              </div>

              <div className="panel">
                <h3>Daily trend</h3>
                <div className="admin-mini-table">
                  {analyticsStats.dailyTrend.map((day) => (
                    <div className="admin-mini-row" key={day.date}>
                      <strong>{day.date}</strong>
                      <span>{day.pageViews} page views</span>
                      <span>{day.movieViews} movie views</span>
                      <span>{day.searches} searches</span>
                      <span>{secondsLabel(day.watchSeconds)}</span>
                    </div>
                  ))}
                  {!analyticsStats.dailyTrend.length ? <p className="muted">No daily trend yet.</p> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeSection === "add-movie" ? (
          <section className="section">
            <AdminMovieForm
              key={editingMovie?.id || "new-movie"}
              genres={genres}
              castMembers={castMembers}
              platforms={platforms}
              initialMovie={editingMovie}
              onSaved={handleSaved}
              onBackToMovies={() => setActiveSection("movies")}
              onAddNew={showAddMovie}
              movieAnalytics={editingMovie ? analyticsStats.movieStatsById.get(editingMovie.id) : undefined}
            />
          </section>
        ) : null}

        {activeSection === "genres" ? <section className="section"><h2>Genres</h2><div className="chip-row">{genres.map((genre) => <span className="chip" key={genre.id}>{genre.name}</span>)}</div></section> : null}
        {activeSection === "platforms" ? <section className="section"><h2>Platforms</h2><div className="chip-row">{platforms.map((platform) => <span className="chip" key={platform.id}>{platform.name}</span>)}</div></section> : null}
        {activeSection === "cast-members" ? <section className="section"><h2>Cast Members</h2><div className="chip-row">{castMembers.map((member) => <span className="chip" key={member.id}>{member.name}</span>)}</div></section> : null}
        {activeSection === "promotions" ? <section className="section"><h2>Promotions</h2><AdminPromotionForm /><div className="form-grid section">{collections.promotions.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.placement} - {item.is_active ? "active" : "inactive"}</p></div>)}</div></section> : null}
        {activeSection === "ad-slots" ? <section className="section"><h2>Ad Slots</h2><AdminAdSlotForm /><div className="form-grid section">{collections.adSlots.map((item: any) => <div className="panel" key={item.id}><strong>{item.slot_name}</strong><p className="muted">{item.placement} - {item.is_active ? "active" : "inactive"}</p></div>)}</div></section> : null}
        {activeSection === "blog-posts" ? <section className="section"><h2>Blog Posts</h2><AdminBlogForm /><div className="form-grid section">{collections.blogPosts.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.status} - {item.category}</p></div>)}</div></section> : null}
        {activeSection === "feedback-messages" ? <section className="section"><h2>Feedback Messages</h2><div className="form-grid">{collections.feedbackMessages.map((item: any) => <div className="panel" key={item.id}><strong>{item.subject || item.email || "Feedback"}</strong><p className="muted">{item.message}</p></div>)}</div></section> : null}
        {activeSection === "license-documents" ? <section className="section"><h2>License Documents</h2><AdminLicenseForm movies={movies} /><div className="form-grid section">{collections.licenseDocuments.map((item: any) => <div className="panel" key={item.id}><strong>{item.license_type || "License"}</strong><p className="muted">{item.movie_id}</p></div>)}</div></section> : null}
        {activeSection === "site-settings" ? <section className="section"><h2>Site Settings</h2><div className="form-grid">{collections.siteSettings.map((item: any) => <div className="panel" key={item.id}><strong>{item.key || item.id}</strong><p className="muted">{String(item.value ?? "")}</p></div>)}</div></section> : null}
      </div>
    </div>
  );
}
