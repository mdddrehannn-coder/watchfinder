"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Movie } from "@/types/watchfinder";

export type AnalyticsEventType =
  | "page_view"
  | "session_start"
  | "session_active"
  | "movie_view"
  | "trailer_play"
  | "trailer_pause"
  | "trailer_progress"
  | "trailer_complete"
  | "licensed_video_play"
  | "licensed_video_progress"
  | "licensed_video_complete"
  | "watch_link_click"
  | "search"
  | "app_install_prompt_shown"
  | "app_install_clicked"
  | "app_installed";

type AnalyticsPayload = {
  event_type: AnalyticsEventType;
  movie_id?: string | null;
  movie_slug?: string | null;
  page_path?: string | null;
  referrer?: string | null;
  search_query?: string | null;
  platform_name?: string | null;
  video_provider?: string | null;
  watch_seconds?: number | null;
  progress_percent?: number | null;
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = "watchfinder_anon_session_id";

export function getAnonymousSessionId() {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function getBrowserName() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/")) return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Other";
}

function warnAnalytics(error: unknown) {
  if (process.env.NODE_ENV === "development") console.warn("WatchFinder analytics failed", error);
}

async function currentUserId() {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function upsertAnalyticsSession(options: { pageView?: boolean; watchSeconds?: number } = {}) {
  try {
    const supabase = createSupabaseBrowserClient();
    const anonymous_session_id = getAnonymousSessionId();
    const user_id = await currentUserId();
    await supabase.rpc("record_analytics_session", {
      p_anonymous_session_id: anonymous_session_id,
      p_user_id: user_id,
      p_page_view_increment: options.pageView ? 1 : 0,
      p_watch_seconds_increment: Math.max(0, Math.round(options.watchSeconds || 0)),
      p_device_type: getDeviceType(),
      p_browser_name: getBrowserName()
    });
  } catch (error) {
    warnAnalytics(error);
  }
}

export async function trackEvent(payload: AnalyticsPayload) {
  try {
    const supabase = createSupabaseBrowserClient();
    const page_path = payload.page_path ?? (typeof window !== "undefined" ? window.location.pathname : null);
    const referrer = payload.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null);
    const anonymous_session_id = getAnonymousSessionId();
    const user_id = await currentUserId();

    await supabase.from("analytics_events").insert({
      event_type: payload.event_type,
      user_id,
      anonymous_session_id,
      movie_id: payload.movie_id ?? null,
      movie_slug: payload.movie_slug ?? null,
      page_path,
      referrer,
      search_query: payload.search_query ?? null,
      platform_name: payload.platform_name ?? null,
      video_provider: payload.video_provider ?? null,
      watch_seconds: Math.max(0, Math.round(payload.watch_seconds || 0)),
      progress_percent: payload.progress_percent == null ? null : Math.round(payload.progress_percent),
      device_type: getDeviceType(),
      browser_name: getBrowserName(),
      metadata: payload.metadata || {}
    });

    await upsertAnalyticsSession({
      pageView: payload.event_type === "page_view",
      watchSeconds: payload.watch_seconds || 0
    });
  } catch (error) {
    warnAnalytics(error);
  }
}

function cooldown(key: string, ms = 30000) {
  if (typeof sessionStorage === "undefined") return false;
  const now = Date.now();
  const previous = Number(sessionStorage.getItem(key) || 0);
  if (previous && now - previous < ms) return true;
  sessionStorage.setItem(key, String(now));
  return false;
}

export function trackPageView(path: string) {
  if (cooldown(`analytics_page_view_${path}`)) return;
  return trackEvent({ event_type: "page_view", page_path: path });
}

export function trackMovieView(movie: Pick<Movie, "id" | "slug">) {
  if (cooldown(`analytics_movie_view_${movie.id}`)) return;
  return trackEvent({ event_type: "movie_view", movie_id: movie.id, movie_slug: movie.slug });
}

export function trackSearch(query: string, metadata?: Record<string, unknown>) {
  const trimmed = query.trim();
  if (!trimmed || cooldown(`analytics_search_${trimmed.toLowerCase()}`, 5000)) return;
  return trackEvent({ event_type: "search", search_query: trimmed, metadata });
}

export function trackWatchLinkClick(movie: Pick<Movie, "id" | "slug">, platformName?: string | null) {
  return trackEvent({
    event_type: "watch_link_click",
    movie_id: movie.id,
    movie_slug: movie.slug,
    platform_name: platformName || null
  });
}

export function trackVideoPlay(movie: Pick<Movie, "id" | "slug">, provider?: string | null, licensed = false) {
  return trackEvent({
    event_type: licensed ? "licensed_video_play" : "trailer_play",
    movie_id: movie.id,
    movie_slug: movie.slug,
    video_provider: provider || null
  });
}

export function trackVideoProgress(
  movie: Pick<Movie, "id" | "slug">,
  provider: string | null | undefined,
  seconds: number,
  percent: number,
  licensed = false
) {
  return trackEvent({
    event_type: licensed ? "licensed_video_progress" : "trailer_progress",
    movie_id: movie.id,
    movie_slug: movie.slug,
    video_provider: provider || null,
    watch_seconds: seconds,
    progress_percent: percent
  });
}

export function trackVideoComplete(movie: Pick<Movie, "id" | "slug">, provider?: string | null, seconds = 0, licensed = false) {
  return trackEvent({
    event_type: licensed ? "licensed_video_complete" : "trailer_complete",
    movie_id: movie.id,
    movie_slug: movie.slug,
    video_provider: provider || null,
    watch_seconds: seconds,
    progress_percent: 100
  });
}
