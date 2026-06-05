"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const GUEST_ID_KEY = "watchfinder_guest_id";
const LOCAL_FAVORITES_KEY = "watchfinder_guest_favorites";
const LOCAL_HISTORY_KEY = "watchfinder_guest_watch_history";
const RECORD_COOLDOWN_MS = 5000;

export type LibraryContent = {
  content_id?: string | null;
  content_slug: string;
  content_type?: string | null;
  title?: string | null;
  poster_url?: string | null;
  platform_name?: string | null;
  href?: string | null;
};

export type FavoriteRecord = Required<Pick<LibraryContent, "content_slug">> & {
  id: string;
  user_id?: string | null;
  guest_id?: string | null;
  content_id?: string | null;
  content_type: string;
  title?: string | null;
  poster_url?: string | null;
  href?: string | null;
  created_at?: string | null;
  source: "supabase" | "local";
};

export type WatchHistoryRecord = FavoriteRecord & {
  platform_name?: string | null;
  last_action?: string | null;
  progress_seconds: number;
  duration_seconds: number;
  watch_count: number;
  last_watched_at?: string | null;
  updated_at?: string | null;
};

type WatchProgress = {
  progress_seconds?: number;
  duration_seconds?: number;
  platform_name?: string | null;
};

const lastRecordAt = new Map<string, number>();

function nowIso() {
  return new Date().toISOString();
}

function isBrowser() {
  return typeof window !== "undefined";
}

function safeJsonArray<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local profile state is best-effort in restricted browsers.
  }
}

export function getGuestId() {
  if (!isBrowser()) return "";
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_ID_KEY, next);
    return next;
  } catch {
    return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function contentKey(content: Pick<LibraryContent, "content_slug" | "content_type">) {
  return `${content.content_type || "movie"}:${content.content_slug}`;
}

function normalizeType(value?: string | null) {
  return String(value || "movie").trim() || "movie";
}

function normalizeContent(content: LibraryContent): LibraryContent {
  return {
    content_id: content.content_id || null,
    content_slug: content.content_slug,
    content_type: normalizeType(content.content_type),
    title: content.title || content.content_slug,
    poster_url: content.poster_url || null,
    platform_name: content.platform_name || null,
    href: content.href || defaultContentHref(content)
  };
}

function defaultContentHref(content: Pick<LibraryContent, "content_slug" | "content_type">) {
  if (content.content_slug.startsWith("/")) return content.content_slug;
  if (content.content_slug.includes("/")) return `/${content.content_slug}`;
  const type = normalizeType(content.content_type);
  if (type === "web_series") return `/web-series/${content.content_slug}`;
  return `/movie/${content.content_slug}`;
}

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function analyticsMovieId(value?: string | null) {
  return isUuid(value) ? value : null;
}

async function currentUserId() {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function toFavoriteRecord(row: any, source: "supabase" | "local"): FavoriteRecord {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    guest_id: row.guest_id ?? null,
    content_id: row.content_id ?? null,
    content_slug: row.content_slug,
    content_type: normalizeType(row.content_type),
    title: row.title ?? row.content_slug,
    poster_url: row.poster_url ?? null,
    href: row.href ?? defaultContentHref(row),
    created_at: row.created_at ?? null,
    source
  };
}

function toHistoryRecord(row: any, source: "supabase" | "local"): WatchHistoryRecord {
  return {
    ...toFavoriteRecord(row, source),
    platform_name: row.platform_name ?? null,
    last_action: row.last_action ?? null,
    progress_seconds: Math.max(0, Number(row.progress_seconds || 0)),
    duration_seconds: Math.max(0, Number(row.duration_seconds || 0)),
    watch_count: Math.max(1, Number(row.watch_count || 1)),
    last_watched_at: row.last_watched_at ?? row.watched_at ?? row.created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

function localFavorites() {
  return safeJsonArray<FavoriteRecord>(LOCAL_FAVORITES_KEY).map((item) => toFavoriteRecord(item, "local"));
}

function localHistory() {
  return safeJsonArray<WatchHistoryRecord>(LOCAL_HISTORY_KEY).map((item) => toHistoryRecord(item, "local"));
}

async function getSupabaseFavorites(userId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => toFavoriteRecord(row, "supabase"));
}

async function getSupabaseHistory(userId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("watch_history")
    .select("*")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => toHistoryRecord(row, "supabase"));
}

export async function getFavorites() {
  const userId = await currentUserId();
  if (!userId) return localFavorites();

  try {
    return await getSupabaseFavorites(userId);
  } catch (error) {
    console.warn("Favorites Supabase read failed, using local fallback", error);
    return localFavorites();
  }
}

export async function isFavorite(content: LibraryContent) {
  const normalized = normalizeContent(content);
  const userId = await currentUserId();
  if (!userId) {
    return localFavorites().some((item) => contentKey(item) === contentKey(normalized));
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("content_slug", normalized.content_slug)
      .eq("content_type", normalized.content_type)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch {
    return localFavorites().some((item) => contentKey(item) === contentKey(normalized));
  }
}

export async function addFavorite(content: LibraryContent) {
  const normalized = normalizeContent(content);
  const userId = await currentUserId();
  const favoritePayload = {
    user_id: userId,
    guest_id: userId ? null : getGuestId(),
    content_id: isUuid(normalized.content_id) ? normalized.content_id : null,
    content_slug: normalized.content_slug,
    content_type: normalizeType(normalized.content_type),
    title: normalized.title,
    poster_url: normalized.poster_url
  };

  if (userId) {
    try {
      const supabase = createSupabaseBrowserClient();
      const existing = await supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("content_slug", normalized.content_slug)
        .eq("content_type", normalized.content_type)
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.id) return existing.data.id as string;

      const { data, error } = await supabase
        .from("user_favorites")
        .insert(favoritePayload)
        .select("id")
        .single();
      if (error) throw error;
      trackEvent({ event_type: "favorite_added", movie_id: analyticsMovieId(normalized.content_id), movie_slug: normalized.content_slug, metadata: { content_type: normalized.content_type } });
      return data?.id as string;
    } catch (error) {
      console.warn("Favorite Supabase save failed, using local fallback", error);
    }
  }

  const current = localFavorites();
  if (!current.some((item) => contentKey(item) === contentKey(normalized))) {
    current.unshift(toFavoriteRecord({ ...favoritePayload, id: `local-${Date.now()}`, created_at: nowIso() }, "local"));
    writeJsonArray(LOCAL_FAVORITES_KEY, current);
  }
  trackEvent({ event_type: "favorite_added", movie_id: analyticsMovieId(normalized.content_id), movie_slug: normalized.content_slug, metadata: { content_type: normalized.content_type, source: "local" } });
  return null;
}

export async function removeFavorite(content: LibraryContent | FavoriteRecord) {
  const normalized = normalizeContent(content);
  const userId = await currentUserId();

  if (userId) {
    try {
      const supabase = createSupabaseBrowserClient();
      const query = supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("content_slug", normalized.content_slug)
        .eq("content_type", normalized.content_type);
      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.warn("Favorite Supabase remove failed, also removing local fallback", error);
    }
  }

  const next = localFavorites().filter((item) => contentKey(item) !== contentKey(normalized));
  writeJsonArray(LOCAL_FAVORITES_KEY, next);
  trackEvent({ event_type: "favorite_removed", movie_id: analyticsMovieId(normalized.content_id), movie_slug: normalized.content_slug, metadata: { content_type: normalized.content_type } });
}

export async function toggleFavorite(content: LibraryContent) {
  if (await isFavorite(content)) {
    await removeFavorite(content);
    return false;
  }
  await addFavorite(content);
  return true;
}

export async function getWatchHistory() {
  const userId = await currentUserId();
  if (!userId) return localHistory();

  try {
    return await getSupabaseHistory(userId);
  } catch (error) {
    console.warn("Watch history Supabase read failed, using local fallback", error);
    return localHistory();
  }
}

export async function recordWatchHistory(content: LibraryContent, action = "detail_view", progress: WatchProgress = {}) {
  const normalized = normalizeContent(content);
  const key = `${contentKey(normalized)}:${action}`;
  const now = Date.now();
  if (lastRecordAt.has(key) && now - Number(lastRecordAt.get(key)) < RECORD_COOLDOWN_MS) return;
  lastRecordAt.set(key, now);

  const userId = await currentUserId();
  const watchedAt = nowIso();
  const basePayload = {
    user_id: userId,
    guest_id: userId ? null : getGuestId(),
    content_id: isUuid(normalized.content_id) ? normalized.content_id : null,
    movie_id: isUuid(normalized.content_id) && normalizeType(normalized.content_type) === "movie" ? normalized.content_id : null,
    content_slug: normalized.content_slug,
    content_type: normalizeType(normalized.content_type),
    title: normalized.title,
    poster_url: normalized.poster_url,
    platform_name: progress.platform_name ?? normalized.platform_name ?? null,
    last_action: action,
    progress_seconds: Math.max(0, Math.round(progress.progress_seconds || 0)),
    duration_seconds: Math.max(0, Math.round(progress.duration_seconds || 0)),
    last_watched_at: watchedAt,
    watched_at: watchedAt,
    updated_at: watchedAt
  };

  if (userId) {
    try {
      const supabase = createSupabaseBrowserClient();
      const existing = await supabase
        .from("watch_history")
        .select("id, watch_count")
        .eq("user_id", userId)
        .eq("content_slug", normalized.content_slug)
        .eq("content_type", normalized.content_type)
        .order("last_watched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;

      if (existing.data?.id) {
        const { error } = await supabase
          .from("watch_history")
          .update({
            ...basePayload,
            watch_count: Math.max(1, Number(existing.data.watch_count || 1) + 1)
          })
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("watch_history")
          .insert({
            ...basePayload,
            watch_count: 1,
            created_at: watchedAt
          });
        if (error) throw error;
      }

      trackEvent({ event_type: "history_recorded", movie_id: analyticsMovieId(normalized.content_id), movie_slug: normalized.content_slug, metadata: { action, content_type: normalized.content_type } });
      return;
    } catch (error) {
      console.warn("Watch history Supabase save failed, using local fallback", error);
    }
  }

  const current = localHistory();
  const existingIndex = current.findIndex((item) => contentKey(item) === contentKey(normalized));
  if (existingIndex >= 0) {
    current[existingIndex] = toHistoryRecord({
      ...current[existingIndex],
      ...basePayload,
      watch_count: current[existingIndex].watch_count + 1
    }, "local");
  } else {
    current.unshift(toHistoryRecord({
      ...basePayload,
      id: `local-${Date.now()}`,
      watch_count: 1,
      created_at: watchedAt
    }, "local"));
  }
  writeJsonArray(LOCAL_HISTORY_KEY, current.sort((left, right) => new Date(right.last_watched_at || 0).getTime() - new Date(left.last_watched_at || 0).getTime()));
  trackEvent({ event_type: "history_recorded", movie_id: analyticsMovieId(normalized.content_id), movie_slug: normalized.content_slug, metadata: { action, content_type: normalized.content_type, source: "local" } });
}

export async function removeHistoryItem(item: Pick<WatchHistoryRecord, "id" | "content_slug" | "content_type" | "source">) {
  const userId = await currentUserId();
  if (userId && item.source === "supabase") {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("watch_history").delete().eq("user_id", userId).eq("id", item.id);
      if (error) throw error;
    } catch (error) {
      console.warn("Watch history Supabase remove failed", error);
    }
  }

  const next = localHistory().filter((historyItem) => historyItem.id !== item.id && contentKey(historyItem) !== contentKey(item));
  writeJsonArray(LOCAL_HISTORY_KEY, next);
  trackEvent({ event_type: "history_removed", movie_slug: item.content_slug, metadata: { content_type: item.content_type } });
}

export async function clearWatchHistory() {
  const userId = await currentUserId();
  if (userId) {
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("watch_history").delete().eq("user_id", userId);
      if (error) throw error;
    } catch (error) {
      console.warn("Watch history Supabase clear failed", error);
    }
  }
  writeJsonArray(LOCAL_HISTORY_KEY, []);
  trackEvent({ event_type: "history_cleared" });
}

export function useFavorites(content?: LibraryContent | null) {
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await getFavorites();
    setFavorites(rows);
    if (content) setFavorite(rows.some((item) => contentKey(item) === contentKey(normalizeContent(content))));
    setLoading(false);
  }, [content]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async () => {
    if (!content) return false;
    setLoading(true);
    const next = await toggleFavorite(content);
    setFavorite(next);
    setMessage(next ? "Added to favorites" : "Removed from favorites");
    await refresh();
    setLoading(false);
    window.setTimeout(() => setMessage(null), 2200);
    return next;
  }, [content, refresh]);

  const remove = useCallback(async (item: FavoriteRecord) => {
    await removeFavorite(item);
    await refresh();
  }, [refresh]);

  return useMemo(() => ({ favorites, favorite, loading, message, refresh, toggle, remove }), [favorite, favorites, loading, message, refresh, remove, toggle]);
}

export function useWatchHistory() {
  const [history, setHistory] = useState<WatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await getWatchHistory();
    setHistory(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(async (item: WatchHistoryRecord) => {
    await removeHistoryItem(item);
    await refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    await clearWatchHistory();
    await refresh();
  }, [refresh]);

  return useMemo(() => ({ history, loading, refresh, remove, clear }), [clear, history, loading, refresh, remove]);
}
