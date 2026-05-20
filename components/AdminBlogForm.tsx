"use client";

import { useState } from "react";
import { slugify } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadBlogImage } from "@/lib/storage";

export default function AdminBlogForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  function updateTitle(value: string) {
    setTitle(value);
    if (!slug) setSlug(slugify(value));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    setStatus("Saving post...");
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title,
        slug,
        content: form.get("content"),
        excerpt: form.get("excerpt"),
        category: form.get("category"),
        tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        status: form.get("status"),
        seo_title: form.get("seo_title"),
        seo_description: form.get("seo_description"),
        published_at: form.get("published_at") || null
      })
      .select("id")
      .single();

    if (error || !data) {
      setStatus(error?.message || "Post save failed.");
      return;
    }

    const image = form.get("featured_image") as File;
    if (image?.size) {
      const featured_image_url = await uploadBlogImage(data.id, image);
      await supabase.from("blog_posts").update({ featured_image_url }).eq("id", data.id);
    }

    setStatus("Post saved.");
    event.currentTarget.reset();
    setTitle("");
    setSlug("");
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <div className="form-grid two">
        <div className="field"><label>Title</label><input required value={title} onChange={(e) => updateTitle(e.target.value)} /></div>
        <div className="field"><label>Slug</label><input required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} /></div>
        <div className="field"><label>Featured Image</label><input name="featured_image" type="file" accept="image/*" /></div>
        <div className="field"><label>Category</label><input name="category" /></div>
        <div className="field"><label>Tags</label><input name="tags" placeholder="ott, review, news" /></div>
        <div className="field"><label>Status</label><select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
        <div className="field"><label>Published At</label><input name="published_at" type="datetime-local" /></div>
      </div>
      <div className="field"><label>Excerpt</label><textarea name="excerpt" /></div>
      <div className="field"><label>Content</label><textarea name="content" /></div>
      <div className="form-grid two">
        <div className="field"><label>SEO Title</label><input name="seo_title" /></div>
        <div className="field"><label>SEO Description</label><textarea name="seo_description" /></div>
      </div>
      {status ? <p className="muted">{status}</p> : null}
      <button className="button primary" type="submit">Save blog post</button>
    </form>
  );
}
