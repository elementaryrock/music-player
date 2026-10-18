import {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import type { Track } from "../../types/api.types";
import {
  fetchSyncedLyrics,
  getActiveLyricIndex,
  getLyricRevealProgress,
  splitLyricText,
  type LyricsSource,
  type LyricTextToken,
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

type LyricButtonStyle = CSSProperties & {
  "--lyric-progress"?: string;
};

const clampRevealProgress = (value: number): number =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const getWordRevealProgress = (
  line: SyncedLyricLine,
  wordIndex: number,
  wordCount: number,
  lineProgress: number,
  currentTime: number,
  reducedMotion: boolean,
): number => {
  if (reducedMotion) {
    return 1;
  }

  const word = line.words?.[wordIndex];
  const wordStart = word?.time ?? word?.startTime;
  const nextWordStart = line.words?.[wordIndex + 1]
    ? line.words[wordIndex + 1].time ?? line.words[wordIndex + 1].startTime
    : undefined;
  const wordEnd = word?.endTime ?? nextWordStart;

  if (
    typeof wordStart === "number" &&
    Number.isFinite(wordStart) &&
    typeof wordEnd === "number" &&
    Number.isFinite(wordEnd) &&
    wordEnd > wordStart
  ) {
    return clampRevealProgress((currentTime - wordStart) / (wordEnd - wordStart));
  }

  if (typeof wordStart === "number" && Number.isFinite(wordStart)) {
    return currentTime >= wordStart ? 1 : 0;
  }

  if (wordCount <= 0) {
    return clampRevealProgress(lineProgress);
  }

  const wordInterval = 1 / wordCount;
  return clampRevealProgress((lineProgress - wordIndex * wordInterval) / wordInterval);
};

const renderLyricText = (
  tokens: readonly LyricTextToken[],
  line: SyncedLyricLine,
  isActive: boolean,
  lineProgress: number,
  currentTime: number,
  reducedMotion: boolean,
) => {
  if (!isActive) {
    return line.text;
  }

  const wordCount = tokens.reduce(
    (count, token) => count + (token.kind === "word" ? 1 : 0),
    0,
  );
  let wordIndex = 0;

  return tokens.map((token, tokenIndex) => {
    if (token.kind === "whitespace") {
      return (
        <span aria-hidden="true" key={`${token.text}-${tokenIndex}`}>
          {token.text}
        </span>
      );
    }

    const wordProgress = getWordRevealProgress(
      line,
      wordIndex,
      wordCount,
      lineProgress,
      currentTime,
      reducedMotion,
    );
    wordIndex += 1;

    return (
      <span
        aria-hidden="true"
        className="apple-synced-lyrics__word"
        data-word-index={wordIndex - 1}
        key={`${token.text}-${tokenIndex}`}
        style={{
          "--word-progress": wordProgress,
          filter: `blur(${((1 - wordProgress) * 0.16).toFixed(3)}px)`,
          opacity: 0.34 + wordProgress * 0.66,
        } as CSSProperties & { "--word-progress": number }}
      >
        {token.text}
      </span>
    );
  });
};

interface SyncedLyricLineButtonProps {
  line: SyncedLyricLine;
  index: number;
  activeIndex: number;
  isActive: boolean;
  progress: number;
  currentTime: number;
  reducedMotion: boolean;
  onSeekTo?: (seconds: number) => void;
}

const SyncedLyricLineButton = memo(
  forwardRef<HTMLButtonElement, SyncedLyricLineButtonProps>(
    (
      {
        line,
        index,
        activeIndex,
        isActive,
        progress,
        currentTime,
        reducedMotion,
        onSeekTo,
      },
      ref,
    ) => {
      const tokens = useMemo(() => splitLyricText(line.text), [line.text]);
      const lineStyle: LyricButtonStyle | undefined = isActive
        ? { "--lyric-progress": `${progress * 100}%` }
        : undefined;
      const lineState = isActive
        ? "is-active"
        : index < activeIndex
          ? "is-past"
          : "is-upcoming";

      return (
        <button
          aria-current={isActive ? "true" : undefined}
          aria-label={line.text}
          className={`apple-synced-lyrics__line ${lineState}`}
          data-reveal-progress={isActive ? progress.toFixed(3) : undefined}
          onClick={() => onSeekTo?.(line.time)}
          ref={ref}
          style={lineStyle}
          type="button"
        >
          <span className="apple-synced-lyrics__line-text" aria-hidden="true">
            {renderLyricText(
              tokens,
              line,
              isActive,
              progress,
              currentTime,
              reducedMotion,
            )}
          </span>
        </button>
      );
    },
  ),
);

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

  const activeLineProgress = useMemo(
    () => getLyricRevealProgress(state.lines, activeLineIndex, currentTime, reducedMotion),
    [activeLineIndex, currentTime, reducedMotion, state.lines],
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
              <SyncedLyricLineButton
                activeIndex={activeLineIndex}
                currentTime={isActive ? currentTime : 0}
                index={index}
                isActive={isActive}
                key={line.id}
                line={line}
                onSeekTo={onSeekTo}
                progress={isActive ? activeLineProgress : 0}
                ref={isActive ? activeLineRef : undefined}
                reducedMotion={reducedMotion}
              />
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
