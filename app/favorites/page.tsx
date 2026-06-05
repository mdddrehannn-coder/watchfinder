import type { Metadata } from "next";
import { FavoritesClient } from "@/components/ProfileLibraryClient";

export const metadata: Metadata = {
  title: "Favorites",
  description: "Your saved WatchFinder favorites."
};

export default function FavoritesPage() {
  return (
    <main className="page-inner">
      <div className="section-head">
        <div>
          <p className="rating-badge">Profile</p>
          <h1>Favorites</h1>
          <p className="muted">Movies, shows, cartoons, and series you saved.</p>
        </div>
      </div>
      <section className="section">
        <FavoritesClient />
      </section>
    </main>
  );
}
