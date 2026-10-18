import type { Track } from "../types/api.types";

/** A single timestamped line from an LRC document. */
export interface SyncedLyricWord {
  /** The word text, kept separate so a future word-synced source can be used. */
  text: string;
  /** Absolute playback time at which this word starts. */
  time?: number;
  /** Alias accepted by word-synced providers that call the start timestamp this. */
  startTime?: number;
  /** Absolute playback time at which this word ends, when the source provides it. */
  endTime?: number;
}

export interface SyncedLyricLine {
  id: string;
  time: number;
  text: string;
  /** Optional enhanced-LRC/provider word timings. Basic LRC lines omit this. */
  words?: readonly SyncedLyricWord[];
}

export type LyricTextToken =
  | { kind: "word"; text: string }
  | { kind: "whitespace"; text: string };

export type LyricsSource = "provided" | "lrclib";

export interface LyricsFetchResult {
  lines: SyncedLyricLine[];
  source: LyricsSource;
}

/**
 * Split a lyric without losing whitespace or punctuation. Word spans use the
 * non-whitespace tokens while whitespace tokens keep the original line's
 * wrapping and readable spacing intact.
 */
export const splitLyricText = (text: string): LyricTextToken[] =>
  (text.match(/\s+|[^\s]+/gu) ?? []).map((token) => ({
    kind: /^\s+$/u.test(token) ? "whitespace" : "word",
    text: token,
  } as LyricTextToken));

/**
 * An error raised when a lyrics request could not be completed. A missing
 * document is represented by an empty result instead, so the UI can
 * distinguish "no lyrics" from a transient network failure.
 */
export class LyricsFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "LyricsFetchError";

    if (options && "cause" in options) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: false,
      });
    }
  }
}

const LRC_TIMESTAMP_PATTERN = /\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TIMESTAMP_PATTERN = /<(\d+):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const parseFraction = (fraction: string | undefined): number => {
  if (!fraction) {
    return 0;
  }

  const value = Number(fraction);
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (fraction.length === 1) {
    return value / 10;
  }

  if (fraction.length === 2) {
    return value / 100;
  }

  return value / 1000;
};

const parseOffset = (lrc: string): number => {
  const offsetMatch = lrc.match(/^\s*\[offset:([+-]?\d+)\]\s*$/im);
  if (!offsetMatch) {
    return 0;
  }

  const offsetMilliseconds = Number(offsetMatch[1]);
  return Number.isFinite(offsetMilliseconds) ? offsetMilliseconds / 1000 : 0;
};

const parseTimestampParts = (
  minutesText: string,
  secondsText: string,
  fractionText: string | undefined,
): number => {
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
    return Number.NaN;
  }

  return minutes * 60 + seconds + parseFraction(fractionText);
};

interface ParsedWordLine {
  text: string;
  words?: SyncedLyricWord[];
}

/**
 * Read optional enhanced-LRC word markers such as
 * `[00:12.00]<00:12.00>Hello <00:12.42>world`.
 *
 * Plain LRC remains the common path and returns no word metadata. Keeping the
 * markers optional lets provider data grow into word sync without changing the
 * line model or making a basic document fail to parse.
 */
const parseWordTimings = (line: string, offset: number): ParsedWordLine => {
  const markers: Array<{ start: number; end: number; time: number }> = [];
  WORD_TIMESTAMP_PATTERN.lastIndex = 0;

  let marker: RegExpExecArray | null;
  while ((marker = WORD_TIMESTAMP_PATTERN.exec(line)) !== null) {
    const time = parseTimestampParts(marker[1], marker[2], marker[3]);
    if (Number.isFinite(time)) {
      markers.push({
        start: marker.index,
        end: marker.index + marker[0].length,
        time: Math.max(0, time + offset),
      });
    }
  }

  const text = line.replace(WORD_TIMESTAMP_PATTERN, "").trim();
  if (markers.length === 0) {
    return { text };
  }

  const words: SyncedLyricWord[] = [];
  markers.forEach((currentMarker, index) => {
    const nextMarker = markers[index + 1];
    const markerText = line.slice(
      currentMarker.end,
      nextMarker?.start ?? line.length,
    );
    const wordText = markerText.trim();
    if (!wordText) {
      return;
    }

    const nextTime = nextMarker?.time;
    words.push({
      text: wordText,
      time: currentMarker.time,
      ...(typeof nextTime === "number" && nextTime > currentMarker.time
        ? { endTime: nextTime }
        : {}),
    });
  });

  return { text, words: words.length > 0 ? words : undefined };
};

/**
 * Parse LRC timestamps into sorted, clickable lyric lines.
 *
 * The parser accepts both centisecond and millisecond timestamps, repeated
 * timestamps on one line, and common metadata tags such as [ti] or [ar].
 */
export const parseLrc = (lrc: string): SyncedLyricLine[] => {
  if (!lrc.trim()) {
    return [];
  }

  const offset = parseOffset(lrc);
  const parsed: Array<{
    time: number;
    text: string;
    words?: readonly SyncedLyricWord[];
    order: number;
  }> = [];

  lrc.split(/\r?\n/).forEach((rawLine, order) => {
    const timestamps: number[] = [];
    let timestampMatch: RegExpExecArray | null;

    LRC_TIMESTAMP_PATTERN.lastIndex = 0;
    while ((timestampMatch = LRC_TIMESTAMP_PATTERN.exec(rawLine)) !== null) {
      const minutes = Number(timestampMatch[1]);
      const seconds = Number(timestampMatch[2]);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) {
        continue;
      }

      timestamps.push(
        Math.max(0, minutes * 60 + seconds + parseFraction(timestampMatch[3]) + offset),
      );
    }

    if (timestamps.length === 0) {
      return;
    }

    const lineWithBracketTagsRemoved = rawLine
      .replace(LRC_TIMESTAMP_PATTERN, "")
      .replace(/\[[^\]]+\]/g, "");
    const parsedWords = parseWordTimings(lineWithBracketTagsRemoved, offset);
    const text = parsedWords.text;

    if (!text) {
      return;
    }

    timestamps.forEach((time, timestampIndex) => {
      parsed.push({
        time,
        text,
        words: parsedWords.words,
        order: order + timestampIndex / 1000,
      });
    });
  });

  parsed.sort((left, right) => left.time - right.time || left.order - right.order);

  return parsed.map((line, index) => ({
    id: `lyric-${index}-${Math.round(line.time * 1000)}`,
    time: line.time,
    text: line.text,
    ...(line.words ? { words: line.words } : {}),
  }));
};

/** Return the last line whose timestamp has been reached. */
export const getActiveLyricIndex = (
  lines: readonly SyncedLyricLine[],
  currentTime: number,
): number => {
  if (lines.length === 0 || !Number.isFinite(currentTime)) {
    return -1;
  }

  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].time <= currentTime + 0.04) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
};

const MIN_ESTIMATED_LINE_DURATION = 1.6;
const MAX_ESTIMATED_LINE_DURATION = 8;

const estimateLyricDuration = (text: string): number => {
  const wordCount = text.trim() ? text.trim().split(/\s+/u).length : 1;
  return clamp(
    0.8 + wordCount * 0.38,
    MIN_ESTIMATED_LINE_DURATION,
    MAX_ESTIMATED_LINE_DURATION,
  );
};

const getLineDuration = (
  lines: readonly SyncedLyricLine[],
  activeIndex: number,
): number => {
  const line = lines[activeIndex];
  if (!line) {
    return MIN_ESTIMATED_LINE_DURATION;
  }

  const nextTime = lines[activeIndex + 1]?.time;
  if (typeof nextTime === "number" && Number.isFinite(nextTime) && nextTime > line.time) {
    return nextTime - line.time;
  }

  const wordEndTimes = (line.words ?? [])
    .map((word) => word.endTime)
    .filter((endTime): endTime is number =>
      typeof endTime === "number" && Number.isFinite(endTime) && endTime > line.time,
    );
  const lastWordEnd = wordEndTimes[wordEndTimes.length - 1];
  if (typeof lastWordEnd === "number") {
    return Math.max(MIN_ESTIMATED_LINE_DURATION, lastWordEnd - line.time);
  }

  return estimateLyricDuration(line.text);
};

/**
 * Return the current line's left-to-right reveal amount in the stable range
 * `0..1`. Basic LRC only has line timestamps, so words share the interval
 * between this line and the next one. The final line receives a bounded
 * duration estimate. Reduced motion makes the current line fully revealed
 * immediately rather than animating it.
 */
export const getLyricRevealProgress = (
  lines: readonly SyncedLyricLine[],
  activeIndex: number,
  currentTime: number,
  reducedMotion = false,
): number => {
  if (activeIndex < 0 || activeIndex >= lines.length || !Number.isFinite(currentTime)) {
    return 0;
  }

  if (reducedMotion) {
    return 1;
  }

  const line = lines[activeIndex];
  if (!line || !Number.isFinite(line.time)) {
    return 0;
  }

  const duration = getLineDuration(lines, activeIndex);
  if (!Number.isFinite(duration) || duration <= 0) {
    return currentTime >= line.time ? 1 : 0;
  }

  return clamp((currentTime - line.time) / duration);
};

const isAbortError = (error: unknown): boolean =>
  (typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError") ||
  (error instanceof Error && error.name === "AbortError");

const readLrcUrl = async (url: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Lyrics source returned ${response.status}`);
  }

  return response.text();
};

interface LrclibResponse {
  syncedLyrics?: unknown;
}

const fetchFromLrclib = async (
  track: Pick<Track, "title" | "artist" | "album" | "duration">,
  signal: AbortSignal,
): Promise<LyricsFetchResult> => {
  const params = new URLSearchParams({
    artist_name: track.artist,
    track_name: track.title,
  });

  if (track.album) {
    params.set("album_name", track.album);
  }

  if (typeof track.duration === "number" && Number.isFinite(track.duration) && track.duration > 0) {
    params.set("duration", String(Math.round(track.duration)));
  }

  let response: Response;
  try {
    response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new LyricsFetchError("Unable to reach LRCLIB", { cause: error });
  }

  if (response.status === 404) {
    return { lines: [], source: "lrclib" };
  }

  if (!response.ok) {
    throw new LyricsFetchError(`LRCLIB returned ${response.status}`);
  }

  let payload: LrclibResponse;
  try {
    payload = (await response.json()) as LrclibResponse;
  } catch (error) {
    throw new LyricsFetchError("LRCLIB returned invalid lyrics data", { cause: error });
  }

  const syncedLyrics = typeof payload.syncedLyrics === "string" ? payload.syncedLyrics : "";
  return {
    lines: parseLrc(syncedLyrics),
    source: "lrclib",
  };
};

/**
 * Load lyrics from the track's existing source first, then ask LRCLIB. The
 * caller owns the AbortController so a track change can cancel stale work.
 */
export const fetchSyncedLyrics = async (
  track: Pick<Track, "title" | "artist" | "album" | "duration" | "lrcUrl">,
  signal: AbortSignal,
): Promise<LyricsFetchResult> => {
  if (track.lrcUrl) {
    try {
      const lines = parseLrc(await readLrcUrl(track.lrcUrl, signal));
      if (lines.length > 0) {
        return { lines, source: "provided" };
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      // A provider URL can be stale. LRCLIB remains a useful fallback.
    }
  }

  return fetchFromLrclib(track, signal);
};

export const formatTime = (timeInSeconds: number): string => {
  if (!Number.isFinite(timeInSeconds) || timeInSeconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(timeInSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};
