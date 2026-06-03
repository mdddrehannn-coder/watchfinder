import Link from "next/link";
import ChannelLogo from "@/components/ChannelLogo";
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
  return (
    <Link className="channel-card" href={href}>
      <ChannelLogo channel={channel} />
      <strong>{channel.name}</strong>
      <p className="muted">{channel.description || fallbackText}</p>
      <span className="platform-badge">{channel.item_count || 0} titles</span>
    </Link>
  );
}
