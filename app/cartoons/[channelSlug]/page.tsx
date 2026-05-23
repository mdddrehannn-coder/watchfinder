import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MovieGrid from "@/components/MovieGrid";
import { getContentChannelBySlug, getMoviesForContentChannel } from "@/lib/data";
import { getFallbackChannelBySlug } from "@/lib/default-content-channels";

export async function generateMetadata({
  params
}: {
  params: Promise<{ channelSlug: string }>;
}): Promise<Metadata> {
  const { channelSlug } = await params;
  const channel = (await getContentChannelBySlug("cartoon", channelSlug)) ?? getFallbackChannelBySlug("cartoon", channelSlug);
  if (!channel) return { title: "Cartoon Channel" };
  return {
    title: `${channel.name} Cartoons`,
    description: channel.description || `Find ${channel.name} cartoons and official availability on WatchFinder.`
  };
}

export default async function CartoonChannelPage({ params }: { params: Promise<{ channelSlug: string }> }) {
  const { channelSlug } = await params;
  const channel = (await getContentChannelBySlug("cartoon", channelSlug)) ?? getFallbackChannelBySlug("cartoon", channelSlug);
  if (!channel) notFound();

  const movies = channel.id.startsWith("fallback-") ? [] : await getMoviesForContentChannel(channel.id);

  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">Cartoon Channel</p>
        <h1>{channel.name}</h1>
        <p className="muted">{channel.description || "Cartoon shows and official links."}</p>
        {channel.official_url ? <a className="button" href={channel.official_url} target="_blank" rel="noreferrer">Official channel</a> : null}
      </section>
      <section className="section">
        <MovieGrid
          movies={movies}
          emptyTitle="No cartoons added for this channel yet"
          emptyMessage="Add cartoons from the admin panel and link them to this channel."
        />
      </section>
    </main>
  );
}
