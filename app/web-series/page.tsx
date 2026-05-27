import type { Metadata } from "next";
import SeriesCard from "@/components/SeriesCard";
import { getPublishedSeries } from "@/lib/data";

export const metadata: Metadata = {
  title: "Web Series",
  description: "Browse legal web series with seasons and episodes on WatchFinder."
};

export const dynamic = "force-dynamic";

export default async function WebSeriesPage() {
  const series = await getPublishedSeries(48);

  return (
    <main className="page-inner">
      <section className="section">
        <div className="section-head">
          <div>
            <p className="rating-badge">WatchFinder Series</p>
            <h1>Web Series</h1>
            <p className="muted">Browse official and legally managed web series by season and episode.</p>
          </div>
        </div>
        {series.length ? (
          <div className="grid">
            {series.map((item) => <SeriesCard series={item} key={item.id} />)}
          </div>
        ) : (
          <div className="empty">No published web series yet.</div>
        )}
      </section>
    </main>
  );
}
