import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChannelLogo from "@/components/ChannelLogo";
import ChannelContentGrid from "@/components/ChannelContentGrid";
import { hasOfficialYouTube, isLegalFreeMovie } from "@/lib/discovery";
import { getContentChannelBySlug, getContentChannelItems } from "@/lib/data";
import type { ContentChannelItem } from "@/types/watchfinder";

export async function generateMetadata({
  params
}: {
  params: Promise<{ channelSlug: string }>;
}): Promise<Metadata> {
  const { channelSlug } = await params;
  const channel = await getContentChannelBySlug("cartoon", channelSlug);
  if (!channel) return { title: "Cartoon Channel" };
  return {
    title: `${channel.name} Cartoons`,
    description: channel.description || `Find ${channel.name} cartoons and official availability on WatchFinder.`
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
    if (tab === "movies") return movie.type === "movie";
    if (tab === "youtube") return hasOfficialYouTube(movie);
    if (tab === "free") return isLegalFreeMovie(movie);
    return true;
  });
}

export default async function CartoonChannelPage({
  params,
  searchParams
}: {
  params: Promise<{ channelSlug: string }>;
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { channelSlug } = await params;
  const filters = await searchParams;
  const channel = await getContentChannelBySlug("cartoon", channelSlug);
  if (!channel) notFound();

  const items = await getContentChannelItems(channel.id);
  const activeTab = filters.tab || "all";
  const filteredItems = filterItems(items, filters.q || "", activeTab);
  const tabs = [
    ["All", "all"],
    ["Episodes", "episodes"],
    ["Clips", "clips"],
    ["Movies", "movies"],
    ["Official YouTube", "youtube"],
    ["Free Legal", "free"]
  ];

  return (
    <main className="page-inner">
      <section className="channel-detail-hero">
        <ChannelLogo channel={channel} large />
        <p className="rating-badge">Cartoon Channel</p>
        <h1>{channel.name}</h1>
        <p className="muted">{channel.description || "Cartoon shows and official links."}</p>
        {channel.official_url ? <a className="button" href={channel.official_url} target="_blank" rel="noreferrer">Official channel</a> : null}
      </section>
      <section className="section">
        <form className="simple-search-form channel-search-form">
          <input name="q" defaultValue={filters.q || ""} placeholder="Search cartoons in this channel..." />
          <input name="tab" type="hidden" value={activeTab} />
          <button className="button primary" type="submit">Search</button>
        </form>
        <div className="chip-row">
          {tabs.map(([label, value]) => (
            <Link className={activeTab === value ? "chip active" : "chip"} href={`/cartoons/${channel.slug}?tab=${value}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`} key={value}>
              {label}
            </Link>
          ))}
        </div>
        <ChannelContentGrid items={filteredItems} emptyTitle="No cartoons added for this channel yet." />
      </section>
    </main>
  );
}
