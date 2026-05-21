import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PlatformLogo from "@/components/PlatformLogo";
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
                <PlatformLogo platform={platform} />
                <strong>{platform.name}</strong>
                {platform.description ? <p className="muted">{platform.description}</p> : <p className="muted">Official titles and watch links</p>}
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
