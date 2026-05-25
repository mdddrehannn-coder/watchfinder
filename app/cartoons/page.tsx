import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import MovieSlider from "@/components/MovieSlider";
import { hasOfficialYouTube } from "@/lib/discovery";
import { getChannelLinkedMovies, getContentChannels } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cartoons",
  description: "Browse cartoons by channel, kids network, and official availability on WatchFinder."
};

export const dynamic = "force-dynamic";

export default async function CartoonsPage() {
  const [dbChannels, cartoonUploads] = await Promise.all([
    getContentChannels("cartoon"),
    getChannelLinkedMovies("cartoon", 24)
  ]);
  const channels = dbChannels;
  const trendingCartoons = cartoonUploads.filter((movie) => movie.is_trending).slice(0, 12);
  const officialCartoons = cartoonUploads.filter(hasOfficialYouTube).slice(0, 12);
  const cartoonEpisodes = cartoonUploads.filter((movie) => movie.content_channel_items?.some((item) => item.episode_number || item.season_number)).slice(0, 12);

  return (
    <main className="page-inner">
      <h1>Cartoons</h1>
      <p className="muted">Browse cartoons by channel, kids network, and official availability.</p>
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
      <MovieSlider title="Latest Cartoon Uploads" movies={cartoonUploads.slice(0, 12)} />
      <MovieSlider title="Trending Cartoons" movies={trendingCartoons} />
      <MovieSlider title="Official Cartoon Clips" movies={officialCartoons} />
      <MovieSlider title="Cartoon Episodes" movies={cartoonEpisodes} />
    </main>
  );
}
