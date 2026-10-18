/**
 * Public iTunes Search API adapter.
 *
 * iTunes is used for global metadata discovery only. It does not provide a
 * playable full-track URL, so full stream resolution remains the responsibility
 * of trackResolver.ts.
 */

import type {
  ProviderMetadata,
  UnifiedTrackMetadata,
} from "../types/discovery.types";

export const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

export interface ITunesSong {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl30?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  trackExplicitness?: string;
  explicitness?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  isStreamable?: boolean;
  releaseDate?: string;
  primaryGenreName?: string;
  country?: string;
  kind?: string;
  /** Some mirrors expose an ISRC even though Apple's public response often does not. */
  isrc?: string;
  ISRC?: string;
  externalIds?: {
    isrc?: string;
    isrcs?: string[];
  };
  trackPopularity?: number;
  popularity?: number;
  [key: string]: unknown;
}

export interface ITunesSearchResponse {
  resultCount?: number;
  results?: unknown[];
}

export interface ITunesSearchOptions {
  limit?: number;
  country?: string;
  language?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Dependency injection keeps adapter tests entirely offline. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_LIMIT = 25;
const DEFAULT_TIMEOUT_MS = 7000;

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeIsrc = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || undefined;
};

export const getITunesIsrc = (song: ITunesSong): string | undefined =>
  normalizeIsrc(
    song.isrc ??
      song.ISRC ??
      song.externalIds?.isrc ??
      song.externalIds?.isrcs?.[0]
  );

/** Upgrade Apple's small artwork URLs without changing unrelated URLs. */
export const upgradeITunesArtworkUrl = (url?: string): string | undefined => {
  if (!url || typeof url !== "string") return undefined;

  return url
    .replace(/\/\d+x\d+(?=bb\.)/i, "/1000x1000")
    .replace(/\/\d+x\d+(?=\.(?:jpg|jpeg|png)(?:$|\?))/i, "/1000x1000");
};

const isExplicit = (song: ITunesSong): boolean | undefined => {
  const value = song.trackExplicitness ?? song.explicitness;
  if (typeof value !== "string") return undefined;
  if (value.toLowerCase() === "explicit") return true;
  if (value.toLowerCase() === "clean" || value.toLowerCase() === "notexplicit") {
    return false;
  }
  return undefined;
};

const getArtworkUrl = (song: ITunesSong): string | undefined =>
  upgradeITunesArtworkUrl(song.artworkUrl100 ?? song.artworkUrl60 ?? song.artworkUrl30);

/** Map one iTunes result into provider-neutral metadata. */
export const mapITunesSongToMetadata = (
  song: ITunesSong,
  rank = 0
): UnifiedTrackMetadata | null => {
  if (!song || typeof song !== "object") return null;

  const title = typeof song.trackName === "string" ? song.trackName.trim() : "";
  const artist = typeof song.artistName === "string" ? song.artistName.trim() : "";
  if (!title || !artist) return null;
  const primaryArtist = artist
    .split(/\s+(?:feat|ft)\.?\s+/i)[0]
    .split(/\s*[,/&]\s*/)[0]
    .trim();

  const providerMetadata: ProviderMetadata = {
    provider: "itunes",
    providerId: song.trackId,
    rank,
    popularity: asFiniteNumber(song.trackPopularity ?? song.popularity),
    isrc: getITunesIsrc(song),
    sourceUrl: typeof song.trackViewUrl === "string" ? song.trackViewUrl : undefined,
    raw: song,
  };

  const durationMs = asFiniteNumber(song.trackTimeMillis);
  const duration = durationMs !== undefined && durationMs > 0
    ? Math.round(durationMs / 1000)
    : undefined;
  const popularity = providerMetadata.popularity;

  return {
    id: song.trackId !== undefined ? String(song.trackId) : `itunes-${rank}-${title}`,
    title,
    artist,
    primaryArtist: primaryArtist || artist,
    album: typeof song.collectionName === "string" ? song.collectionName : undefined,
    artworkUrl: getArtworkUrl(song),
    duration,
    explicit: isExplicit(song),
    popularity,
    rank,
    isrc: providerMetadata.isrc,
    metadataProvider: "itunes",
    providerMetadata,
  };
};

const createAbortController = (
  timeoutMs: number,
  parentSignal?: AbortSignal
): { controller: AbortController; cleanup: () => void } => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortParent = () => controller.abort();

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", abortParent, { once: true });
  }

  return {
    controller,
    cleanup: () => {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", abortParent);
    },
  };
};

/**
 * Search iTunes without allowing a provider outage or malformed response to
 * break the rest of discovery.  The function intentionally resolves to [] on
 * network/JSON errors.
 */
export const searchITunesSongs = async (
  query: string,
  options: ITunesSearchOptions = {}
): Promise<UnifiedTrackMetadata[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    term: trimmedQuery,
    media: "music",
    entity: "song",
    limit: String(Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 200))),
  });
  if (options.country) params.set("country", options.country);
  if (options.language) params.set("lang", options.language);

  const { controller, cleanup } = createAbortController(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.signal
  );
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${ITUNES_SEARCH_URL}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as ITunesSearchResponse;
    if (!payload || !Array.isArray(payload.results)) return [];

    return payload.results
      .map((result, index) => mapITunesSongToMetadata(result as ITunesSong, index))
      .filter((result): result is UnifiedTrackMetadata => result !== null);
  } catch {
    return [];
  } finally {
    cleanup();
  }
};

// Friendly aliases for callers that use the provider's result terminology.
export const mapITunesResult = mapITunesSongToMetadata;
export const mapITunesSong = mapITunesSongToMetadata;
export const mapITunesSongToSearchResult = mapITunesSongToMetadata;
export const searchITunes = searchITunesSongs;
