"use client";

import { useState } from "react";
import { slugify } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadBanner, uploadLicenseDocument, uploadPoster } from "@/lib/storage";
import type { CastMember, Genre, Platform } from "@/types/watchfinder";

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
  const [status, setStatus] = useState<string | null>(null);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) setSlug(slugify(value));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving movie...");
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();

    const payload = {
      title,
      slug,
      type: form.get("type"),
      description: form.get("description"),
      release_year: Number(form.get("release_year")) || null,
      duration_minutes: Number(form.get("duration_minutes")) || null,
      rating: Number(form.get("rating")) || null,
      language: form.get("language"),
      director: form.get("director"),
      trailer_url: form.get("trailer_url"),
      trailer_provider: form.get("trailer_provider"),
      is_trending: form.get("is_trending") === "on",
      is_featured: form.get("is_featured") === "on",
      is_latest: form.get("is_latest") === "on",
      popularity_score: Number(form.get("popularity_score")) || 0,
      status: form.get("status"),
      seo_title: form.get("seo_title"),
      seo_description: form.get("seo_description"),
      og_image_url: form.get("og_image_url"),
      has_licensed_video: form.get("has_licensed_video") === "on",
      video_provider: form.get("video_provider") || null,
      video_embed_url: form.get("video_embed_url") || null,
      video_id: form.get("video_id") || null,
      license_type: form.get("license_type") || null,
      license_owner_name: form.get("license_owner_name") || null,
      license_start_date: form.get("license_start_date") || null,
      license_expiry_date: form.get("license_expiry_date") || null,
      license_notes: form.get("license_notes") || null,
      distribution_territory: form.get("distribution_territory") || null
    };

    const { data: movie, error } = await supabase.from("movies").insert(payload).select("id").single();
    if (error || !movie) {
      setStatus(error?.message || "Movie save failed.");
      return;
    }

    const poster = form.get("poster") as File;
    const banner = form.get("banner") as File;
    const licenseDoc = form.get("license_document") as File;
    const updatePayload: Record<string, string> = {};
    if (poster?.size) updatePayload.poster_url = await uploadPoster(movie.id, poster);
    if (banner?.size) updatePayload.banner_url = await uploadBanner(movie.id, banner);
    if (Object.keys(updatePayload).length) await supabase.from("movies").update(updatePayload).eq("id", movie.id);

    const selectedGenres = form.getAll("genres").map(String);
    if (selectedGenres.length) {
      await supabase.from("movie_genres").insert(selectedGenres.map((genre_id) => ({ movie_id: movie.id, genre_id })));
    }

    const selectedCast = form.getAll("cast").map(String);
    if (selectedCast.length) {
      await supabase.from("movie_cast").insert(selectedCast.map((cast_member_id) => ({ movie_id: movie.id, cast_member_id })));
    }

    const platformId = form.get("platform_id");
    const watchUrl = form.get("watch_url");
    if (platformId && watchUrl) {
      await supabase.from("movie_platform_links").insert({
        movie_id: movie.id,
        platform_id: platformId,
        watch_url: watchUrl,
        label: form.get("watch_label"),
        is_official: true
      });
    }

    if (licenseDoc?.size) {
      const documentUrl = await uploadLicenseDocument(movie.id, licenseDoc);
      await supabase.from("license_documents").insert({
        movie_id: movie.id,
        file_url: documentUrl,
        document_url: documentUrl,
        document_type: form.get("license_type") || "license",
        notes: form.get("license_notes")
      });
    }

    setStatus("Movie saved.");
    event.currentTarget.reset();
    setTitle("");
    setSlug("");
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <p className="legal-badge">Only upload or embed videos that you legally own or have permission to distribute. Do not upload pirated movies.</p>
      <div className="form-grid two">
        <div className="field"><label>Title</label><input required value={title} onChange={(e) => updateTitle(e.target.value)} /></div>
        <div className="field"><label>Slug</label><input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></div>
        <div className="field"><label>Type</label><select name="type"><option value="movie">Movie</option><option value="tv_show">TV Show</option><option value="anime">Anime</option><option value="short_film">Short Film</option></select></div>
        <div className="field"><label>Status</label><select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
        <div className="field"><label>Poster</label><input name="poster" type="file" accept="image/*" /></div>
        <div className="field"><label>Banner</label><input name="banner" type="file" accept="image/*" /></div>
        <div className="field"><label>Release Year</label><input name="release_year" inputMode="numeric" /></div>
        <div className="field"><label>Duration Minutes</label><input name="duration_minutes" inputMode="numeric" /></div>
        <div className="field"><label>Rating</label><input name="rating" inputMode="decimal" /></div>
        <div className="field"><label>Language</label><input name="language" /></div>
        <div className="field"><label>Director</label><input name="director" /></div>
        <div className="field"><label>Popularity Score</label><input name="popularity_score" inputMode="numeric" defaultValue="0" /></div>
      </div>
      <div className="field"><label>Description</label><textarea name="description" /></div>
      <div className="form-grid two">
        <div className="field"><label>Trailer URL</label><input name="trailer_url" placeholder="Official YouTube URL" /></div>
        <div className="field"><label>Trailer Provider</label><input name="trailer_provider" defaultValue="youtube" /></div>
      </div>
      <div className="chip-row">
        <label className="chip"><input name="is_trending" type="checkbox" /> Trending</label>
        <label className="chip"><input name="is_featured" type="checkbox" /> Featured</label>
        <label className="chip"><input name="is_latest" type="checkbox" /> Latest</label>
      </div>
      <div className="form-grid two">
        <div className="field"><label>Genres</label><select name="genres" multiple>{genres.map((genre) => <option value={genre.id} key={genre.id}>{genre.name}</option>)}</select></div>
        <div className="field"><label>Cast</label><select name="cast" multiple>{castMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></div>
      </div>
      <div className="form-grid two">
        <div className="field"><label>Official Platform</label><select name="platform_id"><option value="">Select platform</option>{platforms.map((platform) => <option value={platform.id} key={platform.id}>{platform.name}</option>)}</select></div>
        <div className="field"><label>Official Watch Link</label><input name="watch_url" placeholder="https://..." /></div>
        <div className="field"><label>Watch Label</label><input name="watch_label" placeholder="Watch on Netflix" /></div>
      </div>
      <div className="form-grid two">
        <label className="chip"><input name="has_licensed_video" type="checkbox" /> Has licensed video</label>
        <div className="field"><label>Video Provider</label><select name="video_provider"><option value="">None</option><option value="cloudflare_stream">Cloudflare Stream</option><option value="vimeo">Vimeo</option><option value="youtube_embed">YouTube Embed</option><option value="supabase_storage_small_video">Supabase small video</option><option value="external_legal_embed">External legal embed</option></select></div>
        <div className="field"><label>Video Embed URL</label><input name="video_embed_url" /></div>
        <div className="field"><label>Video ID</label><input name="video_id" /></div>
        <div className="field"><label>License Type</label><select name="license_type"><option value="">Select</option><option value="self_owned">Self owned</option><option value="creator_permission">Creator permission</option><option value="public_domain">Public domain</option><option value="purchased_license">Purchased license</option></select></div>
        <div className="field"><label>License Owner Name</label><input name="license_owner_name" /></div>
        <div className="field"><label>License Start Date</label><input name="license_start_date" type="date" /></div>
        <div className="field"><label>License Expiry Date</label><input name="license_expiry_date" type="date" /></div>
        <div className="field"><label>Distribution Territory</label><input name="distribution_territory" /></div>
        <div className="field"><label>License Document</label><input name="license_document" type="file" /></div>
      </div>
      <div className="field"><label>License Notes</label><textarea name="license_notes" /></div>
      <div className="form-grid two">
        <div className="field"><label>SEO Title</label><input name="seo_title" /></div>
        <div className="field"><label>OG Image URL</label><input name="og_image_url" /></div>
      </div>
      <div className="field"><label>SEO Description</label><textarea name="seo_description" /></div>
      {status ? <p className="muted">{status}</p> : null}
      <button className="button primary" type="submit">Save movie</button>
    </form>
  );
}
