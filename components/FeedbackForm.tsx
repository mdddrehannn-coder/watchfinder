"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function FeedbackForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("feedback_messages").insert({
      name: form.get("name"),
      email: form.get("email"),
      subject: form.get("subject"),
      message: form.get("message"),
      status: "new"
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSent(true);
    event.currentTarget.reset();
  }

  return (
    <form className="form-grid panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" placeholder="Your name" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" />
      </div>
      <div className="field">
        <label htmlFor="subject">Subject</label>
        <input id="subject" name="subject" placeholder="Feedback, correction, partnership" />
      </div>
      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required placeholder="Tell us what to improve." />
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {sent ? <p className="legal-badge">Feedback sent</p> : null}
      <button className="button primary" type="submit">Send feedback</button>
    </form>
  );
}
