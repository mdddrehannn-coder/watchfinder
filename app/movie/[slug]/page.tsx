import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { Play } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import LicensedVideoPlayer from "@/components/LicensedVideoPlayer";
import LanguageTags from "@/components/LanguageTags";
import MovieAnalyticsTracker from "@/components/MovieAnalyticsTracker";
import MovieSlider from "@/components/MovieSlider";
import PromotionBanner from "@/components/PromotionBanner";
import ShareButton from "@/components/ShareButton";
import TrailerModalTrigger from "@/components/TrailerModalTrigger";
import TrailerPlayer from "@/components/TrailerPlayer";
import WatchHistoryRecorder from "@/components/WatchHistoryRecorder";
import WatchLinks from "@/components/WatchLinks";
import {
  getAdSlots,
  getLicenseDocumentsForMovie,
  getMovieBySlug,
  getPromotions,
  getSimilarMovies
} from "@/lib/data";
import { movieAvailabilityTypes, movieQualities, movieSmartBadges, readableAvailability } from "@/lib/discovery";
import { formatDuration, formatType, getYouTubeEmbedUrl } from "@/lib/format";
import { isExternalOnlyPlatform, isKnownExternalWatchPageUrl } from "@/lib/watch-links";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  if (!movie) return { title: "Movie" };
  return {
    title: movie.seo_title || `${movie.title} - WatchFinder`,
    description: movie.seo_description || movie.description || undefined,
    openGraph: {
      title: movie.seo_title || movie.title,
      description: movie.seo_description || movie.description || undefined,
      images: [movie.og_image_url || movie.banner_url || movie.poster_url || ""].filter(Boolean)
    }
  };
}

export default async function MovieDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  if (!movie) notFound();

  const [topPromos, middlePromos, topAds, middleAds, similar, licenseDocuments] = await Promise.all([
    getPromotions("movie_detail_top"),
    getPromotions("movie_detail_middle"),
    getAdSlots("movie_detail_top"),
    getAdSlots("movie_detail_middle"),
    getSimilarMovies(movie),
    getLicenseDocumentsForMovie(movie.id)
  ]);

  const hasProof = licenseDocuments.length > 0;
  const hasExternalOttLink = Boolean(movie.movie_platform_links?.some((link) => link.is_active !== false && isExternalOnlyPlatform(link.platforms)));
  const legalEmbedUrl = movie.video_embed_url && !isKnownExternalWatchPageUrl(movie.video_embed_url) ? movie.video_embed_url : null;
  const legalVideoSource = legalEmbedUrl || movie.video_id;
  const playableVideoProvider = movie.video_provider === "external_ott_link" ? null : movie.video_provider;
  const canShowLicensedVideo = Boolean(
    movie.has_licensed_video &&
      legalVideoSource &&
      hasProof &&
      playableVideoProvider &&
      movie.license_type &&
      movie.license_owner_name
  );
  const qualities = movieQualities(movie);
  const availabilityTypes = movieAvailabilityTypes(movie);
  const allBadges = movieSmartBadges(movie);
  const modalProvider = playableVideoProvider || movie.trailer_provider || "youtube";
  const hasPlayableModalSource = Boolean(
    (playableVideoProvider && legalEmbedUrl) ||
      getYouTubeEmbedUrl(movie.trailer_url)
  );

  return (
    <main className="page-inner">
      <MovieAnalyticsTracker movieId={movie.id} slug={movie.slug} />
      <WatchHistoryRecorder movieId={movie.id} />
      <PromotionBanner promotion={topPromos[0]} />
      <AdSlot slot={topAds[0]} />

      <section className="detail-hero section">
        <div className="detail-banner" aria-label={`${movie.title} banner`}>
          {movie.banner_url || movie.poster_url ? <img src={movie.banner_url || movie.poster_url || ""} alt={movie.title} /> : null}
        </div>
        <div className="detail-layout">
          {hasPlayableModalSource ? (
            <TrailerModalTrigger
              className="detail-poster"
              trailerUrl={movie.trailer_url}
              videoEmbedUrl={playableVideoProvider ? legalEmbedUrl : null}
              movieId={movie.id}
              movieSlug={movie.slug}
              provider={modalProvider}
              title={movie.title}
            >
              {movie.poster_url ? <img src={movie.poster_url} alt={`${movie.title} poster`} /> : null}
            </TrailerModalTrigger>
          ) : (
            <div className="detail-poster detail-poster-static">
              {movie.poster_url ? <img src={movie.poster_url} alt={`${movie.title} poster`} /> : null}
            </div>
          )}
          <div>
            <div className="meta-line">
              <span className="rating-badge">{formatType(movie.type)}</span>
              {movie.release_year ? <span>{movie.release_year}</span> : null}
              {formatDuration(movie.duration_minutes) ? <span>{formatDuration(movie.duration_minutes)}</span> : null}
              {movie.rating ? <span>Rating {movie.rating}</span> : null}
            </div>
            <h1>{movie.title}</h1>
            <LanguageTags value={movie.language} />
            <div className="smart-badge-row detail-badge-row">
              {allBadges.map((badge) => (
                <span className="smart-badge" key={badge}>{badge}</span>
              ))}
            </div>
            {qualities.length || availabilityTypes.length ? (
              <div className="language-tags">
                {availabilityTypes.map((availability) => (
                  <span className="platform-badge" key={availability}>{readableAvailability(availability)}</span>
                ))}
                {qualities.map((quality) => (
                  <span className="language-tag" key={quality}>{quality}</span>
                ))}
              </div>
            ) : null}
            <p className="muted">{movie.description}</p>
            <div className="chip-row">
              {movie.genres?.map((genre) => (
                <a className="chip" href={`/category/${genre.slug}`} key={genre.id}>
                  {genre.name}
                </a>
              ))}
            </div>
            <p><strong>Director:</strong> {movie.director || "Not listed"}</p>
            <p><strong>Cast:</strong> {movie.cast_members?.map((member) => member.name).join(", ") || "Not listed"}</p>
            <div className="chip-row">
              {hasPlayableModalSource ? (
                <TrailerModalTrigger
                  className="button primary watch-trailer-action"
                  trailerUrl={movie.trailer_url}
                  videoEmbedUrl={playableVideoProvider ? legalEmbedUrl : null}
                  movieId={movie.id}
                  movieSlug={movie.slug}
                  provider={modalProvider}
                  title={movie.title}
                  buttonLabel="Watch Trailer"
                >
                  <Play size={18} fill="currentColor" />
                  Watch Trailer
                </TrailerModalTrigger>
              ) : null}
              <FavoriteButton movieId={movie.id} />
              <ShareButton title={movie.title} />
            </div>
          </div>
        </div>
      </section>

      <section className="section panel legal-watch-panel">
        <div>
          <h2>{canShowLicensedVideo ? "Watch Free Legally" : "Where to Watch Legally"}</h2>
          {canShowLicensedVideo ? (
            <div className="language-tags">
              <span className="legal-badge">Licensed / Permission Verified</span>
              <span className="platform-badge">{movie.license_type?.replaceAll("_", " ")}</span>
              <span className="platform-badge">{movie.video_provider?.replaceAll("_", " ")}</span>
              {movie.license_owner_name ? <span className="platform-badge">{movie.license_owner_name}</span> : null}
            </div>
          ) : (
            <p className="muted">
              Trailer-only listing. WatchFinder does not host unauthorized movies. Use official links below.
              {hasExternalOttLink ? " OTT playback opens on the official app/site; WatchFinder does not embed JioHotstar, Netflix, Prime Video, or other DRM OTT videos." : ""}
            </p>
          )}
        </div>
      </section>

      <WatchLinks links={movie.movie_platform_links} movie={{ id: movie.id, slug: movie.slug }} title={movie.title} />
      {getYouTubeEmbedUrl(movie.trailer_url) ? (
        <TrailerPlayer
          trailerUrl={movie.trailer_url}
          movieId={movie.id}
          movieSlug={movie.slug}
          provider={movie.trailer_provider || "youtube"}
          title={movie.title}
        />
      ) : null}
      <PromotionBanner promotion={middlePromos[0]} />
      <AdSlot slot={middleAds[0]} />
      <LicensedVideoPlayer movie={movie} hasProof={hasProof} />
      <MovieSlider title="Similar Movies" movies={similar} />
    </main>
  );
}
