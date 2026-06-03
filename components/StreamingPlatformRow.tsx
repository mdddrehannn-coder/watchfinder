"use client";

import Link from "next/link";
import PlatformLogo from "@/components/PlatformLogo";
import { trackEvent } from "@/lib/analytics";
import type { Platform } from "@/types/watchfinder";

const preferredOrder = ["youtube", "netflix", "jiohotstar", "hotstar", "prime", "sonyliv", "zee5", "apple", "aha"];

const fallbackPlatforms: Platform[] = [
  { id: "fallback-youtube", name: "YouTube", slug: "youtube", is_active: true },
  { id: "fallback-netflix", name: "Netflix", slug: "netflix", is_active: true },
  { id: "fallback-jiohotstar", name: "JioHotstar", slug: "jiohotstar", is_active: true },
  { id: "fallback-prime-video", name: "Prime Video", slug: "prime-video", is_active: true },
  { id: "fallback-sonyliv", name: "SonyLIV", slug: "sonyliv", is_active: true },
  { id: "fallback-apple-tv", name: "Apple TV", slug: "apple-tv", is_active: true },
  { id: "fallback-aha", name: "Aha", slug: "aha", is_active: true },
  { id: "fallback-zee5", name: "Zee5", slug: "zee5", is_active: true }
];

function scorePlatform(platform: Platform) {
  const text = `${platform.name} ${platform.slug}`.toLowerCase();
  const index = preferredOrder.findIndex((token) => text.includes(token));
  return index === -1 ? 99 : index;
}

function platformKey(platform: Platform) {
  const text = `${platform.name} ${platform.slug}`.toLowerCase();
  const token = preferredOrder.find((item) => text.includes(item));
  return token || platform.slug || platform.name.toLowerCase();
}

function platformDescription(platform: Platform) {
  const text = `${platform.name} ${platform.slug}`.toLowerCase();
  if (text.includes("youtube")) return "Trailers and official videos";
  if (text.includes("netflix")) return "Subscription originals and films";
  if (text.includes("hotstar") || text.includes("jio")) return "Movies, sports, and TV";
  if (text.includes("prime")) return "Rentals and Prime titles";
  if (text.includes("sonyliv") || text.includes("sony")) return "TV shows and originals";
  if (text.includes("zee5") || text.includes("zee")) return "Hindi and regional titles";
  if (text.includes("apple")) return "Apple originals and rentals";
  if (text.includes("aha")) return "South Indian streaming";
  return platform.description || "Official streaming platform";
}

export default function StreamingPlatformRow({ platforms }: { platforms: Platform[] }) {
  const activePlatforms = [...platforms].filter((platform) => platform.is_active !== false);
  const visiblePlatforms = [...activePlatforms, ...fallbackPlatforms]
    .filter((platform, index, all) => {
      const key = platformKey(platform);
      return all.findIndex((item) => platformKey(item) === key) === index;
    })
    .sort((a, b) => scorePlatform(a) - scorePlatform(b) || a.name.localeCompare(b.name));

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
            <small>{platformDescription(platform)}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
