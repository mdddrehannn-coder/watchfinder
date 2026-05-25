import type { Metadata } from "next";
import Link from "next/link";
import AdminDashboard from "@/components/AdminDashboard";
import {
  getAdminAnalyticsData,
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

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, profile, isAdmin } = await requireAdminProfile();

  if (!user) {
    return (
      <main className="page-inner">
        <div className="panel">
          <h1>Admin Login Required</h1>
          <p className="muted">Login to continue to the WatchFinder admin dashboard.</p>
          <Link className="button primary" href="/login?next=/admin">
            Login
          </Link>
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

  const [movies, genres, platforms, castMembers, collections, analytics] = await Promise.all([
    getAllAdminMovies(),
    getGenres(),
    getPlatforms(),
    getCastMembers(),
    getAdminCollections(),
    getAdminAnalyticsData()
  ]);

  return (
    <main className="page-inner">
      <h1>WatchFinder Admin</h1>
      <p className="muted">Manage legal movie discovery content, official links, blogs, promotions, ad slots and license proof.</p>
      <AdminDashboard
        initialMovies={movies}
        genres={genres}
        platforms={platforms}
        castMembers={castMembers}
        collections={collections}
        analytics={analytics}
      />
    </main>
  );
}
