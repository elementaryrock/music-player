/**
 * Strict metadata-to-audio stream resolution.
 *
 * Discovery and playback are intentionally separate: a metadata result is not
 * considered playable until this service has matched it to the same recording
 * on an audio provider.  This prevents a popular regional cover from silently
 * replacing the song the user selected.
 */

import { searchSongs } from "./api";
import {
  getTidalTrackById,
  searchTidalSongs,
} from "./tidalApi";
import type { TidalSearchResponse, TidalTrack } from "../types/tidal.types";
import type {
  ProviderMetadata,
  ResolvedTrackStream,
  StreamQuality,
  TrackResolutionInput,
} from "../types/discovery.types";
import type { Track } from "../types/api.types";

type TidalSearchFn = (
  query: string,
  limit?: number,
  offset?: number
) => Promise<TidalSearchResponse | null>;
type TidalTrackFn = (
  trackId: number,
  quality?:
    | "LOW"
    | "HIGH"
    | "LOSSLESS"
    | "HI_RES"
    | "HI_RES_LOSSLESS",
  country?: string
) => Promise<unknown>;
type JioSearchFn = (
  query: string,
  page?: number,
  limit?: number
) => Promise<unknown>;

export interface TrackResolverDependencies {
  searchTidal?: TidalSearchFn;
  getTidalTrackById?: TidalTrackFn;
  searchJioSaavn?: JioSearchFn;
}

export interface ResolveTrackStreamOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  tidalLimit?: number;
  jioLimit?: number;
  tidalQualities?: Array<"HI_RES_LOSSLESS" | "LOSSLESS" | "HI_RES" | "HIGH">;
  dependencies?: TrackResolverDependencies;
}

export type ResolvableTrack = TrackResolutionInput | Track;

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TIDAL_LIMIT = 12;
const DEFAULT_JIO_LIMIT = 20;
const DEFAULT_TIDAL_QUALITIES: ResolveTrackStreamOptions["tidalQualities"] = [
  "HI_RES_LOSSLESS",
  "LOSSLESS",
  "HI_RES",
];

const toStringValue = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();

/** Normalize accents, punctuation, whitespace and case for deterministic matching. */
export const normalizeProviderText = (value: unknown): string =>
  toStringValue(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeTrackTitle = (value: unknown): string =>
  normalizeProviderText(value);

export const normalizeTrackArtist = (value: unknown): string =>
  normalizeProviderText(value);

export const normalizeIsrc = (value: unknown): string | undefined => {
  const normalized = toStringValue(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || undefined;
};

/** Similarity is deliberately conservative; substring matches are not exact matches. */
export const artistSimilarity = (left: unknown, right: unknown): number => {
  const a = normalizeTrackArtist(left);
  const b = normalizeTrackArtist(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Support a provider's "Artist feat. Guest" representation while requiring
  // the requested primary artist to be a complete token sequence.
  const containment = a.includes(b) || b.includes(a) ? 0.84 : 0;
  return Math.max(jaccard, containment);
};

export const getTidalIsrc = (track: TidalTrack | Record<string, unknown>): string | undefined => {
  const candidate = track as Record<string, unknown>;
  const externalIds = candidate.externalIds as Record<string, unknown> | undefined;
  const value =
    candidate.isrc ??
    candidate.ISRC ??
    externalIds?.isrc ??
    (Array.isArray(externalIds?.isrcs) ? externalIds?.isrcs[0] : undefined);
  return normalizeIsrc(value);
};

const getTidalArtist = (track: TidalTrack | Record<string, unknown>): string => {
  const candidate = track as Record<string, unknown>;
  const artist = candidate.artist;
  if (artist && typeof artist === "object" && "name" in artist) {
    return toStringValue((artist as { name?: unknown }).name);
  }
  const artists = candidate.artists;
  if (Array.isArray(artists) && artists.length > 0) {
    const first = artists[0];
    return typeof first === "string"
      ? first
      : first && typeof first === "object" && "name" in first
        ? toStringValue((first as { name?: unknown }).name)
        : "";
  }
  return toStringValue(candidate.primaryArtists);
};

const getTidalTitle = (track: TidalTrack | Record<string, unknown>): string =>
  toStringValue((track as Record<string, unknown>).title);

const getDuration = (value: unknown): number | undefined => {
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.split(":").map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) {
      return Math.round(parts[0] * 60 + parts[1]);
    }
  }
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : undefined;
};

const getTidalDuration = (track: TidalTrack | Record<string, unknown>): number | undefined =>
  getDuration((track as Record<string, unknown>).duration);

const getJioArtist = (song: Record<string, unknown>): string => {
  const artists = song.artists;
  if (typeof song.primaryArtists === "string" && song.primaryArtists.trim()) {
    return song.primaryArtists;
  }
  if (typeof song.artist === "string" && song.artist.trim()) return song.artist;
  if (Array.isArray(artists) && artists.length > 0) {
    const names = artists
      .map((artist) =>
        typeof artist === "string"
          ? artist
          : artist && typeof artist === "object" && "name" in artist
            ? toStringValue((artist as { name?: unknown }).name)
            : ""
      )
      .filter(Boolean);
    if (names.length > 0) return names[0];
  }
  return typeof song.singers === "string" ? song.singers : "";
};

const getJioTitle = (song: Record<string, unknown>): string =>
  toStringValue(song.name ?? song.title);

const getJioDuration = (song: Record<string, unknown>): number | undefined =>
  getDuration(song.duration);

const isDurationMatch = (requested?: number, candidate?: number): boolean => {
  if (requested === undefined) return true;
  if (candidate === undefined) return false;
  return Math.abs(requested - candidate) <= 5;
};

export interface StrictMatch {
  matched: boolean;
  confidence: number;
  matchedBy: "isrc" | "title-artist-duration";
}

/**
 * Strict match used for Tidal and JioSaavn candidates.  Version labels remain
 * part of the normalized title, so "Song (Live)" cannot match "Song".
 */
export const matchTrackMetadata = (
  requested: Pick<TrackResolutionInput, "title" | "artist" | "primaryArtist" | "duration" | "isrc">,
  candidate: {
    title: string;
    artist: string;
    duration?: number;
    isrc?: string;
  },
  options: { requireIsrc?: boolean } = {}
): StrictMatch => {
  const requestedIsrc = normalizeIsrc(requested.isrc);
  const candidateIsrc = normalizeIsrc(candidate.isrc);

  if (requestedIsrc && options.requireIsrc) {
    return requestedIsrc === candidateIsrc
      ? { matched: true, confidence: 1, matchedBy: "isrc" }
      : { matched: false, confidence: 0, matchedBy: "isrc" };
  }
  if (requestedIsrc && candidateIsrc && requestedIsrc !== candidateIsrc) {
    return { matched: false, confidence: 0, matchedBy: "title-artist-duration" };
  }

  const requestedTitle = normalizeTrackTitle(requested.title);
  const candidateTitle = normalizeTrackTitle(candidate.title);
  if (!requestedTitle || !candidateTitle || requestedTitle !== candidateTitle) {
    return { matched: false, confidence: 0, matchedBy: "title-artist-duration" };
  }

  const requestedArtist = requested.primaryArtist || requested.artist;
  const candidateArtist = candidate.artist
    .split(/\s+(?:feat|ft)\.?\s+/i)[0]
    .split(/\s*[,/&]\s*/)[0]
    .trim();
  const suspiciousArtist = /\b(?:tribute|karaoke|cover)\b/i.test(candidate.artist);
  const artistScore = suspiciousArtist ? 0 : artistSimilarity(requestedArtist, candidateArtist);
  if (artistScore < 0.88 || !isDurationMatch(requested.duration, candidate.duration)) {
    return { matched: false, confidence: 0, matchedBy: "title-artist-duration" };
  }

  const durationConfidence = requested.duration === undefined
    ? 0.92
    : 1 - Math.min(Math.abs(requested.duration - (candidate.duration ?? requested.duration)), 5) / 50;
  return {
    matched: true,
    confidence: Math.min(0.99, 0.72 + artistScore * 0.18 + durationConfidence * 0.09),
    matchedBy: "title-artist-duration",
  };
};

const getTrackProviderMetadata = (
  provider: "tidal" | "jiosaavn",
  candidate: Record<string, unknown>,
  providerId: string | number | undefined,
  isrc?: string
): ProviderMetadata => ({
  provider,
  providerId,
  isrc: normalizeIsrc(isrc),
  sourceUrl: typeof candidate.url === "string" ? candidate.url : undefined,
  raw: candidate,
});

const getTidalStreamUrl = (data: unknown): string | undefined => {
  const records = Array.isArray(data) ? data : [data];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const value = (record as Record<string, unknown>).OriginalTrackUrl ??
      (record as Record<string, unknown>).originalTrackUrl;
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

const getStreamQuality = (
  requested: "HI_RES_LOSSLESS" | "LOSSLESS" | "HI_RES" | "HIGH",
  data: unknown
): StreamQuality => {
  const records = Array.isArray(data) ? data : [data];
  const reported = records.find((record) => record && typeof record === "object") as Record<string, unknown> | undefined;
  const reportedQuality = toStringValue(reported?.audioQuality ?? reported?.quality).toUpperCase();
  if (reportedQuality.includes("HI_RES")) return "hi-res";
  if (reportedQuality.includes("LOSSLESS") || reportedQuality === "FLAC") return "lossless";
  if (requested === "HI_RES_LOSSLESS" || requested === "HI_RES") return "hi-res";
  if (requested === "LOSSLESS") return "lossless";
  return "high";
};

const getQualityLabel = (quality: StreamQuality): ResolvedTrackStream["qualityLabel"] => {
  switch (quality) {
    case "hi-res":
      return "Hi-Res";
    case "lossless":
      return "Lossless";
    case "high":
      return "High Quality";
    default:
      return "Standard";
  }
};

const raceWithAbort = async <T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  const createNamedError = (message: string, name: string): Error => {
    const error = new Error(message);
    error.name = name;
    return error;
  };
  const abortPromise = new Promise<T>((_, reject) => {
    abortHandler = () => reject(createNamedError("The operation was aborted", "AbortError"));
    if (signal?.aborted) abortHandler();
    else signal?.addEventListener("abort", abortHandler, { once: true });
    timeoutId = setTimeout(
      () => reject(createNamedError("The operation timed out", "TimeoutError")),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (abortHandler) signal?.removeEventListener("abort", abortHandler);
  }
};

const createResult = (
  url: string,
  source: "tidal" | "jiosaavn",
  quality: StreamQuality,
  match: StrictMatch,
  providerId?: string | number,
  providerMetadata?: ProviderMetadata
): ResolvedTrackStream => ({
  url,
  audioSrc: url,
  source,
  quality,
  qualityLabel: getQualityLabel(quality),
  matchConfidence: match.confidence,
  confidence: Math.min(1, match.confidence * (source === "tidal" ? 1 : 0.86)),
  matchedBy: match.matchedBy,
  providerId,
  providerMetadata,
});

const toResolutionInput = (track: ResolvableTrack): TrackResolutionInput => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  primaryArtist: "primaryArtist" in track ? track.primaryArtist : undefined,
  album: track.album,
  duration: track.duration,
  isrc: track.isrc || track.providerMetadata?.isrc,
  providerMetadata: track.providerMetadata,
  audioCandidates: track.audioCandidates,
});

const tryTidal = async (
  track: TrackResolutionInput,
  options: ResolveTrackStreamOptions,
  dependencies: Required<TrackResolverDependencies>
): Promise<ResolvedTrackStream | null> => {
  const limit = options.tidalLimit ?? DEFAULT_TIDAL_LIMIT;
  const qualities = options.tidalQualities ?? DEFAULT_TIDAL_QUALITIES;
  const seen = new Set<string>();
  const searches: Array<{ query: string; byIsrc: boolean }> = [];
  if (track.isrc) searches.push({ query: track.isrc, byIsrc: true });
  searches.push({ query: `${track.title} ${track.primaryArtist || track.artist}`.trim(), byIsrc: false });

  for (const search of searches) {
    if (options.signal?.aborted) return null;
    let response: TidalSearchResponse | null = null;
    try {
      response = await raceWithAbort(
        dependencies.searchTidal(search.query, limit, 0),
        options.signal,
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      );
    } catch {
      continue;
    }

    const candidates = Array.isArray(response?.items) ? response.items : [];
    for (const candidate of candidates) {
      if (!candidate || candidate.id === undefined) continue;
      const candidateId = String(candidate.id);
      if (seen.has(candidateId)) continue;

      const match = search.byIsrc
        ? matchTrackMetadata(
            track,
            {
              title: getTidalTitle(candidate),
              artist: getTidalArtist(candidate),
              duration: getTidalDuration(candidate),
              isrc: getTidalIsrc(candidate),
            },
            { requireIsrc: true }
          )
        : matchTrackMetadata(track, {
            title: getTidalTitle(candidate),
            artist: getTidalArtist(candidate),
            duration: getTidalDuration(candidate),
            isrc: getTidalIsrc(candidate),
          });
      if (!match.matched) continue;
      seen.add(candidateId);
      const tidalId = Number(candidate.id);
      if (!Number.isFinite(tidalId)) continue;

      const providerMetadata = getTrackProviderMetadata(
        "tidal",
        candidate as unknown as Record<string, unknown>,
        candidate.id,
        getTidalIsrc(candidate)
      );
      for (const quality of qualities) {
        if (options.signal?.aborted) return null;
        try {
          const data = await raceWithAbort(
            dependencies.getTidalTrackById(tidalId, quality),
            options.signal,
            options.timeoutMs ?? DEFAULT_TIMEOUT_MS
          );
          const url = getTidalStreamUrl(data);
          if (url) {
            return createResult(
              url,
              "tidal",
              getStreamQuality(quality, data),
              match,
              candidate.id,
              providerMetadata
            );
          }
        } catch {
          // Try the next Tidal quality or candidate without exposing provider errors.
        }
      }
    }
  }

  return null;
};

const getJioAudioUrl = (song: Record<string, unknown>): string | undefined => {
  const direct = song.audioUrl ?? song.audioSrc;
  if (typeof direct === "string" && direct.trim()) return direct;
  const downloads = song.downloadUrl;
  if (Array.isArray(downloads)) {
    for (let index = downloads.length - 1; index >= 0; index -= 1) {
      const item = downloads[index];
      const url = typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? (item as Record<string, unknown>).link ?? (item as Record<string, unknown>).url
          : undefined;
      if (typeof url === "string" && url.trim()) return url;
    }
  }
  return typeof downloads === "string" ? downloads : undefined;
};

const getJioIsrc = (song: Record<string, unknown>): string | undefined =>
  normalizeIsrc(song.isrc ?? song.ISRC);

const tryJioSaavn = async (
  track: TrackResolutionInput,
  options: ResolveTrackStreamOptions,
  dependencies: Required<TrackResolverDependencies>
): Promise<ResolvedTrackStream | null> => {
  if (options.signal?.aborted) return null;
  let response: unknown;
  try {
    response = await raceWithAbort(
      dependencies.searchJioSaavn(
        `${track.title} ${track.primaryArtist || track.artist}`.trim(),
        0,
        options.jioLimit ?? DEFAULT_JIO_LIMIT
      ),
      options.signal,
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
  } catch {
    return null;
  }

  const responseRecord = response && typeof response === "object"
    ? response as Record<string, unknown>
    : undefined;
  const dataRecord = responseRecord?.data && typeof responseRecord.data === "object"
    ? responseRecord.data as Record<string, unknown>
    : undefined;
  const candidates: unknown[] = Array.isArray(responseRecord?.results)
    ? responseRecord.results
    : Array.isArray(dataRecord?.results)
      ? dataRecord.results
      : [];

  for (const value of candidates) {
    if (!value || typeof value !== "object") continue;
    const candidate = value as Record<string, unknown>;
    const match = matchTrackMetadata(track, {
      title: getJioTitle(candidate),
      artist: getJioArtist(candidate),
      duration: getJioDuration(candidate),
      isrc: getJioIsrc(candidate),
    });
    const url = getJioAudioUrl(candidate);
    if (!match.matched || !url) continue;

    const providerId = candidate.id !== undefined ? String(candidate.id) : undefined;
    return createResult(
      url,
      "jiosaavn",
      "standard",
      match,
      providerId,
      getTrackProviderMetadata("jiosaavn", candidate, providerId, getJioIsrc(candidate))
    );
  }
  return null;
};

/**
 * Resolve a selected metadata result to a verified playable stream.
 *
 * Order is intentionally fixed: Tidal by ISRC, Tidal by strict metadata, then
 * JioSaavn by strict metadata.  A loose title-only hit is never returned.
 */
export const resolveTrackStream = async (
  input: ResolvableTrack,
  options: ResolveTrackStreamOptions = {}
): Promise<ResolvedTrackStream | null> => {
  if (!input || !toStringValue(input.title) || !toStringValue(input.artist)) return null;

  const dependencies: Required<TrackResolverDependencies> = {
    searchTidal: options.dependencies?.searchTidal ?? searchTidalSongs,
    getTidalTrackById: options.dependencies?.getTidalTrackById ?? getTidalTrackById,
    searchJioSaavn: options.dependencies?.searchJioSaavn ?? searchSongs,
  };
  const track = toResolutionInput(input);

  const tidal = await tryTidal(track, options, dependencies);
  if (tidal) return tidal;
  if (options.signal?.aborted) return null;

  return tryJioSaavn(track, options, dependencies);
};

export const resolveStreamForTrack = resolveTrackStream;
export const resolveAudioStream = resolveTrackStream;
