"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AdminAdSlotForm() {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("ad_slots").insert({
      slot_name: form.get("slot_name"),
      placement: form.get("placement"),
      ad_code: form.get("ad_code"),
      is_active: form.get("is_active") === "on",
      notes: form.get("notes")
    });

    setStatus(error ? error.message : "Ad slot saved.");
    if (!error) event.currentTarget.reset();
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <p className="legal-badge">Ad slots are inactive by default. Do not use popup, forced redirect, adult, betting, fake download or piracy ads.</p>
      <div className="form-grid two">
        <div className="field"><label>Slot Name</label><input name="slot_name" required /></div>
        <div className="field"><label>Placement</label><input name="placement" required placeholder="home, movie_detail_top" /></div>
      </div>
      <div className="field"><label>Ad Code</label><textarea name="ad_code" placeholder="Approved brand-safe ad code later" /></div>
      <div className="field"><label>Notes</label><textarea name="notes" /></div>
      <label className="chip"><input name="is_active" type="checkbox" /> Active</label>
      {status ? <p className="muted">{status}</p> : null}
      <button className="button primary" type="submit">Save ad slot</button>
    </form>
  );
}
