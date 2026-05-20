import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getPlatforms } from "@/lib/data";

export const metadata: Metadata = {
  title: "Streaming Platforms",
  description: "Browse OTT platforms and official WatchFinder movie links."
};

export default async function PlatformsPage() {
  const platforms = await getPlatforms();

  return (
    <main className="page-inner">
      <h1>Streaming Platforms</h1>
      <p className="muted">Netflix, Prime Video, Disney+ Hotstar / JioHotstar, Zee5, SonyLIV, YouTube, Apple TV, Aha and more.</p>
      <section className="section">
        {platforms.length ? (
          <div className="platform-grid">
            {platforms.map((platform) => (
              <Link className="platform-card" href={`/platform/${platform.slug}`} key={platform.id}>
                <div className="platform-logo">
                  {platform.logo_url ? <img src={platform.logo_url} alt={platform.name} /> : platform.name.slice(0, 1)}
                </div>
                <strong>{platform.name}</strong>
                {platform.description ? <p className="muted">{platform.description}</p> : <p className="muted">Official availability</p>}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No platforms added" />
        )}
      </section>
    </main>
  );
}
