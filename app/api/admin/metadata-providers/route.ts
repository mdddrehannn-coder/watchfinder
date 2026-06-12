import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/data";

type ProviderStatus = {
  configured: boolean;
  connected: boolean | null;
  message: string;
  maskedKey?: string | null;
};

type ProviderStatusResponse = {
  ok: boolean;
  providers: {
    tmdb: ProviderStatus;
    omdb: ProviderStatus;
    youtube: ProviderStatus;
  };
};

const TMDB_MISSING_MESSAGE = "TMDb API key is not configured.";

function maskKey(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean) return null;
  if (clean.length <= 8) return "••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

async function requireAdmin() {
  const { isAdmin } = await requireAdminProfile();
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }
  return null;
}

async function testTmdb(apiKey?: string | null): Promise<ProviderStatus> {
  const key = String(apiKey || process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "").trim();
  const token = !apiKey ? String(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_READ_ACCESS_TOKEN || "").trim() : "";

  if (!key && !token) {
    return {
      configured: false,
      connected: false,
      message: TMDB_MISSING_MESSAGE
    };
  }

  try {
    const url = new URL("https://api.themoviedb.org/3/configuration");
    if (key) url.searchParams.set("api_key", key);
    const response = await fetch(url, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (response.status === 401 || response.status === 403) {
      return {
        configured: true,
        connected: false,
        message: "Invalid API Key",
        maskedKey: maskKey(key || token)
      };
    }

    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        message: `TMDb connection failed (${response.status}).`,
        maskedKey: maskKey(key || token)
      };
    }

    return {
      configured: true,
      connected: true,
      message: "Connected",
      maskedKey: maskKey(key || token)
    };
  } catch {
    return {
      configured: true,
      connected: false,
      message: "TMDb connection failed. Check network access and try again.",
      maskedKey: maskKey(key || token)
    };
  }
}

async function testOmdb(apiKey?: string | null): Promise<ProviderStatus> {
  const key = String(apiKey || process.env.OMDB_API_KEY || "").trim();
  if (!key) {
    return {
      configured: false,
      connected: null,
      message: "OMDb API key is optional and not configured."
    };
  }

  try {
    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("apikey", key);
    url.searchParams.set("s", "matrix");
    const response = await fetch(url, { cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    if (!response.ok || data?.Response === "False") {
      return {
        configured: true,
        connected: false,
        message: "Invalid API Key",
        maskedKey: maskKey(key)
      };
    }
    return {
      configured: true,
      connected: true,
      message: "Connected",
      maskedKey: maskKey(key)
    };
  } catch {
    return {
      configured: true,
      connected: false,
      message: "OMDb connection failed. Check network access and try again.",
      maskedKey: maskKey(key)
    };
  }
}

async function testYouTube(apiKey?: string | null): Promise<ProviderStatus> {
  const key = String(apiKey || process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) {
    return {
      configured: false,
      connected: null,
      message: "YouTube API key is optional and not configured."
    };
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "id");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("q", "official trailer");
    url.searchParams.set("key", key);
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return {
        configured: true,
        connected: false,
        message: "Invalid API Key",
        maskedKey: maskKey(key)
      };
    }
    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        message: `YouTube connection failed (${response.status}).`,
        maskedKey: maskKey(key)
      };
    }
    return {
      configured: true,
      connected: true,
      message: "Connected",
      maskedKey: maskKey(key)
    };
  } catch {
    return {
      configured: true,
      connected: false,
      message: "YouTube connection failed. Check network access and try again.",
      maskedKey: maskKey(key)
    };
  }
}

async function buildStatus(keys?: { tmdbApiKey?: string; omdbApiKey?: string; youtubeApiKey?: string }): Promise<ProviderStatusResponse> {
  const [tmdb, omdb, youtube] = await Promise.all([
    testTmdb(keys?.tmdbApiKey),
    testOmdb(keys?.omdbApiKey),
    testYouTube(keys?.youtubeApiKey)
  ]);

  return {
    ok: true,
    providers: {
      tmdb,
      omdb,
      youtube
    }
  };
}

export async function GET() {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  return NextResponse.json(await buildStatus());
}

export async function POST(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await buildStatus({
    tmdbApiKey: body.tmdbApiKey,
    omdbApiKey: body.omdbApiKey,
    youtubeApiKey: body.youtubeApiKey
  }));
}
