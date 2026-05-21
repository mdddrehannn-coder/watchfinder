import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import "@/app/globals.css";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import HeaderAuthButton from "@/components/HeaderAuthButton";
import ThemeManager from "@/components/ThemeManager";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "WatchFinder",
  title: {
    default: "WatchFinder - Free Legal Movies, Hindi Dubbed Finder and OTT Release Guide",
    template: "%s - WatchFinder"
  },
  description: "Find free legal movies, Hindi dubbed titles, trailers and OTT availability in one place.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "WatchFinder",
    statusBarStyle: "black-translucent"
  },
  openGraph: {
    title: "WatchFinder",
    description: "Find free legal movies, Hindi dubbed titles, trailers and OTT availability in one place.",
    siteName: "WatchFinder",
    images: ["/brand/watchfinder-wordmark.png"],
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#090a0f"
};

const nav = [
  ["Free Movies", "/free-movies"],
  ["Hindi Dubbed", "/hindi-dubbed"],
  ["OTT Releases", "/ott-releases"],
  ["Movies", "/movies"],
  ["Platforms", "/platforms"],
  ["Blog", "/blog"]
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function () {
      try {
        var mode = localStorage.getItem("watchfinder-theme-mode") || "auto";
        var hour = new Date().getHours();
        var theme = mode === "light" || (mode === "auto" && hour >= 6 && hour < 18) ? "theme-light" : "theme-dark";
        document.documentElement.classList.remove("theme-dark", "theme-light");
        document.documentElement.classList.add(theme);
        document.documentElement.dataset.themeMode = mode === "dark" || mode === "light" ? mode : "auto";
      } catch (error) {
        document.documentElement.classList.add("theme-dark");
      }
    })();
  `;

  return (
    <html lang="en" className="theme-dark" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeManager />
        <div className="app-shell">
          <header className="site-header">
            <div className="header-inner">
              <BrandLogo variant="header" />
              <Link className="search-pill" href="/search" aria-label="Search movies and shows">
                <Search size={18} />
                <span className="muted">Search movies, shows, platforms</span>
              </Link>
              <nav className="top-nav" aria-label="Primary">
                {nav.map(([label, href]) => (
                  <Link key={href} href={href}>
                    {label}
                  </Link>
                ))}
                <HeaderAuthButton />
              </nav>
            </div>
          </header>
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
