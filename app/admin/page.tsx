import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import {
  getAdminAnalyticsData,
  getAdminCollections,
  getAllAdminMovies,
  getAllAdminSeries,
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
  const { user, isAdmin } = await requireAdminProfile();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!isAdmin) {
    redirect("/profile?error=access-denied");
  }

  const [movies, series, genres, platforms, castMembers, collections, analytics] = await Promise.all([
    getAllAdminMovies(),
    getAllAdminSeries(),
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
        initialSeries={series}
        genres={genres}
        platforms={platforms}
        castMembers={castMembers}
        collections={collections}
        analytics={analytics}
      />
    </main>
  );
}
