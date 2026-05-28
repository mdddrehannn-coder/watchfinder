"use client";

import Link from "next/link";
import PlatformLogo from "@/components/PlatformLogo";
import { trackEvent } from "@/lib/analytics";
import type { Platform } from "@/types/watchfinder";

const preferredOrder = ["netflix", "hotstar", "jiohotstar", "prime", "zee5", "sonyliv", "aha", "youtube", "apple"];

function scorePlatform(platform: Platform) {
  const text = `${platform.name} ${platform.slug}`.toLowerCase();
  const index = preferredOrder.findIndex((token) => text.includes(token));
  return index === -1 ? 99 : index;
}

export default function StreamingPlatformRow({ platforms }: { platforms: Platform[] }) {
  const visiblePlatforms = [...platforms]
    .filter((platform) => {
      const text = `${platform.name} ${platform.slug}`.toLowerCase();
      return preferredOrder.some((token) => text.includes(token));
    })
    .sort((a, b) => scorePlatform(a) - scorePlatform(b))
    .slice(0, 9);

  if (!visiblePlatforms.length) return null;

  return (
    <section className="section streaming-platform-section">
      <div className="section-head">
        <h2>Popular Platforms</h2>
        <Link className="muted" href="/platforms">More</Link>
      </div>
      <div className="streaming-platform-row">
        {visiblePlatforms.map((platform) => (
          <Link
            className="streaming-platform-card"
            href={`/platform/${platform.slug}`}
            key={platform.id}
            onClick={() => trackEvent({
              event_type: "platform_card_click",
              page_path: "/",
              platform_name: platform.name,
              metadata: { section_name: "Streaming", platform_slug: platform.slug }
            })}
          >
            <PlatformLogo platform={platform} />
            <span>{platform.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
