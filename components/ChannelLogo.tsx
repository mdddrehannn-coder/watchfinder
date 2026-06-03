"use client";

import { useEffect, useState } from "react";
import { getChannelLogo } from "@/lib/channel-logos";
import type { ContentChannel } from "@/types/watchfinder";

export default function ChannelLogo({
  channel,
  large = false
}: {
  channel: ContentChannel;
  large?: boolean;
}) {
  const logo = channel.logo_url || getChannelLogo(channel.slug);
  const [failedLogo, setFailedLogo] = useState(false);

  useEffect(() => {
    setFailedLogo(false);
  }, [logo]);

  return (
    <span className={large ? "channel-logo large" : "channel-logo"}>
      {logo && !failedLogo ? (
        <img src={logo} alt={`${channel.name} logo`} onError={() => setFailedLogo(true)} />
      ) : (
        <span>{channel.name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
