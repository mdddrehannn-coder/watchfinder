import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "@/app/globals.css";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import BrandLogo from "@/components/BrandLogo";
import BottomNav from "@/components/BottomNav";
import HeaderAuthButton from "@/components/HeaderAuthButton";
import NavbarSearch from "@/components/NavbarSearch";
import AppUpdateManager from "@/components/AppUpdateManager";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import PWAInstallManager from "@/components/PWAInstallManager";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SimpleSplashScreen from "@/components/SimpleSplashScreen";
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
      { url: "/favicon-v3.ico?v=3" },
      { url: "/icon-192-v3.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icon-512-v3.png?v=3", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon-v3.png?v=3", sizes: "180x180", type: "image/png" }]
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
  ["Cartoons", "/cartoons"],
  ["TV Shows", "/tv-shows"]
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function () {
      try {
        var mode = localStorage.getItem("watchfinder-theme-mode") || "dark";
        var hour = new Date().getHours();
        var theme = mode === "light" || (mode === "auto" && hour >= 6 && hour < 18) ? "theme-light" : "theme-dark";
        document.documentElement.classList.remove("theme-dark", "theme-light");
        document.documentElement.classList.add(theme);
        document.documentElement.dataset.themeMode = mode === "dark" || mode === "light" || mode === "auto" ? mode : "dark";
        var themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.setAttribute("content", theme === "theme-light" ? "#f6f7fb" : "#090a0f");
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
        <SimpleSplashScreen />
        <ServiceWorkerRegister />
        <PWAInstallManager>
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          <div className="app-shell">
            <header className="site-header">
              <div className="header-inner">
                <BrandLogo variant="header" showText={false} />
                <NavbarSearch />
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
            <PWAInstallBanner />
            <AppUpdateManager />
            {children}
            <footer className="site-footer">
              <div className="site-footer-inner">
                <div className="site-footer-brand">
                  <BrandLogo variant="header" showText={false} />
                  <p>Official links, legal trailers, free licensed titles and OTT availability discovery.</p>
                </div>
                <nav aria-label="Footer">
                  <Link href="/about">About</Link>
                  <Link href="/contact">Contact</Link>
                  <Link href="/privacy-policy">Privacy Policy</Link>
                  <Link href="/terms">Terms</Link>
                  <Link href="/disclaimer">Disclaimer</Link>
                </nav>
              </div>
            </footer>
            <BottomNav />
          </div>
        </PWAInstallManager>
      </body>
    </html>
  );
}
