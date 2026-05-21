import type { Metadata } from "next";
import Link from "next/link";
import { SunMoon } from "lucide-react";

export const metadata: Metadata = {
  title: "Settings",
  description: "WatchFinder preferences."
};

export default function SettingsPage() {
  return (
    <main className="page-inner">
      <h1>Settings</h1>
      <section className="section form-grid">
        <div className="panel">
          <SunMoon size={24} />
          <h2>Theme Settings</h2>
          <p className="muted">Auto, Dark/Night, or Day/Light mode.</p>
          <Link className="button primary" href="/settings/theme">
            Open Theme Settings
          </Link>
        </div>
        <div className="panel">
          <h2>Language Preference</h2>
          <p className="muted">Preference storage can be connected to profiles.language_preference.</p>
        </div>
      </section>
    </main>
  );
}
