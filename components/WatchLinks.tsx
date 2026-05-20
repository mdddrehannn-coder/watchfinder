import { ExternalLink } from "lucide-react";
import type { MoviePlatformLink } from "@/types/watchfinder";

export default function WatchLinks({ links = [] }: { links?: MoviePlatformLink[] }) {
  const official = links.filter((link) => link.watch_url && link.is_official !== false);
  if (!official.length) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Where to Watch</h2>
      </div>
      <div className="chip-row">
        {official.map((link) => (
          <a
            className="button primary"
            href={link.watch_url || "#"}
            target="_blank"
            rel="noreferrer"
            key={link.id}
          >
            {link.platforms?.name || link.label || "Official link"} <ExternalLink size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}
