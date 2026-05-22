import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import { getContentChannels } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cartoons",
  description: "Find cartoons by channel and official availability on WatchFinder."
};

export default async function CartoonsPage() {
  const channels = await getContentChannels("cartoon");

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <h1>Cartoons</h1>
        <p className="muted">Find cartoons by channel and official availability.</p>
      </section>
      <section className="section">
        {channels.length ? (
          <div className="channel-grid">
            {channels.map((channel) => (
              <ChannelCard
                channel={channel}
                fallbackText="Cartoon shows and official links"
                href={`/cartoons/${channel.slug}`}
                key={channel.id}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No cartoon channels added yet.</div>
        )}
      </section>
    </main>
  );
}
