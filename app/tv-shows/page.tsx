import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import { getContentChannels } from "@/lib/data";
import { fallbackTvShowChannels } from "@/lib/default-content-channels";

export const metadata: Metadata = {
  title: "TV Shows",
  description: "Browse TV shows by channel, network, and official availability on WatchFinder."
};

export default async function TvShowsPage() {
  const dbChannels = await getContentChannels("tv_show");
  const channels = dbChannels.length ? dbChannels : fallbackTvShowChannels;

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <h1>TV Shows</h1>
        <p className="muted">Browse TV shows by channel and network.</p>
      </section>
      <section className="section">
        {channels.length ? (
          <div className="channel-grid">
            {channels.map((channel) => (
              <ChannelCard
                channel={channel}
                fallbackText="TV shows and official availability"
                href={`/tv-shows/${channel.slug}`}
                key={channel.id}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No TV show channels added yet.</div>
        )}
      </section>
    </main>
  );
}
