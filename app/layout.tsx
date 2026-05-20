import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import "@/app/globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: {
    default: "WatchFinder - Find Movies, Web Series and OTT Updates in One Place",
    template: "%s - WatchFinder"
  },
  description: "Find Movies, Web Series and OTT Updates in One Place.",
  openGraph: {
    title: "WatchFinder",
    description: "Find Movies, Web Series and OTT Updates in One Place",
    siteName: "WatchFinder",
    type: "website"
  }
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
              <Link className="brand" href="/">
                Watch<span>Finder</span>
              </Link>
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
