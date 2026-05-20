"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { uploadLicenseDocument } from "@/lib/storage";
import type { Movie } from "@/types/watchfinder";

export default function AdminLicenseForm({ movies }: { movies: Movie[] }) {
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const movieId = String(form.get("movie_id") || "");
    const file = form.get("document") as File;
    if (!movieId || !file?.size) {
      setStatus("Choose a movie and document.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const documentUrl = await uploadLicenseDocument(movieId, file);
    const { error } = await supabase.from("license_documents").insert({
      movie_id: movieId,
      file_url: documentUrl,
      document_url: documentUrl,
      document_type: form.get("document_type"),
      notes: form.get("notes")
    });
    setStatus(error ? error.message : "License document saved.");
    if (!error) event.currentTarget.reset();
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <p className="legal-badge">License proof is required before WatchFinder shows full licensed video playback.</p>
      <div className="form-grid two">
        <div className="field"><label>Movie</label><select name="movie_id" required><option value="">Select movie</option>{movies.map((movie) => <option value={movie.id} key={movie.id}>{movie.title}</option>)}</select></div>
        <div className="field"><label>Document Type</label><input name="document_type" defaultValue="license" /></div>
        <div className="field"><label>Document</label><input name="document" type="file" required /></div>
      </div>
      <div className="field"><label>Notes</label><textarea name="notes" /></div>
      {status ? <p className="muted">{status}</p> : null}
      <button className="button primary" type="submit">Upload license document</button>
    </form>
  );
}
