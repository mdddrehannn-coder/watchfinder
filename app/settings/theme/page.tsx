import type { Metadata } from "next";
import Link from "next/link";
import ThemeModeSelector from "@/components/ThemeModeSelector";

export const metadata: Metadata = {
  title: "Theme Settings",
  description: "Choose Auto, Night/Dark, or Day/Light theme for WatchFinder."
};

export default function ThemeSettingsPage() {
  return (
    <main className="page-inner">
      <Link className="button ghost" href="/profile">
        Back to profile
      </Link>
      <section className="section panel theme-settings-panel">
        <div>
          <h1>Theme Settings</h1>
          <p className="muted">Choose how WatchFinder should look on this device.</p>
        </div>
        <ThemeModeSelector />
      </section>
    </main>
  );
}
