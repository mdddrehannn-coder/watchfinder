import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "About WatchFinder",
  description: "Learn how WatchFinder helps users discover legal movie, cartoon, TV show and OTT availability."
};

export default function AboutPage() {
  return (
    <InfoPageShell
      title="About WatchFinder"
      subtitle="WatchFinder helps viewers discover official trailers, legal watch links, free licensed titles, Hindi dubbed picks, cartoons, TV shows and OTT availability in one place."
      cta={{ label: "Explore Movies", href: "/movies" }}
      sections={[
        {
          title: "What WatchFinder Does",
          body: "We organize movie and show discovery around official platforms, public-domain titles, creator-permitted content, licensed videos and trailer-only listings."
        },
        {
          title: "Legal-first Discovery",
          body: "WatchFinder does not host unauthorized movies, torrents, pirated downloads or fake full-movie buttons. Listings point users toward official availability and verified links."
        },
        {
          title: "Built For Mobile",
          body: "The app is designed as a mobile-friendly OTT discovery experience with compact cards, fast search, theme support, PWA install flow and a clean admin workflow."
        }
      ]}
    />
  );
}
