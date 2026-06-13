"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";

type ProviderStatus = {
  configured: boolean;
  connected: boolean | null;
  message: string;
  maskedKey?: string | null;
};

type ProviderResponse = {
  ok: boolean;
  providers?: {
    tmdb: ProviderStatus;
    omdb: ProviderStatus;
    youtube: ProviderStatus;
  };
  error?: string;
};

const initialProvider: ProviderStatus = {
  configured: false,
  connected: null,
  message: "Not checked yet."
};

function providerClass(status?: ProviderStatus) {
  if (status?.connected === true) return "metadata-provider-status connected";
  if (status?.connected === false) return "metadata-provider-status invalid";
  return "metadata-provider-status neutral";
}

function providerLabel(status?: ProviderStatus) {
  if (status?.connected === true) return "Connected";
  if (status?.connected === false) return status.message === "Invalid API Key" ? "Invalid API Key" : "Not connected";
  return "Not configured";
}

function ProviderBadge({ status }: { status?: ProviderStatus }) {
  const Icon = status?.connected === true ? CheckCircle2 : status?.connected === false ? XCircle : KeyRound;
  return (
    <span className={providerClass(status)}>
      <Icon size={15} />
      {providerLabel(status)}
    </span>
  );
}

export default function MetadataProviderSettings() {
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [omdbApiKey, setOmdbApiKey] = useState("");
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [providers, setProviders] = useState<Required<ProviderResponse>["providers"]>({
    tmdb: initialProvider,
    omdb: initialProvider,
    youtube: initialProvider
  });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/metadata-providers", { cache: "no-store" });
      const json = (await response.json()) as ProviderResponse;
      if (!response.ok || !json.ok || !json.providers) throw new Error(json.error || "Provider status failed.");
      setProviders(json.providers);
      setMessage(json.providers.tmdb.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider status failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/metadata-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbApiKey: tmdbApiKey.trim() || undefined,
          omdbApiKey: omdbApiKey.trim() || undefined,
          youtubeApiKey: youtubeApiKey.trim() || undefined
        })
      });
      const json = (await response.json()) as ProviderResponse;
      if (!response.ok || !json.ok || !json.providers) throw new Error(json.error || "Connection test failed.");
      setProviders(json.providers);
      setMessage(json.providers.tmdb.connected ? "Connected" : json.providers.tmdb.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  const tmdbReady = providers.tmdb.connected === true;

  return (
    <section className="section metadata-provider-panel">
      <div className="section-head">
        <div>
          <p className="rating-badge">Admin setup</p>
          <h2><KeyRound size={22} /> Metadata Providers</h2>
          <p className="muted">
            Configure metadata APIs for AI Auto Fill. TMDb is required; OMDb and YouTube are optional fallbacks.
          </p>
        </div>
        <ProviderBadge status={providers.tmdb} />
      </div>

      {message ? (
        <p className={tmdbReady ? "form-message success" : "form-message warning"}>
          {loading ? <Loader2 className="spin-icon" size={16} /> : null}
          {message}
        </p>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span>TMDb API Key</span>
          <input
            type="password"
            value={tmdbApiKey}
            onChange={(event) => setTmdbApiKey(event.target.value)}
            placeholder={providers.tmdb.maskedKey || "Paste TMDb API key to test"}
            autoComplete="off"
          />
          <small className="form-helper">Required. Add the real key to `TMDB_API_KEY` in your environment.</small>
        </label>

        <label className="field">
          <span>OMDb API Key (optional)</span>
          <input
            type="password"
            value={omdbApiKey}
            onChange={(event) => setOmdbApiKey(event.target.value)}
            placeholder={providers.omdb.maskedKey || "Optional fallback key"}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>YouTube API Key (optional)</span>
          <input
            type="password"
            value={youtubeApiKey}
            onChange={(event) => setYoutubeApiKey(event.target.value)}
            placeholder={providers.youtube.maskedKey || "Optional trailer search key"}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="metadata-provider-grid">
        <div className="panel metadata-provider-card">
          <strong>TMDb</strong>
          <ProviderBadge status={providers.tmdb} />
          <p className="muted">{providers.tmdb.message}</p>
        </div>
        <div className="panel metadata-provider-card">
          <strong>OMDb</strong>
          <ProviderBadge status={providers.omdb} />
          <p className="muted">{providers.omdb.message}</p>
        </div>
        <div className="panel metadata-provider-card">
          <strong>YouTube</strong>
          <ProviderBadge status={providers.youtube} />
          <p className="muted">{providers.youtube.message}</p>
        </div>
      </div>

      <div className="save-actions">
        <button className="button primary" type="button" onClick={testConnection} disabled={testing || loading}>
          {testing ? <Loader2 className="spin-icon" size={18} /> : <CheckCircle2 size={18} />}
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button className="button" type="button" onClick={loadStatus} disabled={testing || loading}>
          Recheck saved env
        </button>
      </div>

      <div className="notice-card metadata-provider-guide">
        <strong>Setup instructions</strong>
        <p>Add these variables to your local `.env.local` file or your hosting provider environment, then restart/redeploy WatchFinder:</p>
        <pre>{`TMDB_API_KEY=your_tmdb_api_key
OMDB_API_KEY=optional_omdb_key
YOUTUBE_API_KEY=optional_youtube_key`}</pre>
        <p className="muted">
          AI Auto Fill is disabled until TMDb shows Connected. If TMDb is missing, the exact error is: “TMDb API key is not configured.”
        </p>
      </div>
    </section>
  );
}
