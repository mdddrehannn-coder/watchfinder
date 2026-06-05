import type { Metadata } from "next";
import { WatchHistoryClient } from "@/components/ProfileLibraryClient";

export const metadata: Metadata = {
  title: "Watch History",
  description: "Your WatchFinder browsing history."
};

export default function HistoryPage() {
  return (
    <main className="page-inner">
      <div className="section-head">
        <div>
          <p className="rating-badge">Profile</p>
          <h1>Watch History</h1>
          <p className="muted">Recently watched titles and continue watching activity.</p>
        </div>
      </div>
      <section className="section">
        <WatchHistoryClient />
      </section>
    </main>
  );
}
