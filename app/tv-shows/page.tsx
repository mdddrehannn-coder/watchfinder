import type { Metadata } from "next";
import ChannelCard from "@/components/ChannelCard";
import MovieSlider from "@/components/MovieSlider";
import { hasOfficialYouTube } from "@/lib/discovery";
import { getChannelLinkedMovies, getContentChannels } from "@/lib/data";
import { fallbackTvShowChannels } from "@/lib/default-content-channels";

export const metadata: Metadata = {
  title: "TV Shows",
  description: "Browse TV shows by channel, network, and official availability on WatchFinder."
};

export default async function TvShowsPage() {
  const [dbChannels, tvUploads] = await Promise.all([
    getContentChannels("tv_show"),
    getChannelLinkedMovies("tv_show", 24)
  ]);
  const channels = dbChannels.length ? dbChannels : fallbackTvShowChannels;
  const trendingShows = tvUploads.filter((movie) => movie.is_trending).slice(0, 12);
  const fullEpisodes = tvUploads.filter((movie) => movie.has_licensed_video || movie.content_channel_items?.some((item) => item.episode_number || item.season_number)).slice(0, 12);
  const officialShows = tvUploads.filter(hasOfficialYouTube).slice(0, 12);

  return (
    <main className="page-inner">
      <h1>TV Shows</h1>
      <p className="muted">Browse TV shows by channel, network, and official availability.</p>
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
      <MovieSlider title="Latest TV Show Uploads" movies={tvUploads.slice(0, 12)} />
      <MovieSlider title="Trending TV Shows" movies={trendingShows} />
      <MovieSlider title="Full Episodes" movies={fullEpisodes} />
      <MovieSlider title="Official YouTube Shows" movies={officialShows} />
    </main>
  );
}
