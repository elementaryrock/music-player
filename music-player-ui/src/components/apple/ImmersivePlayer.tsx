import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { Track } from "../../types/api.types";
import {
  extractArtworkPalette,
  getDeterministicPalette,
  type AmbientPalette,
} from "../../utils/ambientPalette";
import { formatTime } from "../../utils/lyrics";
import { AppleIcon, type AppleIconName } from "./AppleIcon";
import { SyncedLyrics } from "./SyncedLyrics";
import "./ImmersivePlayer.css";

export interface ImmersivePlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeek?: (event: ChangeEvent<HTMLInputElement>) => void;
  onSeekTo?: (seconds: number) => void;
  onToggleLike: (nextLiked: boolean) => void;
  onMore?: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  /** Mounting controls visibility without requiring a parent to unmount it. */
  open?: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const usePrefersReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  return reducedMotion;
};

const getPaletteStyle = (palette: AmbientPalette): CSSProperties =>
  ({
    "--apple-ambient-primary": palette.primary,
    "--apple-ambient-secondary": palette.secondary,
    "--apple-ambient-accent": palette.accent,
  }) as CSSProperties;

const getRangeStyle = (percent: number): CSSProperties =>
  ({ "--range-progress": `${clamp(percent, 0, 100)}%` }) as CSSProperties;

const sourceName = (track: Track): string | undefined => {
  const source = track.streamResolution?.source ?? track.metadataSource ?? track.source;
  if (!source) {
    return undefined;
  }

  if (source === "jiosaavn") {
    return "JioSaavn";
  }

  return source === "itunes" ? "iTunes" : source.charAt(0).toUpperCase() + source.slice(1);
};

const qualityName = (track: Track): string | undefined => {
  if (track.streamResolution?.qualityLabel) {
    return track.streamResolution.qualityLabel;
  }

  if (track.streamQuality) {
    const labels: Record<NonNullable<Track["streamQuality"]>, string> = {
      "hi-res": "Hi-Res",
      lossless: "Lossless",
      high: "High Quality",
      standard: "Standard",
    };
    return labels[track.streamQuality];
  }

  const firstQuality = track.qualityUrls ? Object.keys(track.qualityUrls)[0] : undefined;
  return firstQuality ? firstQuality.replace(/[-_]/g, " ") : undefined;
};

const metadataLabel = (track: Track): string | undefined => {
  const source = sourceName(track);
  const quality = qualityName(track);
  if (source && quality) {
    return `${source} · ${quality}`;
  }
  return source ?? quality;
};

const volumeIcon = (volume: number): AppleIconName => {
  if (volume <= 0.01) {
    return "volume-x";
  }
  return volume < 0.5 ? "volume-1" : "volume-2";
};

export const ImmersivePlayer = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  onClose,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onSeekTo,
  onToggleLike,
  onMore,
  volume: controlledVolume,
  onVolumeChange,
  open = true,
}: ImmersivePlayerProps) => {
  const [localVolume, setLocalVolume] = useState(controlledVolume ?? 0.72);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [ambientPalette, setAmbientPalette] = useState<AmbientPalette>(() =>
    getDeterministicPalette(`${track.id}-${track.title}`),
  );
  const [incomingPalette, setIncomingPalette] = useState<AmbientPalette | null>(null);
  const [isIncomingVisible, setIsIncomingVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const effectiveVolume = clamp(controlledVolume ?? localVolume, 0, 1);
  const effectiveDuration = Number.isFinite(duration)
    ? Math.max(0, duration)
    : Math.max(0, track.duration ?? 0);
  const effectiveCurrentTime = clamp(
    Number.isFinite(currentTime) ? currentTime : 0,
    0,
    effectiveDuration || Number.MAX_SAFE_INTEGER,
  );
  const trackMetadata = useMemo(() => metadataLabel(track), [track]);
  const ambientSeed = `${track.id}-${track.title}-${track.artist}`;
  const ambientStyle = getPaletteStyle(ambientPalette);
  const incomingStyle = incomingPalette ? getPaletteStyle(incomingPalette) : undefined;
  const progressPercent = effectiveDuration > 0
    ? (effectiveCurrentTime / effectiveDuration) * 100
    : 0;

  useEffect(() => {
    setArtworkFailed(false);
    setShowDetails(false);
  }, [track.albumArtUrl, track.id]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    let disposed = false;
    let fadeFrame: number | undefined;
    let fadeTimer: number | undefined;

    void extractArtworkPalette(track.albumArtUrl, ambientSeed).then((nextPalette) => {
      if (disposed) {
        return;
      }

      if (reducedMotion) {
        setAmbientPalette(nextPalette);
        setIncomingPalette(null);
        setIsIncomingVisible(false);
        return;
      }

      setIncomingPalette(nextPalette);
      setIsIncomingVisible(false);
      fadeFrame = window.setTimeout(() => setIsIncomingVisible(true), 0);
      fadeTimer = window.setTimeout(() => {
        setAmbientPalette(nextPalette);
        setIncomingPalette(null);
        setIsIncomingVisible(false);
      }, 720);
    });

    return () => {
      disposed = true;
      if (fadeFrame !== undefined) {
        window.clearTimeout(fadeFrame);
      }
      if (fadeTimer !== undefined) {
        window.clearTimeout(fadeTimer);
      }
    };
  }, [ambientSeed, reducedMotion, track.albumArtUrl]);

  const handleProgressChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSeek?.(event);
    if (!onSeek) {
      onSeekTo?.(Number(event.target.value));
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = clamp(Number(event.target.value), 0, 1);
    setLocalVolume(nextVolume);
    onVolumeChange?.(nextVolume);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="apple-immersive-player" role="dialog" aria-modal="true" aria-label="Now playing">
      <div className="apple-immersive-player__ambient" style={ambientStyle} aria-hidden="true" />
      {incomingPalette && (
        <div
          aria-hidden="true"
          className={`apple-immersive-player__ambient apple-immersive-player__ambient--incoming${
            isIncomingVisible ? " is-visible" : ""
          }`}
          style={incomingStyle}
        />
      )}
      <div className="apple-immersive-player__grain" aria-hidden="true" />

      <div className="apple-immersive-player__shell">
        <header className="apple-immersive-player__topbar">
          <button
            aria-label="Close now playing"
            className="apple-immersive-player__icon-button"
            onClick={onClose}
            type="button"
          >
            <AppleIcon name="arrow-left" size={20} />
            <span className="apple-immersive-player__icon-button-label">Back</span>
          </button>
          <div className="apple-immersive-player__topbar-label">
            <span>Now playing</span>
            {trackMetadata && <small>{trackMetadata}</small>}
          </div>
          <span className="apple-immersive-player__topbar-spacer" aria-hidden="true" />
        </header>

        <main className="apple-immersive-player__content">
          <section className="apple-immersive-player__main-column" aria-label="Track controls">
            <div className="apple-immersive-player__artwork-wrap">
              {track.albumArtUrl && !artworkFailed ? (
                <img
                  alt={`Album artwork for ${track.title}`}
                  className="apple-immersive-player__artwork"
                  onError={() => setArtworkFailed(true)}
                  src={track.albumArtUrl}
                />
              ) : (
                <div className="apple-immersive-player__artwork-fallback" aria-label="No album artwork">
                  <AppleIcon name="music" size={68} strokeWidth={1.25} />
                </div>
              )}
              <div className="apple-immersive-player__artwork-shine" aria-hidden="true" />
            </div>

            <div className="apple-immersive-player__identity">
              <div className="apple-immersive-player__identity-copy">
                <h1>{track.title}</h1>
                <p>{track.artist}</p>
                {(track.album || track.year) && (
                  <span>
                    {[track.album, track.year].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <div className="apple-immersive-player__actions">
                <button
                  aria-label={isLiked ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={isLiked}
                  className={`apple-immersive-player__round-button${isLiked ? " is-liked" : ""}`}
                  onClick={() => onToggleLike(!isLiked)}
                  type="button"
                >
                  <AppleIcon name="heart" size={22} filled={isLiked} />
                </button>
                <button
                  aria-expanded={showDetails}
                  aria-label="More track details"
                  className="apple-immersive-player__round-button"
                  onClick={() => {
                    onMore?.();
                    setShowDetails((visible) => !visible);
                  }}
                  type="button"
                >
                  <AppleIcon name="more" size={22} />
                </button>
              </div>
            </div>

            {showDetails && (
              <div className="apple-immersive-player__details" role="status">
                {trackMetadata && <span>{trackMetadata}</span>}
                {track.isrc && <span>ISRC · {track.isrc}</span>}
                {track.explicit && <span>Explicit</span>}
              </div>
            )}

            <div className="apple-immersive-player__progress">
              <input
                aria-label="Track progress"
                className="apple-immersive-player__range"
                max={effectiveDuration || 0}
                min="0"
                onChange={handleProgressChange}
                step="0.1"
                style={getRangeStyle(progressPercent)}
                type="range"
                value={effectiveCurrentTime}
              />
              <div className="apple-immersive-player__time-row">
                <span>{formatTime(effectiveCurrentTime)}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>
            </div>

            <div className="apple-immersive-player__transport" aria-label="Playback controls">
              <button
                aria-label="Previous track"
                className="apple-immersive-player__transport-button"
                disabled={!onPrev}
                onClick={onPrev}
                type="button"
              >
                <AppleIcon name="skip-back" size={24} />
              </button>
              <button
                aria-label={isPlaying ? "Pause" : "Play"}
                className="apple-immersive-player__play-button"
                onClick={onPlayPause}
                type="button"
              >
                <AppleIcon name={isPlaying ? "pause" : "play"} size={27} strokeWidth={1.7} />
              </button>
              <button
                aria-label="Next track"
                className="apple-immersive-player__transport-button"
                disabled={!onNext}
                onClick={onNext}
                type="button"
              >
                <AppleIcon name="skip-forward" size={24} />
              </button>
            </div>

            <div className="apple-immersive-player__volume">
              <AppleIcon name={volumeIcon(effectiveVolume)} size={17} />
              <input
                aria-label="Volume"
                className="apple-immersive-player__range apple-immersive-player__range--volume"
                max="1"
                min="0"
                onChange={handleVolumeChange}
                step="0.01"
                style={getRangeStyle(effectiveVolume * 100)}
                type="range"
                value={effectiveVolume}
              />
              <span>{Math.round(effectiveVolume * 100)}%</span>
            </div>
          </section>

          <SyncedLyrics
            className="apple-immersive-player__lyrics"
            currentTime={effectiveCurrentTime}
            onSeekTo={onSeekTo}
            track={track}
          />
        </main>
      </div>
    </div>
  );
};

export default ImmersivePlayer;
