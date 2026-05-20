import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WatchFinder",
    short_name: "WatchFinder",
    description: "Find Movies, Web Series and OTT Updates in One Place",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090a0f",
    theme_color: "#090a0f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
