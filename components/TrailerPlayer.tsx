import { getYouTubeEmbedUrl } from "@/lib/format";

export default function TrailerPlayer({ trailerUrl }: { trailerUrl?: string | null }) {
  const embedUrl = getYouTubeEmbedUrl(trailerUrl);
  if (!embedUrl) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Official Trailer</h2>
      </div>
      <iframe
        className="embed"
        src={embedUrl}
        title="Official trailer"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </section>
  );
}
