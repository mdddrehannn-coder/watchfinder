import type { Metadata } from "next";
import Link from "next/link";
import { SunMoon } from "lucide-react";
import LogoutControl from "@/components/LogoutControl";
import MetadataProviderSettings from "@/components/MetadataProviderSettings";
import { isAdminEmail } from "@/lib/admin-access";
import { getCurrentUserAndProfile } from "@/lib/data";

export const metadata: Metadata = {
  title: "Settings",
  description: "WatchFinder preferences."
};

export default async function SettingsPage() {
  const { user } = await getCurrentUserAndProfile();
  const isAdmin = isAdminEmail(user?.email);

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
          <p className="muted">Coming soon: save preferred languages for personalized discovery.</p>
          <span className="status-badge status-draft">Coming soon</span>
        </div>
      </section>
      {isAdmin ? <MetadataProviderSettings /> : null}
      {user ? <LogoutControl className="panel logout-panel settings-logout-panel" /> : null}
    </main>
  );
}
