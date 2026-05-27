"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCw,
  ScanLine,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { cx } from "@/lib/format";

export type YouTubeViewMode = "center" | "fit" | "fill";

type YouTubePlayerEvent = {
  target: YouTubePlayerInstance;
  data?: number;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVolume: () => number;
  isMuted: () => boolean;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onStateChange: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    }
  ) => YouTubePlayerInstance;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    __watchfinderYouTubeApiPromise?: Promise<void>;
  }
}

const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube player is only available in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (window.__watchfinderYouTubeApiPromise) {
    return window.__watchfinderYouTubeApiPromise;
  }

  window.__watchfinderYouTubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("error", () => reject(new Error("YouTube player API failed to load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = YOUTUBE_IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player API failed to load."));
    document.head.appendChild(script);
  });

  return window.__watchfinderYouTubeApiPromise;
}

export function getYouTubeVideoIdFromUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (!host.endsWith("youtube.com")) return null;

    const pathVideoId = parsed.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1];
    return parsed.searchParams.get("v") || pathVideoId || null;
  } catch {
    return null;
  }
}

function formatPlayerTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getModeLabel(mode: YouTubeViewMode) {
  if (mode === "center") return "Center";
  if (mode === "fit") return "Fit";
  return "Fill";
}

function getNextModeLabel(mode: YouTubeViewMode, isFullscreen: boolean) {
  if (mode === "center") return "Fit";
  if (mode === "fit") return "Fill";
  return isFullscreen ? "Center" : "Fullscreen";
}

export default function YouTubePremiumPlayer({
  src,
  title,
  mode,
  modeToast,
  fullscreenHint,
  isFullscreen,
  onClose,
  onCycleMode,
  onFullscreen
}: {
  src: string;
  title: string;
  mode: YouTubeViewMode;
  modeToast?: string | null;
  fullscreenHint?: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onCycleMode: () => void;
  onFullscreen: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const tapTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const [apiFailed, setApiFailed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [muted, setMuted] = useState(false);
  const [tapFeedback, setTapFeedback] = useState<string | null>(null);

  const videoId = useMemo(() => getYouTubeVideoIdFromUrl(src), [src]);
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const fallbackSrc = useMemo(() => {
    try {
      const parsed = new URL(src);
      parsed.searchParams.set("autoplay", "1");
      parsed.searchParams.set("playsinline", "1");
      parsed.searchParams.set("rel", "0");
      parsed.searchParams.set("modestbranding", "1");
      return parsed.toString();
    } catch {
      return src;
    }
  }, [src]);

  const showControls = useCallback((sticky = false) => {
    setControlsVisible(true);

    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }

    if (!sticky && playerRef.current?.getPlayerState() === window.YT?.PlayerState.PLAYING) {
      controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3200);
    }
  }, []);

  const flashTapFeedback = useCallback((label: string) => {
    setTapFeedback(label);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => setTapFeedback(null), 800);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player) return;

    const nextTime = Math.min(Math.max((player.getCurrentTime() || 0) + seconds, 0), player.getDuration() || Number.MAX_SAFE_INTEGER);
    player.seekTo(nextTime, true);
    setCurrentTime(nextTime);
    flashTapFeedback(seconds < 0 ? "10s back" : "10s forward");
    showControls();
  }, [flashTapFeedback, showControls]);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (playing) {
      player.pauseVideo();
      setPlaying(false);
      showControls(true);
      return;
    }

    player.playVideo();
    setPlaying(true);
    showControls();
  }, [playing, showControls]);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
    showControls();
  }, [showControls]);

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = Math.min(100, Math.max(0, nextVolume));
    playerRef.current?.setVolume(safeVolume);
    if (safeVolume > 0 && playerRef.current?.isMuted()) {
      playerRef.current.unMute();
      setMuted(false);
    }
    setVolumeState(safeVolume);
    showControls();
  }, [showControls]);

  const handleProgressChange = useCallback((value: number) => {
    const player = playerRef.current;
    if (!player) return;

    player.seekTo(value, true);
    setCurrentTime(value);
    showControls();
  }, [showControls]);

  const handleSurfacePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-player-control]")) return;

    const now = Date.now();
    const previous = lastTapRef.current;
    const isDoubleTap =
      previous &&
      now - previous.time < 300 &&
      Math.abs(previous.x - event.clientX) < 72 &&
      Math.abs(previous.y - event.clientY) < 72;

    if (isDoubleTap) {
      const rect = event.currentTarget.getBoundingClientRect();
      seekBy(event.clientX < rect.left + rect.width / 2 ? -10 : 10);
      lastTapRef.current = null;
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      return;
    }

    lastTapRef.current = { x: event.clientX, y: event.clientY, time: now };
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      setControlsVisible((visible) => !visible);
      lastTapRef.current = null;
    }, 260);
  }, [seekBy]);

  useEffect(() => {
    if (!videoId || !hostRef.current) {
      setApiFailed(true);
      return undefined;
    }

    let disposed = false;
    setApiFailed(false);
    setReady(false);

    loadYouTubeIframeApi()
      .then(() => {
        if (disposed || !hostRef.current || !window.YT?.Player) return;

        const player = new window.YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              setReady(true);
              setDuration(event.target.getDuration() || 0);
              setVolumeState(event.target.getVolume() || 80);
              setMuted(event.target.isMuted());
              event.target.playVideo();
              showControls();
            },
            onStateChange: (event) => {
              if (disposed || !window.YT) return;
              const state = event.data;
              const isPlaying = state === window.YT.PlayerState.PLAYING;
              setPlaying(isPlaying);
              if (state === window.YT.PlayerState.ENDED) {
                setCurrentTime(event.target.getDuration() || 0);
                showControls(true);
              } else {
                showControls(!isPlaying);
              }
            },
            onError: () => setApiFailed(true)
          }
        });

        playerRef.current = player;
      })
      .catch(() => setApiFailed(true));

    return () => {
      disposed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // YouTube cleanup is best effort.
      }
      playerRef.current = null;
    };
  }, [showControls, videoId]);

  useEffect(() => {
    if (!ready) return undefined;

    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime() || 0);
      setDuration(player.getDuration() || 0);
      setVolumeState(player.getVolume() || 0);
      setMuted(player.isMuted());
    }, 500);

    return () => window.clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  if (apiFailed || !videoId) {
    return (
      <div className="premium-youtube-player premium-youtube-fallback">
        <div className="premium-youtube-frame">
          <iframe
            className="trailer-modal-frame"
            src={fallbackSrc}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <button className="premium-control-button premium-fallback-close" type="button" onClick={onClose} aria-label="Close trailer">
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "premium-youtube-player",
        controlsVisible && "controls-visible",
        !ready && "is-loading"
      )}
      onPointerMove={() => showControls()}
      onPointerUp={handleSurfacePointerUp}
    >
      <div className="premium-youtube-stage" aria-label={`${title} video area`}>
        <div className="premium-youtube-frame">
          <div className="premium-youtube-host" ref={hostRef} />
        </div>
      </div>

      <div className="premium-player-vignette" aria-hidden="true" />

      {!ready ? (
        <div className="premium-player-loading" role="status">
          <span className="loader-dot" />
          Loading official video...
        </div>
      ) : null}

      <div className="premium-player-top premium-player-overlay" data-player-control>
        <button className="premium-control-button" type="button" onClick={onClose} aria-label="Close player">
          <X size={21} />
        </button>
        <div className="premium-player-title">
          <span>Now playing</span>
          <strong>{title}</strong>
        </div>
        <button
          className="premium-control-button"
          type="button"
          onClick={onFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      <button
        className="premium-center-play premium-player-overlay"
        data-player-control
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause video" : "Play video"}
      >
        {playing ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
      </button>

      {tapFeedback ? <div className="premium-tap-feedback">{tapFeedback}</div> : null}
      {modeToast ? <div className="premium-mode-toast">{modeToast}</div> : null}

      <div className="premium-player-bottom premium-player-overlay" data-player-control>
        <input
          className="premium-progress-range"
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => handleProgressChange(Number(event.target.value))}
          aria-label="Seek video"
          style={{ "--progress": `${progressPercent}%` } as CSSProperties}
        />
        <div className="premium-player-control-row">
          <button className="premium-control-button" type="button" onClick={togglePlay} aria-label={playing ? "Pause video" : "Play video"}>
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="premium-control-button" type="button" onClick={() => seekBy(-10)} aria-label="Rewind 10 seconds">
            <SkipBack size={19} />
          </button>
          <button className="premium-control-button" type="button" onClick={() => seekBy(10)} aria-label="Forward 10 seconds">
            <SkipForward size={19} />
          </button>
          <div className="premium-player-time" aria-label="Video time">
            {formatPlayerTime(currentTime)} / {formatPlayerTime(duration)}
          </div>
          <div className="premium-player-spacer" />
          <div className="premium-volume-control">
            <button className="premium-control-button" type="button" onClick={toggleMute} aria-label={muted ? "Unmute video" : "Mute video"}>
              {muted || volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <input
              className="premium-volume-range"
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
            />
          </div>
          <button className="premium-control-button premium-mode-cycle" type="button" onClick={onCycleMode} aria-label={`Switch from ${getModeLabel(mode)} mode to ${getNextModeLabel(mode, isFullscreen)} mode`}>
            <ScanLine size={18} />
            <span>{getModeLabel(mode)}</span>
          </button>
          <button className="premium-control-button" type="button" onClick={onFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
          </button>
        </div>
        <div className="premium-player-helper">
          <RotateCw size={14} />
          {fullscreenHint ? "Rotate your phone or tap fullscreen for best view." : "Tap once for controls. Double tap left or right to skip 10 seconds."}
        </div>
      </div>
    </div>
  );
}
