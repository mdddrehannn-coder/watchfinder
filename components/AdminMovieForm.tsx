"use client";

import Link from "next/link";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import { Eye, Save } from "lucide-react";
import { slugify } from "@/lib/format";
import { joinLanguages, WATCHFINDER_LANGUAGES } from "@/lib/languages";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadBanner, uploadLicenseDocumentWithPath, uploadPoster } from "@/lib/storage";
import type { CastMember, Genre, Platform } from "@/types/watchfinder";

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

const QUALITY_OPTIONS = [
  "360p",
  "480p",
  "720p HD",
  "1080p Full HD",
  "1440p 2K",
  "2160p 4K",
  "HDR",
  "Dolby Vision"
];

const AVAILABILITY_OPTIONS = [
  { label: "Subscription", value: "subscription" },
  { label: "Rent", value: "rent" },
  { label: "Buy", value: "buy" },
  { label: "Free", value: "free" },
  { label: "Official", value: "official" }
];

function toNullableString(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  return stringValue || null;
}

function toNullableNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && String(value || "").trim() ? numberValue : null;
}

function FormSection({
  title,
  helper,
  children
}: {
  title: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="admin-form-section">
      <legend>{title}</legend>
      <p className="form-helper">{helper}</p>
      {children}
    </fieldset>
  );
}

export default function AdminMovieForm({
  genres,
  castMembers,
  platforms
}: {
  genres: Genre[];
  castMembers: CastMember[];
  platforms: Platform[];
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedType, setSelectedType] = useState("movie");
  const [selectedStatus, setSelectedStatus] = useState("draft");
  const [hasLicensedVideo, setHasLicensedVideo] = useState(false);
  const [isLatest, setIsLatest] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedCast, setSelectedCast] = useState<string[]>([]);
  const [genreSearch, setGenreSearch] = useState("");
  const [castSearch, setCastSearch] = useState("");
  const [selectedWatchLanguages, setSelectedWatchLanguages] = useState<string[]>([]);
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [selectedPlatformId, setSelectedPlatformId] = useState("");
  const [availabilityType, setAvailabilityType] = useState("subscription");
  const [videoProvider, setVideoProvider] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMovieSlug, setSavedMovieSlug] = useState<string | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [posterPreview, bannerPreview]);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) setSlug(slugify(value));
  }

  function setPreview(event: ChangeEvent<HTMLInputElement>, type: "poster" | "banner") {
    const file = event.target.files?.[0];
    const preview = file ? URL.createObjectURL(file) : null;

    if (type === "poster") {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
      setPosterPreview(preview);
      return;
    }

    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(preview);
  }

  function validate(form: FormData) {
    if (!title.trim()) return "Title is required.";
    if (!slug.trim()) return "Slug is required.";
    if (!selectedStatus) return "Status is required.";

    const watchUrl = toNullableString(form.get("watch_url"));
    const platformId = selectedPlatformId;
    if (watchUrl && !platformId) return "Select an official platform before adding a watch link.";
    if (platformId && !watchUrl) return "Official watch link is required when a platform is selected.";

    if (hasLicensedVideo) {
      if (!videoProvider) return "Video provider is required for licensed video.";
      if (!toNullableString(form.get("video_embed_url")) && !toNullableString(form.get("video_id"))) {
        return "Video embed URL or video ID is required for licensed video.";
      }
      if (!licenseType) return "License type is required for licensed video.";
      if (!toNullableString(form.get("license_owner_name"))) return "License owner name is required for licensed video.";
    }

    return null;
  }

  function toggleLanguage(language: string) {
    setSelectedLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language]
    );
  }

  function toggleItem(value: string, setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function applyPositioning(positioning: string) {
    if (positioning === "trailer") {
      setHasLicensedVideo(false);
      setVideoProvider("");
      setLicenseType("");
      return;
    }

    if (positioning === "free") {
      setHasLicensedVideo(true);
      setAvailabilityType("free");
      return;
    }

    if (positioning === "hindi") {
      setSelectedLanguages((current) => current.includes("Hindi Dubbed") ? current : [...current, "Hindi Dubbed"]);
      return;
    }

    if (positioning === "ott") {
      setIsLatest(true);
      return;
    }

    if (positioning === "public_domain") {
      setHasLicensedVideo(true);
      setLicenseType("public_domain");
      return;
    }

    if (positioning === "youtube") {
      const youtube = platforms.find((platform) =>
        `${platform.name} ${platform.slug}`.toLowerCase().includes("youtube")
      );
      if (youtube) setSelectedPlatformId(youtube.id);
      setAvailabilityType("free");
      return;
    }

    if (positioning === "short") {
      setSelectedType("short_film");
    }
  }

  function clearAddAnother() {
    setMessage(null);
    setSavedMovieSlug(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage({ type: "info", text: "Saving movie..." });
    setSavedMovieSlug(null);

    const form = new FormData(event.currentTarget);
    const validationError = validate(form);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { data: auth } = await supabase.auth.getUser();

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        type: selectedType,
        description: toNullableString(form.get("description")),
        release_year: toNullableNumber(form.get("release_year")),
        duration_minutes: toNullableNumber(form.get("duration_minutes")),
        rating: toNullableNumber(form.get("rating")),
        language: joinLanguages(selectedLanguages) || null,
        director: toNullableString(form.get("director")),
        trailer_url: toNullableString(form.get("trailer_url")),
        trailer_provider: toNullableString(form.get("trailer_provider")),
        is_trending: form.get("is_trending") === "on",
        is_featured: form.get("is_featured") === "on",
        is_latest: isLatest,
        popularity_score: toNullableNumber(form.get("popularity_score")) ?? 0,
        status: selectedStatus,
        seo_title: toNullableString(form.get("seo_title")),
        seo_description: toNullableString(form.get("seo_description")),
        og_image_url: toNullableString(form.get("og_image_url")),
        has_licensed_video: hasLicensedVideo,
        video_provider: hasLicensedVideo ? videoProvider : null,
        video_embed_url: hasLicensedVideo ? toNullableString(form.get("video_embed_url")) : null,
        video_id: hasLicensedVideo ? toNullableString(form.get("video_id")) : null,
        license_type: hasLicensedVideo ? licenseType : null,
        license_owner_name: hasLicensedVideo ? toNullableString(form.get("license_owner_name")) : null,
        license_start_date: hasLicensedVideo ? toNullableString(form.get("license_start_date")) : null,
        license_expiry_date: hasLicensedVideo ? toNullableString(form.get("license_expiry_date")) : null,
        license_notes: hasLicensedVideo ? toNullableString(form.get("license_notes")) : null,
        distribution_territory: hasLicensedVideo ? toNullableString(form.get("distribution_territory")) : null
      };

      const { data: movie, error } = await supabase.from("movies").insert(payload).select("id, slug").single();
      if (error || !movie) {
        setMessage({ type: "error", text: error?.message || "Movie save failed." });
        return;
      }

      const poster = form.get("poster") as File;
      const banner = form.get("banner") as File;
      const updatePayload: Record<string, string> = {};
      if (poster?.size) updatePayload.poster_url = await uploadPoster(movie.id, poster);
      if (banner?.size) updatePayload.banner_url = await uploadBanner(movie.id, banner);
      if (Object.keys(updatePayload).length) {
        const { error: imageError } = await supabase.from("movies").update(updatePayload).eq("id", movie.id);
        if (imageError) throw imageError;
      }

      if (selectedGenres.length) {
        const { error: genreError } = await supabase
          .from("movie_genres")
          .insert(selectedGenres.map((genre_id) => ({ movie_id: movie.id, genre_id })));
        if (genreError) throw genreError;
      }

      if (selectedCast.length) {
        const { error: castError } = await supabase
          .from("movie_cast")
          .insert(selectedCast.map((cast_member_id) => ({ movie_id: movie.id, cast_member_id })));
        if (castError) throw castError;
      }

      const platformId = selectedPlatformId;
      const watchUrl = toNullableString(form.get("watch_url"));
      if (platformId && watchUrl) {
        const { error: platformError } = await supabase.from("movie_platform_links").insert({
          movie_id: movie.id,
          platform_id: platformId,
          watch_url: watchUrl,
          availability_type: availabilityType,
          language: joinLanguages(selectedWatchLanguages) || null,
          quality: selectedQualities.join(", ") || null,
          is_official: true,
          is_active: true
        });
        if (platformError) throw platformError;
      }

      const licenseDoc = form.get("license_document") as File;
      if (licenseDoc?.size) {
        const uploaded = await uploadLicenseDocumentWithPath(movie.id, licenseDoc);
        const { error: licenseError } = await supabase.from("license_documents").insert({
          movie_id: movie.id,
          file_url: uploaded.publicUrl,
          file_path: uploaded.path,
          file_name: uploaded.fileName,
          license_type: licenseType,
          owner_name: toNullableString(form.get("license_owner_name")),
          notes: toNullableString(form.get("license_notes")),
          uploaded_by: auth.user?.id ?? null
        });
        if (licenseError) throw licenseError;
      }

      setMessage({ type: "success", text: "Movie saved successfully." });
      setSavedMovieSlug(movie.slug);
      event.currentTarget.reset();
      setTitle("");
      setSlug("");
      setSelectedType("movie");
      setSelectedStatus("draft");
      setHasLicensedVideo(false);
      setIsLatest(false);
      setSelectedLanguages([]);
      setSelectedGenres([]);
      setSelectedCast([]);
      setGenreSearch("");
      setCastSearch("");
      setSelectedWatchLanguages([]);
      setSelectedQualities([]);
      setSelectedPlatformId("");
      setAvailabilityType("subscription");
      setVideoProvider("");
      setLicenseType("");
      setPosterPreview(null);
      setBannerPreview(null);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Movie save failed." });
    } finally {
      setSaving(false);
    }
  }

  const filteredGenres = genres.filter((genre) =>
    genre.name.toLowerCase().includes(genreSearch.toLowerCase())
  );
  const filteredCast = castMembers.filter((member) =>
    member.name.toLowerCase().includes(castSearch.toLowerCase())
  );

  return (
    <form className="form-grid panel admin-movie-form" onSubmit={submit}>
      <FormSection title="Content Positioning" helper="Choose a helper chip to prepare existing fields for the way this title should appear on WatchFinder. These do not create new database columns.">
        <div className="positioning-grid">
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("trailer")}>
            Trailer Only
            <small>Turns licensed video off</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("free")}>
            Free Legal Movie
            <small>Marks licensed/free where possible</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("hindi")}>
            Hindi Dubbed Finder
            <small>Adds Hindi Dubbed language</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("ott")}>
            OTT Release
            <small>Marks as latest</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("public_domain")}>
            Public Domain
            <small>Sets public_domain license</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("youtube")}>
            Official YouTube
            <small>Selects YouTube if available</small>
          </button>
          <button className="positioning-chip" type="button" onClick={() => applyPositioning("short")}>
            Short Film / Indie Film
            <small>Sets type to short film</small>
          </button>
        </div>
        <div className="admin-visibility-note">
          <strong>Homepage visibility</strong>
          <p>To show a movie in homepage slider, set Status = Published and enable Featured, Latest, or Trending. To show in Trending Now: enable Trending. To show in Hindi Dubbed Picks: select Hindi or Hindi Dubbed language. To show in New OTT Releases: enable Latest. To show in Official YouTube Movies: choose YouTube platform and Official availability. To show in Free Legal Movies: only select Free Legal when the full video is legally available.</p>
        </div>
      </FormSection>

      <FormSection title="Basic Details" helper="Add the core title metadata. Keep status as draft until the listing is ready for the public site.">
        <div className="form-grid two">
          <div className="field"><label>Title <span className="required">*</span></label><input required value={title} onChange={(e) => updateTitle(e.target.value)} /></div>
          <div className="field"><label>Slug <span className="required">*</span></label><input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></div>
          <div className="field"><label>Release Year</label><input name="release_year" inputMode="numeric" /></div>
          <div className="field"><label>Duration Minutes</label><input name="duration_minutes" inputMode="numeric" /></div>
          <div className="field"><label>Rating</label><input name="rating" inputMode="decimal" /></div>
          <div className="field"><label>Director</label><input name="director" /></div>
          <div className="field"><label>Popularity Score</label><input name="popularity_score" inputMode="numeric" defaultValue="0" /></div>
        </div>
        <div className="field">
          <label>Type</label>
          <div className="option-group">
            <label className="option-card"><input type="radio" name="type" value="movie" checked={selectedType === "movie"} onChange={() => setSelectedType("movie")} /> <span>Movie</span></label>
            <label className="option-card"><input type="radio" name="type" value="tv_show" checked={selectedType === "tv_show"} onChange={() => setSelectedType("tv_show")} /> <span>TV Show</span></label>
            <label className="option-card"><input type="radio" name="type" value="anime" checked={selectedType === "anime"} onChange={() => setSelectedType("anime")} /> <span>Anime</span></label>
            <label className="option-card"><input type="radio" name="type" value="short_film" checked={selectedType === "short_film"} onChange={() => setSelectedType("short_film")} /> <span>Short Film</span></label>
          </div>
        </div>
        <div className="field">
          <label>Status <span className="required">*</span></label>
          <div className="option-group status-options">
            <label className="option-card"><input type="radio" name="status" value="draft" checked={selectedStatus === "draft"} onChange={() => setSelectedStatus("draft")} required /> <span>Draft</span><small>Hidden from public website</small></label>
            <label className="option-card option-card-published"><input type="radio" name="status" value="published" checked={selectedStatus === "published"} onChange={() => setSelectedStatus("published")} required /> <span>Published</span><small>Visible on website</small></label>
            <label className="option-card"><input type="radio" name="status" value="archived" checked={selectedStatus === "archived"} onChange={() => setSelectedStatus("archived")} required /> <span>Archived</span><small>Hidden/old listing</small></label>
          </div>
        </div>
        <div className="field"><label>Description</label><textarea name="description" /></div>
        <div className="chip-row">
          <label className="chip"><input name="is_trending" type="checkbox" /> Trending</label>
          <label className="chip"><input name="is_featured" type="checkbox" /> Featured</label>
          <label className="chip"><input name="is_latest" type="checkbox" checked={isLatest} onChange={(event) => setIsLatest(event.target.checked)} /> Latest</label>
        </div>
      </FormSection>

      <FormSection title="Languages" helper="Select all languages available for this movie or show.">
        <div className="language-select-grid">
          {WATCHFINDER_LANGUAGES.map((language) => (
            <label className="language-select-chip" key={language}>
              <input
                checked={selectedLanguages.includes(language)}
                onChange={() => toggleLanguage(language)}
                type="checkbox"
                value={language}
              />
              <span>{language}</span>
            </label>
          ))}
        </div>
        {selectedLanguages.length ? (
          <button className="button ghost clear-languages-button" type="button" onClick={() => setSelectedLanguages([])}>
            Clear selected languages
          </button>
        ) : null}
      </FormSection>

      <FormSection title="Images" helper="Upload strong artwork. Poster recommended 600x900. Banner recommended 1600x700.">
        <div className="form-grid two">
          <div className="field">
            <label>Poster image</label>
            <input name="poster" type="file" accept="image/*" onChange={(event) => setPreview(event, "poster")} />
            <small className="muted">Recommended size: 600x900</small>
            {posterPreview ? <img className="image-preview poster-preview" src={posterPreview} alt="Poster preview" /> : null}
          </div>
          <div className="field">
            <label>Banner image</label>
            <input name="banner" type="file" accept="image/*" onChange={(event) => setPreview(event, "banner")} />
            <small className="muted">Recommended size: 1600x700</small>
            {bannerPreview ? <img className="image-preview banner-preview" src={bannerPreview} alt="Banner preview" /> : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="Trailer" helper="Use official YouTube trailer link. Do not download and upload copyrighted trailers.">
        <div className="form-grid two">
          <div className="field"><label>Trailer URL</label><input name="trailer_url" placeholder="Official YouTube URL" /></div>
          <div className="field"><label>Trailer Provider</label><input name="trailer_provider" defaultValue="youtube" /></div>
        </div>
      </FormSection>

      <FormSection title="Genres and Cast" helper="Search and select multiple genres or cast members. Selected items are highlighted.">
        <div className="form-grid two">
          <div className="field">
            <label>Genres</label>
            <input value={genreSearch} onChange={(event) => setGenreSearch(event.target.value)} placeholder="Search genres" />
            <div className="relation-chip-grid">
              {filteredGenres.map((genre) => (
                <button
                  className={selectedGenres.includes(genre.id) ? "relation-chip selected" : "relation-chip"}
                  key={genre.id}
                  onClick={() => toggleItem(genre.id, setSelectedGenres)}
                  type="button"
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Cast Members</label>
            <input value={castSearch} onChange={(event) => setCastSearch(event.target.value)} placeholder="Search cast" />
            <div className="relation-chip-grid">
              {filteredCast.map((member) => (
                <button
                  className={selectedCast.includes(member.id) ? "relation-chip selected" : "relation-chip"}
                  key={member.id}
                  onClick={() => toggleItem(member.id, setSelectedCast)}
                  type="button"
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Official Watch Link" helper="Optional. Add only official legal platform links. Movies can be saved without a platform link.">
        <div className="form-grid two">
          <div className="field"><label>Official Platform</label><select name="platform_id" value={selectedPlatformId} onChange={(event) => setSelectedPlatformId(event.target.value)}><option value="">Select platform</option>{platforms.map((platform) => <option value={platform.id} key={platform.id}>{platform.name}</option>)}</select></div>
          <div className="field"><label>Official Watch Link</label><input name="watch_url" placeholder="https://..." /></div>
        </div>
        <div className="field">
          <label>Availability Type</label>
          <div className="option-group compact-options">
            {AVAILABILITY_OPTIONS.map((option) => (
              <label className="option-card" key={option.value}>
                <input checked={availabilityType === option.value} onChange={() => setAvailabilityType(option.value)} name="availability_type" type="radio" value={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Watch Link Language</label>
          <div className="language-select-grid compact-chip-grid">
            {WATCHFINDER_LANGUAGES.map((language) => (
              <label className="language-select-chip" key={language}>
                <input
                  checked={selectedWatchLanguages.includes(language)}
                  onChange={() => toggleItem(language, setSelectedWatchLanguages)}
                  type="checkbox"
                  value={language}
                />
                <span>{language}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Quality</label>
          <div className="language-select-grid compact-chip-grid">
            {QUALITY_OPTIONS.map((quality) => (
              <label className="language-select-chip" key={quality}>
                <input
                  checked={selectedQualities.includes(quality)}
                  onChange={() => toggleItem(quality, setSelectedQualities)}
                  type="checkbox"
                  value={quality}
                />
                <span>{quality}</span>
              </label>
            ))}
          </div>
        </div>
      </FormSection>

      <FormSection title="Licensed Video" helper="Optional. Leave this off for normal discovery pages with trailers and official watch links.">
        <label className="chip"><input checked={hasLicensedVideo} onChange={(event) => setHasLicensedVideo(event.target.checked)} name="has_licensed_video" type="checkbox" /> Has licensed video</label>
        {hasLicensedVideo ? <p className="legal-badge">Only use videos you own or have written permission to distribute. Do not upload pirated movies.</p> : null}
        {hasLicensedVideo ? (
          <>
            <div className="form-grid two">
              <div className="field"><label>Video Provider <span className="required">*</span></label><select name="video_provider" value={videoProvider} onChange={(event) => setVideoProvider(event.target.value)}><option value="">None</option><option value="cloudflare_stream">Cloudflare Stream</option><option value="vimeo">Vimeo</option><option value="youtube_embed">YouTube Embed</option><option value="supabase_storage_small_video">Supabase small video</option><option value="external_legal_embed">External legal embed</option></select></div>
              <div className="field"><label>Video Embed URL</label><input name="video_embed_url" /></div>
              <div className="field"><label>Video ID</label><input name="video_id" /></div>
              <div className="field"><label>License Type <span className="required">*</span></label><select name="license_type" value={licenseType} onChange={(event) => setLicenseType(event.target.value)}><option value="">Select</option><option value="self_owned">Self owned</option><option value="creator_permission">Creator permission</option><option value="public_domain">Public domain</option><option value="purchased_license">Purchased license</option></select></div>
              <div className="field"><label>License Owner Name <span className="required">*</span></label><input name="license_owner_name" /></div>
              <div className="field"><label>License Start Date</label><input name="license_start_date" type="date" /></div>
              <div className="field"><label>License Expiry Date</label><input name="license_expiry_date" type="date" /></div>
              <div className="field"><label>Distribution Territory</label><input name="distribution_territory" /></div>
              <div className="field"><label>License Document</label><input name="license_document" type="file" /></div>
            </div>
            <div className="field"><label>License Notes</label><textarea name="license_notes" /></div>
          </>
        ) : (
          <p className="muted">License fields are hidden until licensed video is enabled.</p>
        )}
      </FormSection>

      <FormSection title="SEO" helper="Optional metadata for Google and social previews. Blank fields fallback to movie title, description, banner, or poster.">
        <div className="form-grid two">
          <div className="field"><label>SEO Title</label><input name="seo_title" /></div>
          <div className="field"><label>OG Image URL</label><input name="og_image_url" /></div>
        </div>
        <div className="field"><label>SEO Description</label><textarea name="seo_description" /></div>
      </FormSection>

      {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
      {savedMovieSlug ? (
        <div className="save-actions">
          <p className="platform-badge">Saved slug: {savedMovieSlug}</p>
          <Link className="button" href={`/movie/${savedMovieSlug}`}>
            <Eye size={18} /> View Movie Page
          </Link>
          <button className="button ghost" type="button" onClick={clearAddAnother}>
            Add Another Movie
          </button>
        </div>
      ) : null}
      <button className="button primary" type="submit" disabled={saving}>
        <Save size={18} /> {saving ? "Saving..." : "Save movie"}
      </button>
    </form>
  );
}
