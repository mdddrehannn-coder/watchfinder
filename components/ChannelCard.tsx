import Link from "next/link";
import { getChannelLogo } from "@/lib/channel-logos";
import type { ContentChannel } from "@/types/watchfinder";

export default function ChannelCard({
  channel,
  href,
  fallbackText
}: {
  channel: ContentChannel;
  href: string;
  fallbackText: string;
}) {
  const logo = channel.logo_url || getChannelLogo(channel.slug);

  return (
    <Link className="channel-card" href={href}>
      <span className="channel-logo">
        {logo ? <img src={logo} alt="" /> : <span>{channel.name.slice(0, 2).toUpperCase()}</span>}
      </span>
      <strong>{channel.name}</strong>
      <p className="muted">{channel.description || fallbackText}</p>
      <span className="platform-badge">{channel.item_count || 0} titles</span>
    </Link>
  );
}
