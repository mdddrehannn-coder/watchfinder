import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import EpisodeAnalyticsTracker from "@/components/EpisodeAnalyticsTracker";
import WatchHistoryRecorder from "@/components/WatchHistoryRecorder";
import { getSeriesEpisodeByNumbers } from "@/lib/data";
import { getYouTubeEmbedUrl } from "@/lib/format";
import { isSafeLauncherUrl } from "@/lib/platformBehavior";

export const dynamic = "force-dynamic";

function getEmbedSrc(url?: string | null) {
  if (!url) return "";
  const youtube = getYouTubeEmbedUrl(url);
  if (youtube) {
    try {
      const parsed = new URL(youtube);
      parsed.searchParams.set("autoplay", "1");
      parsed.searchParams.set("playsinline", "1");
      parsed.searchParams.set("rel", "0");
      parsed.searchParams.set("modestbranding", "1");
      return parsed.toString();
    } catch {
      return youtube;
    }
  }
  return url;
}

function isExternalEpisodeProvider(provider?: string | null) {
  const cleaned = String(provider || "").trim().toLowerCase();
  return ["external_ott_link", "none", "no_playable_video"].includes(cleaned);
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; seasonNumber: string; episodeNumber: string }>;
}): Promise<Metadata> {
  const { slug, seasonNumber, episodeNumber } = await params;
  const data = await getSeriesEpisodeByNumbers(slug, Number(seasonNumber), Number(episodeNumber));
  if (!data) return { title: "Episode not found" };
  return {
    title: `${data.episode.title} - ${data.series.title}`,
    description: data.episode.description || data.series.description || undefined
  };
}

export default async function WebSeriesEpisodePage({
  params
}: {
  params: Promise<{ slug: string; seasonNumber: string; episodeNumber: string }>;
}) {
  const { slug, seasonNumber, episodeNumber } = await params;
  const data = await getSeriesEpisodeByNumbers(slug, Number(seasonNumber), Number(episodeNumber));
  if (!data) notFound();

  const { series, season, episode, previous, next } = data;
  const embedSource = isExternalEpisodeProvider(episode.video_provider)
    ? ""
    : getEmbedSrc(episode.video_embed_url || episode.trailer_url || episode.video_url);
  const officialUrl = episode.watch_url || (!embedSource ? episode.trailer_url : "");
  const platformName = episode.platform_name || "Official platform";
  const safeOfficialUrl = isSafeLauncherUrl(officialUrl) ? officialUrl : "";
  const officialHref = safeOfficialUrl || "";

  return (
    <main className="series-player-page">
      <EpisodeAnalyticsTracker
        episodeNumber={episode.episode_number}
        eventType={embedSource ? "episode_play" : "episode_view"}
        seasonNumber={season.season_number}
        seriesSlug={series.slug}
      />
      <WatchHistoryRecorder
        action={embedSource ? "episode_play" : "episode_view"}
        content={{
          content_id: episode.id,
          content_slug: `web-series/${series.slug}/season/${season.season_number}/episode/${episode.episode_number}`,
          content_type: "episode",
          title: `${series.title} - ${episode.title}`,
          poster_url: episode.poster_url || episode.thumbnail_url || series.poster_url || null,
          platform_name: platformName,
          href: `/web-series/${series.slug}/season/${season.season_number}/episode/${episode.episode_number}`
        }}
      />
      <div className="series-player-topbar">
        <Link className="button ghost" href={`/web-series/${series.slug}`}>
          <ArrowLeft size={16} /> Back to Series
        </Link>
        <div>
          <p className="rating-badge">S{season.season_number} E{episode.episode_number}</p>
          <h1>{episode.title}</h1>
        </div>
      </div>
      <section className="series-player-shell">
        {embedSource ? (
          <iframe
            className="series-player-frame"
            src={embedSource}
            title={`${series.title} - ${episode.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : officialHref ? (
          <div className="watch-guide-card series-player-fallback">
            <p className="rating-badge">Official platform</p>
            <h2>Open this episode legally</h2>
            <p className="muted">Playback is controlled by {platformName}. WatchFinder opens the official page and does not host protected OTT videos.</p>
            <a className="button primary" href={officialHref} target="_blank" rel="noreferrer">
              Open {platformName} <ExternalLink size={16} />
            </a>
          </div>
        ) : (
          <div className="watch-guide-card series-player-fallback">
            <h2>No official watch link available yet.</h2>
            <p className="muted">Add an official YouTube/embed URL or legal platform link from the Web Series admin form.</p>
          </div>
        )}
      </section>
      <section className="series-player-meta">
        <div>
          <p className="muted">{series.title} - Season {season.season_number}</p>
          <h2>{episode.title}</h2>
          {episode.description ? <p className="muted">{episode.description}</p> : null}
          <div className="meta-line">
            {episode.duration ? <span>{episode.duration}</span> : null}
            {episode.language ? <span>{episode.language}</span> : null}
            {episode.quality ? <span>{episode.quality}</span> : null}
            {episode.release_date ? <span>{new Date(episode.release_date).toLocaleDateString()}</span> : null}
          </div>
        </div>
        <div className="save-actions">
          {previous ? (
            <Link className="button" href={`/web-series/${series.slug}/season/${previous.season.season_number}/episode/${previous.episode.episode_number}`}>
              <ChevronLeft size={16} /> Previous Episode
            </Link>
          ) : null}
          {next ? (
            <Link className="button primary" href={`/web-series/${series.slug}/season/${next.season.season_number}/episode/${next.episode.episode_number}`}>
              Next Episode <ChevronRight size={16} />
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}
