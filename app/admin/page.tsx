import type { Metadata } from "next";
import AdminAdSlotForm from "@/components/AdminAdSlotForm";
import AdminBlogForm from "@/components/AdminBlogForm";
import AdminLayout from "@/components/AdminLayout";
import AdminLicenseForm from "@/components/AdminLicenseForm";
import AdminMovieForm from "@/components/AdminMovieForm";
import AdminPromotionForm from "@/components/AdminPromotionForm";
import {
  getAdminCollections,
  getAllAdminMovies,
  getCastMembers,
  getGenres,
  getPlatforms,
  requireAdminProfile
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Admin",
  description: "WatchFinder protected admin dashboard."
};

export default async function AdminPage() {
  const { user, profile, isAdmin } = await requireAdminProfile();

  if (!user) {
    return (
      <main className="page-inner">
        <div className="panel">
          <h1>Admin Login Required</h1>
          <p className="muted">Sign in from the profile page, then return here.</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page-inner">
        <div className="panel">
          <h1>Access denied</h1>
          <p className="muted">Your profile role is {profile?.role || "not admin"}. Only profiles.role = admin can access this dashboard.</p>
        </div>
      </main>
    );
  }

  const [movies, genres, platforms, castMembers, collections] = await Promise.all([
    getAllAdminMovies(),
    getGenres(),
    getPlatforms(),
    getCastMembers(),
    getAdminCollections()
  ]);

  return (
    <main className="page-inner">
      <h1>WatchFinder Admin</h1>
      <p className="muted">Manage legal movie discovery content, official links, blogs, promotions, ad slots and license proof.</p>
      <AdminLayout>
        <section id="dashboard-overview" className="section">
          <h2>Dashboard overview</h2>
          <div className="grid">
            <div className="admin-card"><strong>{movies.length}</strong><p className="muted">Movies</p></div>
            <div className="admin-card"><strong>{genres.length}</strong><p className="muted">Genres</p></div>
            <div className="admin-card"><strong>{platforms.length}</strong><p className="muted">Platforms</p></div>
            <div className="admin-card"><strong>{collections.feedbackMessages.length}</strong><p className="muted">Feedback messages</p></div>
          </div>
        </section>

        <section id="movies" className="section">
          <h2>Movies</h2>
          <div className="form-grid">
            {movies.slice(0, 12).map((movie) => (
              <div className="panel" key={movie.id}>
                <strong>{movie.title}</strong>
                <p className="muted">{movie.status} · {movie.type} · {movie.language || "No language"}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="add-movie" className="section">
          <h2>Add Movie</h2>
          <AdminMovieForm genres={genres} castMembers={castMembers} platforms={platforms} />
        </section>

        <section id="genres" className="section">
          <h2>Genres</h2>
          <div className="chip-row">{genres.map((genre) => <span className="chip" key={genre.id}>{genre.name}</span>)}</div>
        </section>

        <section id="platforms" className="section">
          <h2>Platforms</h2>
          <div className="chip-row">{platforms.map((platform) => <span className="chip" key={platform.id}>{platform.name}</span>)}</div>
        </section>

        <section id="cast-members" className="section">
          <h2>Cast Members</h2>
          <div className="chip-row">{castMembers.map((member) => <span className="chip" key={member.id}>{member.name}</span>)}</div>
        </section>

        <section id="promotions" className="section">
          <h2>Promotions</h2>
          <AdminPromotionForm />
          <div className="form-grid section">
            {collections.promotions.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.placement} · {item.is_active ? "active" : "inactive"}</p></div>)}
          </div>
        </section>

        <section id="ad-slots" className="section">
          <h2>Ad Slots</h2>
          <AdminAdSlotForm />
          <div className="form-grid section">
            {collections.adSlots.map((item: any) => <div className="panel" key={item.id}><strong>{item.slot_name}</strong><p className="muted">{item.placement} · {item.is_active ? "active" : "inactive"}</p></div>)}
          </div>
        </section>

        <section id="blog-posts" className="section">
          <h2>Blog Posts</h2>
          <AdminBlogForm />
          <div className="form-grid section">
            {collections.blogPosts.map((item: any) => <div className="panel" key={item.id}><strong>{item.title}</strong><p className="muted">{item.status} · {item.category}</p></div>)}
          </div>
        </section>

        <section id="feedback-messages" className="section">
          <h2>Feedback Messages</h2>
          <div className="form-grid">
            {collections.feedbackMessages.map((item: any) => <div className="panel" key={item.id}><strong>{item.subject || item.email || "Feedback"}</strong><p className="muted">{item.message}</p></div>)}
          </div>
        </section>

        <section id="license-documents" className="section">
          <h2>License Documents</h2>
          <AdminLicenseForm movies={movies} />
          <div className="form-grid section">
            {collections.licenseDocuments.map((item: any) => <div className="panel" key={item.id}><strong>{item.document_type || "License"}</strong><p className="muted">{item.movie_id}</p></div>)}
          </div>
        </section>

        <section id="site-settings" className="section">
          <h2>Site Settings</h2>
          <div className="form-grid">
            {collections.siteSettings.map((item: any) => <div className="panel" key={item.id}><strong>{item.key || item.id}</strong><p className="muted">{String(item.value ?? "")}</p></div>)}
          </div>
        </section>
      </AdminLayout>
    </main>
  );
}
