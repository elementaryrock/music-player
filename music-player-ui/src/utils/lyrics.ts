import type { Track } from "../types/api.types";

/** A single timestamped line from an LRC document. */
export interface SyncedLyricLine {
  id: string;
  time: number;
  text: string;
}

export type LyricsSource = "provided" | "lrclib";

export interface LyricsFetchResult {
  lines: SyncedLyricLine[];
  source: LyricsSource;
}

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
  const parsed: Array<{ time: number; text: string; order: number }> = [];

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

    const text = rawLine
      .replace(LRC_TIMESTAMP_PATTERN, "")
      .replace(/\[[^\]]+\]/g, "")
      .trim();

    if (!text) {
      return;
    }

    timestamps.forEach((time, timestampIndex) => {
      parsed.push({
        time,
        text,
        order: order + timestampIndex / 1000,
      });
    });
  });

  parsed.sort((left, right) => left.time - right.time || left.order - right.order);

  return parsed.map((line, index) => ({
    id: `lyric-${index}-${Math.round(line.time * 1000)}`,
    time: line.time,
    text: line.text,
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
