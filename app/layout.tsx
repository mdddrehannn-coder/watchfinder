import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import "@/app/globals.css";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import HeaderAuthButton from "@/components/HeaderAuthButton";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "WatchFinder",
  title: {
    default: "WatchFinder - Find Movies, Web Series and OTT Updates in One Place",
    template: "%s - WatchFinder"
  },
  description: "Find Movies, Web Series and OTT Updates in One Place.",
  manifest: "/manifest.webmanifest",
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
    description: "Find Movies, Web Series and OTT Updates in One Place",
    siteName: "WatchFinder",
    images: ["/logo.png"],
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#090a0f"
};

const nav = [
  ["Movies", "/movies"],
  ["TV Shows", "/tv-shows"],
  ["Anime", "/anime"],
  ["Categories", "/categories"],
  ["Platforms", "/platforms"],
  ["Blog", "/blog"]
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
