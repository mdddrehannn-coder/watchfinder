"use client";

import Link from "next/link";
import PlatformLogo from "@/components/PlatformLogo";
import { trackEvent } from "@/lib/analytics";
import type { Platform } from "@/types/watchfinder";

const preferredOrder = ["netflix", "hotstar", "jiohotstar", "prime", "zee5", "sonyliv", "aha", "youtube", "apple"];

const fallbackPlatforms: Platform[] = [
  { id: "fallback-netflix", name: "Netflix", slug: "netflix", is_active: true },
  { id: "fallback-jiohotstar", name: "JioHotstar", slug: "jiohotstar", is_active: true },
  { id: "fallback-prime-video", name: "Prime Video", slug: "prime-video", is_active: true },
  { id: "fallback-zee5", name: "Zee5", slug: "zee5", is_active: true },
  { id: "fallback-sonyliv", name: "SonyLIV", slug: "sonyliv", is_active: true },
  { id: "fallback-youtube", name: "YouTube", slug: "youtube", is_active: true }
];

function scorePlatform(platform: Platform) {
  const text = `${platform.name} ${platform.slug}`.toLowerCase();
  const index = preferredOrder.findIndex((token) => text.includes(token));
  return index === -1 ? 99 : index;
}

export default function StreamingPlatformRow({ platforms }: { platforms: Platform[] }) {
  const matchedPlatforms = [...platforms]
    .filter((platform) => platform.is_active !== false)
    .filter((platform) => {
      const text = `${platform.name} ${platform.slug}`.toLowerCase();
      return preferredOrder.some((token) => text.includes(token));
    });

  const visiblePlatforms = [...matchedPlatforms, ...fallbackPlatforms]
    .filter((platform, index, all) => {
      const score = scorePlatform(platform);
      return all.findIndex((item) => scorePlatform(item) === score) === index;
    })
    .sort((a, b) => scorePlatform(a) - scorePlatform(b))
    .slice(0, 9);

  return (
    <section className="section streaming-platform-section">
      <div className="section-head">
        <h2>Streaming</h2>
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
