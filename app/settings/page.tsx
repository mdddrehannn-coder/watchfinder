import type { Metadata } from "next";

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
          <h2>Appearance</h2>
          <p className="muted">Dark OTT mode is enabled across WatchFinder.</p>
        </div>
        <div className="panel">
          <h2>Language Preference</h2>
          <p className="muted">Preference storage can be connected to profiles.language_preference.</p>
        </div>
      </section>
    </main>
  );
}
