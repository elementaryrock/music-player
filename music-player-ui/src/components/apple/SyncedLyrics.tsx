import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Track } from "../../types/api.types";
import {
  fetchSyncedLyrics,
  getActiveLyricIndex,
  type LyricsSource,
  type SyncedLyricLine,
} from "../../utils/lyrics";
import "./SyncedLyrics.css";

export interface SyncedLyricsProps {
  track: Track;
  currentTime: number;
  onSeekTo?: (seconds: number) => void;
  heading?: string;
  className?: string;
}

type LyricsViewState =
  | { status: "loading"; lines: readonly SyncedLyricLine[]; source?: LyricsSource }
  | { status: "ready"; lines: readonly SyncedLyricLine[]; source: LyricsSource }
  | { status: "empty"; lines: readonly SyncedLyricLine[] }
  | { status: "error"; lines: readonly SyncedLyricLine[]; message: string };

const initialState: LyricsViewState = { status: "loading", lines: [] };

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

const sourceLabel = (source: LyricsSource): string =>
  source === "provided" ? "Synced lyrics" : "LRCLIB";

export const SyncedLyrics = ({
  track,
  currentTime,
  onSeekTo,
  heading = "Lyrics",
  className = "",
}: SyncedLyricsProps) => {
  const [state, setState] = useState<LyricsViewState>(initialState);
  const [retryToken, setRetryToken] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setState({ status: "loading", lines: [] });

    void fetchSyncedLyrics(
      {
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        lrcUrl: track.lrcUrl,
      },
      controller.signal,
    )
      .then((result) => {
        if (disposed) {
          return;
        }

        if (result.lines.length === 0) {
          setState({ status: "empty", lines: [] });
          return;
        }

        setState({ status: "ready", lines: result.lines, source: result.source });
      })
      .catch((error: unknown) => {
        if (disposed || controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load lyrics";
        setState({
          status: "error",
          lines: [],
          message,
        });
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    retryToken,
    track.album,
    track.artist,
    track.duration,
    track.id,
    track.lrcUrl,
    track.title,
  ]);

  const activeLineIndex = useMemo(
    () => getActiveLyricIndex(state.lines, currentTime),
    [currentTime, state.lines],
  );

  useEffect(() => {
    if (activeLineIndex < 0 || !activeLineRef.current) {
      return;
    }

    activeLineRef.current.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [activeLineIndex, reducedMotion]);

  const rootClassName = ["apple-synced-lyrics", className].filter(Boolean).join(" ");

  return (
    <section className={rootClassName} aria-label={heading}>
      <div className="apple-synced-lyrics__header">
        <div>
          <p className="apple-synced-lyrics__eyebrow">Sing along</p>
          <h2>{heading}</h2>
        </div>
        {state.status === "ready" && (
          <span className="apple-synced-lyrics__source">{sourceLabel(state.source)}</span>
        )}
      </div>

      {state.status === "loading" && (
        <div className="apple-synced-lyrics__state" role="status" aria-live="polite">
          <span className="apple-synced-lyrics__spinner" aria-hidden="true" />
          <p>Finding synced lyrics…</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="apple-synced-lyrics__state" role="alert">
          <AppleLyricsGlyph />
          <p>Lyrics couldn’t load right now.</p>
          <span>{state.message}</span>
          <button type="button" onClick={() => setRetryToken((token) => token + 1)}>
            Try again
          </button>
        </div>
      )}

      {state.status === "empty" && (
        <div className="apple-synced-lyrics__state">
          <AppleLyricsGlyph />
          <p>No synced lyrics for this track.</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="apple-synced-lyrics__scroll" role="list" tabIndex={0}>
          {state.lines.map((line, index) => {
            const isActive = index === activeLineIndex;
            return (
              <button
                aria-current={isActive ? "true" : undefined}
                className={`apple-synced-lyrics__line${isActive ? " is-active" : ""}`}
                key={line.id}
                onClick={() => onSeekTo?.(line.time)}
                ref={isActive ? activeLineRef : undefined}
                type="button"
              >
                {line.text}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

const AppleLyricsGlyph = () => (
  <span className="apple-synced-lyrics__glyph" aria-hidden="true">
    ♪
  </span>
);

export default SyncedLyrics;
