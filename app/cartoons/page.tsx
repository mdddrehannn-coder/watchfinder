import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import { getContentChannels } from "@/lib/data";
import { fallbackCartoonChannels } from "@/lib/default-content-channels";

export const metadata: Metadata = {
  title: "Cartoons",
  description: "Browse cartoons by channel, kids network, and official availability on WatchFinder."
};

export default async function CartoonsPage() {
  const dbChannels = await getContentChannels("cartoon");
  const channels = dbChannels.length ? dbChannels : fallbackCartoonChannels;

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <h1>Cartoons</h1>
        <p className="muted">Discover classic and popular cartoon shows by channel.</p>
      </section>
      <section className="section">
        {channels.length ? (
          <div className="channel-grid">
            {channels.map((channel) => (
              <ChannelCard
                channel={channel}
                fallbackText="Cartoon shows and kids favorites"
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
