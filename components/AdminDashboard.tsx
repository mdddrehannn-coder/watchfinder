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

export default function AdminDashboard({
  initialMovies,
  genres,
  platforms,
  castMembers,
  collections
}: {
  initialMovies: Movie[];
  genres: Genre[];
  platforms: Platform[];
  castMembers: CastMember[];
  collections: any;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [movies, setMovies] = useState<Movie[]>(initialMovies);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [movieSearch, setMovieSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [movieMessage, setMovieMessage] = useState<string | null>(null);

  const filteredMovies = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();
    return movies.filter((movie) => {
      if (query && !`${movie.title} ${movie.slug} ${movie.language || ""}`.toLowerCase().includes(query)) return false;
      if (statusFilter && movie.status !== statusFilter) return false;
      if (typeFilter && movie.type !== typeFilter) return false;
      return true;
    });
  }, [movies, movieSearch, statusFilter, typeFilter]);

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
