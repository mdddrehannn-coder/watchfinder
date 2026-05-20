"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadPromotionBanner } from "@/lib/storage";

export default function AdminPromotionForm() {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    setStatus("Saving promotion...");
    const { data, error } = await supabase
      .from("promotions")
      .insert({
        title: form.get("title"),
        description: form.get("description"),
        link_url: form.get("link_url"),
        placement: form.get("placement"),
        start_date: form.get("start_date") || null,
        end_date: form.get("end_date") || null,
        is_active: form.get("is_active") === "on",
        priority: Number(form.get("priority")) || 0
      })
      .select("id")
      .single();

    if (error || !data) {
      setStatus(error?.message || "Promotion save failed.");
      return;
    }

    const image = form.get("image") as File;
    if (image?.size) {
      const image_url = await uploadPromotionBanner(data.id, image);
      await supabase.from("promotions").update({ image_url }).eq("id", data.id);
    }

    setStatus("Promotion saved.");
    event.currentTarget.reset();
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <div className="form-grid two">
        <div className="field"><label>Title</label><input name="title" required /></div>
        <div className="field"><label>Placement</label><input name="placement" placeholder="home_hero, offers, movie_detail_top" required /></div>
        <div className="field"><label>Image</label><input name="image" type="file" accept="image/*" /></div>
        <div className="field"><label>Link URL</label><input name="link_url" /></div>
        <div className="field"><label>Start Date</label><input name="start_date" type="date" /></div>
        <div className="field"><label>End Date</label><input name="end_date" type="date" /></div>
        <div className="field"><label>Priority</label><input name="priority" inputMode="numeric" defaultValue="0" /></div>
        <label className="chip"><input name="is_active" type="checkbox" /> Active</label>
      </div>
      <div className="field"><label>Description</label><textarea name="description" /></div>
      {status ? <p className="muted">{status}</p> : null}
      <button className="button primary" type="submit">Save promotion</button>
    </form>
  );
}
