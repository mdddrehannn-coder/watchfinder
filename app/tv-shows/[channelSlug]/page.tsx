import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChannelContentGrid from "@/components/ChannelContentGrid";
import { hasOfficialYouTube } from "@/lib/discovery";
import { getContentChannelBySlug, getContentChannelItems } from "@/lib/data";
import type { ContentChannelItem } from "@/types/watchfinder";

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

function filterItems(items: ContentChannelItem[], query: string, tab: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const movie = item.movies;
    if (!movie) return false;
    const searchable = `${movie.title} ${movie.language || ""} ${item.episode_title || ""} ${item.season_number || ""} ${item.episode_number || ""}`.toLowerCase();
    if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
    if (tab === "episodes") return Boolean(item.episode_number || item.season_number);
    if (tab === "clips") return String(movie.type).includes("short") || Boolean(item.episode_title?.toLowerCase().includes("clip"));
    if (tab === "full") return Boolean(movie.has_licensed_video || item.episode_number || item.season_number);
    if (tab === "youtube") return hasOfficialYouTube(movie);
    if (tab === "latest") return Boolean(movie.is_latest);
    return true;
  });
}

export default async function TvShowChannelPage({
  params,
  searchParams
}: {
  params: Promise<{ channelSlug: string }>;
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { channelSlug } = await params;
  const filters = await searchParams;
  const channel = await getContentChannelBySlug("tv_show", channelSlug);
  if (!channel) notFound();

  const items = await getContentChannelItems(channel.id);
  const activeTab = filters.tab || "all";
  const filteredItems = filterItems(items, filters.q || "", activeTab);
  const tabs = [
    ["All", "all"],
    ["Episodes", "episodes"],
    ["Clips", "clips"],
    ["Full Episodes", "full"],
    ["Official YouTube", "youtube"],
    ["Latest", "latest"]
  ];

  return (
    <main className="page-inner">
      <section className="channel-detail-hero">
        <span className="channel-logo large">
          {channel.logo_url ? <img src={channel.logo_url} alt="" /> : <span>{channel.name.slice(0, 2).toUpperCase()}</span>}
        </span>
        <p className="rating-badge">TV Channel</p>
        <h1>{channel.name}</h1>
        <p className="muted">{channel.description || "TV shows and official links."}</p>
        {channel.official_url ? <a className="button" href={channel.official_url} target="_blank" rel="noreferrer">Official channel</a> : null}
      </section>
      <section className="section">
        <form className="simple-search-form channel-search-form">
          <input name="q" defaultValue={filters.q || ""} placeholder="Search shows in this channel..." />
          <input name="tab" type="hidden" value={activeTab} />
          <button className="button primary" type="submit">Search</button>
        </form>
        <div className="chip-row">
          {tabs.map(([label, value]) => (
            <Link className={activeTab === value ? "chip active" : "chip"} href={`/tv-shows/${channel.slug}?tab=${value}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} key={value}>
              {label}
            </Link>
          ))}
        </div>
        <ChannelContentGrid items={filteredItems} emptyTitle="No TV shows added for this channel yet." />
      </section>
    </main>
  );
}
