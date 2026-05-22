import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MovieGrid from "@/components/MovieGrid";
import { getContentChannelBySlug, getMoviesForContentChannel } from "@/lib/data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ channelSlug: string }>;
}): Promise<Metadata> {
  const { channelSlug } = await params;
  const channel = await getContentChannelBySlug("tv_show", channelSlug);
  if (!channel) return { title: "TV Show Channel" };
  return {
    title: `${channel.name} TV Shows`,
    description: channel.description || `Find ${channel.name} TV shows and official availability on WatchFinder.`
  };
}

export default async function TvShowChannelPage({ params }: { params: Promise<{ channelSlug: string }> }) {
  const { channelSlug } = await params;
  const channel = await getContentChannelBySlug("tv_show", channelSlug);
  if (!channel) notFound();

  const movies = await getMoviesForContentChannel(channel.id);

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">TV Channel</p>
        <h1>{channel.name}</h1>
        <p className="muted">{channel.description || "TV shows and official links."}</p>
        {channel.official_url ? <a className="button" href={channel.official_url} target="_blank" rel="noreferrer">Official channel</a> : null}
      </section>
      <section className="section">
        <MovieGrid
          movies={movies}
          emptyTitle="No TV shows added for this channel yet"
          emptyMessage="Add TV shows from the admin panel and link them to this channel."
        />
      </section>
    </main>
  );
}
