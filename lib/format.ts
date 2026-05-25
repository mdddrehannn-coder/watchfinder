import type { MovieType } from "@/types/watchfinder";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function formatType(type?: string | null) {
  const map: Record<MovieType, string> = {
    movie: "Movie",
    tv_show: "TV Show",
    cartoon: "Cartoon",
    anime: "Anime",
    short_film: "Short Film"
  };
  return type && type in map ? map[type as MovieType] : type || "Title";
}

export function formatDuration(minutes?: number | null) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

export function getYouTubeEmbedUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (!host.endsWith("youtube.com")) return url;
    const pathVideoId = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
    const videoId = parsed.searchParams.get("v") || pathVideoId;
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  } catch {
    return url;
  }
}

export function isActiveWindow(start?: string | null, end?: string | null) {
  const now = Date.now();
  const startsOk = start ? new Date(start).getTime() <= now : true;
  const endsOk = end ? new Date(end).getTime() >= now : true;
  return startsOk && endsOk;
}
