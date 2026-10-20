/**
 * Album detail lookup.
 *
 * The iTunes catalog is the only index used by this app that can enumerate
 * every track of an album, so it backs the album page. The lookup only ever
 * returns provider-neutral metadata: no audio URL is trusted here. Each track
 * keeps the preview candidate it was published with, and full playback is
 * still decided later by the strict resolver in resolveTrackStream.ts.
 */

import {
  createAbortController,
  getITunesIsrc,
  getITunesPreviewUrl,
  isExplicit,
  upgradeITunesArtworkUrl,
  ITUNES_SEARCH_URL,
  type ITunesSong,
} from "./itunesApi.ts";
import { normalizeSearchText } from "./textNormalization.ts";

export const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TRACK_LIMIT = 200;
const DEFAULT_COLLECTION_LIMIT = 10;

export interface AlbumTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration?: number;
  artworkUrl?: string;
  trackNumber?: number;
  discNumber?: number;
  previewUrl?: string;
  isrc?: string;
  explicit?: boolean;
  /** "local" marks a track that already exists in the user's own queue. */
  source: "itunes" | "local";
}

export interface AlbumDetail {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  year?: number;
  genre?: string;
  copyright?: string;
  /** The number of tracks the catalog reports for the album, when known. */
  catalogTrackCount?: number;
  tracks: AlbumTrack[];
}

export interface AlbumLookupRequest {
  title: string;
  artist?: string;
  /** Provider collection id. When present it skips the album search entirely. */
  collectionId?: string | number;
}

export interface AlbumLookupOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Dependency injection keeps adapter tests entirely offline. */
  fetchImpl?: typeof fetch;
}

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const getCollectionId = (song: ITunesSong): string | undefined => {
  const id = song.collectionId;
  if (id === undefined || id === null) return undefined;
  const text = String(id).trim();
  return text || undefined;
};

const getAlbumArtwork = (song: ITunesSong): string | undefined =>
  upgradeITunesArtworkUrl(song.artworkUrl100 ?? song.artworkUrl60 ?? song.artworkUrl30);

const getReleaseYear = (releaseDate: unknown): number | undefined => {
  if (typeof releaseDate !== "string") return undefined;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) && year > 1800 && year < 2200 ? year : undefined;
};

const readResults = (payload: unknown): ITunesSong[] => {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? (results as ITunesSong[]) : [];
};

const fetchJson = async (
  url: string,
  options: AlbumLookupOptions
): Promise<unknown> => {
  const { controller, cleanup } = createAbortController(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.signal
  );
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // A provider outage must not break the album page; callers fall back to
    // whatever the app already knows about the album.
    return null;
  } finally {
    cleanup();
  }
};

/** Score how well a catalog album matches the requested album title/artist. */
const scoreCollection = (
  song: ITunesSong,
  title: string,
  artist: string
): number => {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedArtist = normalizeSearchText(artist);
  const collectionName = normalizeSearchText(song.collectionName);
  const artistName = normalizeSearchText(
    song.collectionArtistName ?? song.artistName
  );

  let score = 0;
  if (normalizedTitle && collectionName) {
    if (collectionName === normalizedTitle) score += 0.7;
    else if (
      collectionName.includes(normalizedTitle) ||
      normalizedTitle.includes(collectionName)
    ) {
      score += 0.4;
    }
  }
  if (normalizedArtist && artistName) {
    if (artistName === normalizedArtist) score += 0.3;
    else if (
      artistName.includes(normalizedArtist) ||
      normalizedArtist.includes(artistName)
    ) {
      score += 0.15;
    }
  }

  return score;
};

/** Map one catalog song into the album page's track shape. */
export const mapITunesSongToAlbumTrack = (
  song: ITunesSong,
  fallback: { title: string; artist: string }
): AlbumTrack | null => {
  const title = typeof song.trackName === "string" ? song.trackName.trim() : "";
  if (!title) return null;

  const artist =
    typeof song.artistName === "string" && song.artistName.trim()
      ? song.artistName.trim()
      : fallback.artist;
  const album =
    typeof song.collectionName === "string" && song.collectionName.trim()
      ? song.collectionName.trim()
      : fallback.title;
  const durationMs = asFiniteNumber(song.trackTimeMillis);
  const trackId = song.trackId;

  return {
    id:
      trackId !== undefined && trackId !== null
        ? `itunes_${trackId}`
        : `itunes-album-${normalizeSearchText(album)}-${normalizeSearchText(title)}`,
    title,
    artist,
    album,
    duration:
      durationMs !== undefined && durationMs > 0
        ? Math.round(durationMs / 1000)
        : undefined,
    artworkUrl: getAlbumArtwork(song),
    trackNumber: asFiniteNumber(song.trackNumber),
    discNumber: asFiniteNumber(song.discNumber),
    previewUrl: getITunesPreviewUrl(song),
    isrc: getITunesIsrc(song),
    explicit: isExplicit(song),
    source: "itunes",
  };
};

const sortAlbumTracks = (tracks: AlbumTrack[]): AlbumTrack[] =>
  [...tracks].sort(
    (left, right) =>
      (left.discNumber ?? 1) - (right.discNumber ?? 1) ||
      (left.trackNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.trackNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.title.localeCompare(right.title)
  );

/** Find the catalog album that best matches the requested album. */
const searchCollection = async (
  title: string,
  artist: string,
  options: AlbumLookupOptions
): Promise<ITunesSong | null> => {
  const term = [title, artist].filter((part) => part && part.trim()).join(" ").trim();
  if (!term) return null;

  const params = new URLSearchParams({
    term,
    media: "music",
    entity: "album",
    limit: String(DEFAULT_COLLECTION_LIMIT),
  });
  const results = readResults(
    await fetchJson(`${ITUNES_SEARCH_URL}?${params.toString()}`, options)
  );
  if (results.length === 0) return null;

  let best: ITunesSong | null = null;
  let bestScore = 0;
  results.forEach((song) => {
    const score = scoreCollection(song, title, artist);
    if (score > bestScore) {
      best = song;
      bestScore = score;
    }
  });

  return bestScore > 0 ? best : null;
};

/**
 * Fall back to the song index when the album index does not know the release.
 * The most frequently referenced collection wins, so a single popular track is
 * enough to identify the album.
 */
const findCollectionFromSongs = async (
  title: string,
  artist: string,
  options: AlbumLookupOptions
): Promise<ITunesSong | null> => {
  const term = [title, artist].filter((part) => part && part.trim()).join(" ").trim();
  if (!term) return null;

  const params = new URLSearchParams({
    term,
    media: "music",
    entity: "song",
    limit: "50",
  });
  const results = readResults(
    await fetchJson(`${ITUNES_SEARCH_URL}?${params.toString()}`, options)
  );
  if (results.length === 0) return null;

  const candidates = new Map<string, { song: ITunesSong; score: number }>();
  results.forEach((song) => {
    const collectionId = getCollectionId(song);
    if (!collectionId) return;
    const score = scoreCollection(song, title, artist);
    const existing = candidates.get(collectionId);
    if (!existing || score > existing.score) {
      candidates.set(collectionId, { song, score });
    }
  });

  let best: ITunesSong | null = null;
  let bestScore = 0;
  candidates.forEach(({ song, score }) => {
    if (score > bestScore) {
      best = song;
      bestScore = score;
    }
  });

  return bestScore > 0 ? best : null;
};

/** Read every track the catalog publishes for one collection. */
const lookupCollection = async (
  collectionId: string,
  options: AlbumLookupOptions
): Promise<AlbumDetail | null> => {
  const params = new URLSearchParams({
    id: collectionId,
    entity: "song",
    limit: String(DEFAULT_TRACK_LIMIT),
  });
  const results = readResults(
    await fetchJson(`${ITUNES_LOOKUP_URL}?${params.toString()}`, options)
  );
  if (results.length === 0) return null;

  const collection =
    results.find((song) => song.wrapperType === "collection") ??
    results.find((song) => song.collectionId !== undefined) ??
    null;

  const fallbackTitle =
    (typeof collection?.collectionName === "string"
      ? collection.collectionName.trim()
      : "") || "";
  const fallbackArtist =
    (typeof collection?.collectionArtistName === "string"
      ? collection.collectionArtistName.trim()
      : "") ||
    (typeof collection?.artistName === "string"
      ? collection.artistName.trim()
      : "") ||
    "";

  const tracks = sortAlbumTracks(
    results
      .filter((song) => song.wrapperType !== "collection")
      .map((song) =>
        mapITunesSongToAlbumTrack(song, {
          title: fallbackTitle,
          artist: fallbackArtist,
        })
      )
      .filter((track): track is AlbumTrack => track !== null)
  );

  if (tracks.length === 0) return null;

  const title =
    fallbackTitle || tracks[0].album || "Album";
  const artist = fallbackArtist || tracks[0].artist;

  return {
    id: `itunes-collection-${collectionId}`,
    title,
    artist,
    artworkUrl: collection ? getAlbumArtwork(collection) : tracks[0].artworkUrl,
    year: getReleaseYear(collection?.releaseDate),
    genre:
      typeof collection?.primaryGenreName === "string"
        ? collection.primaryGenreName
        : undefined,
    copyright:
      typeof collection?.copyright === "string" ? collection.copyright : undefined,
    catalogTrackCount: asFiniteNumber(collection?.trackCount),
    tracks,
  };
};

/**
 * Resolve the full track list for an album.
 *
 * Returns null when the catalog does not know the release so the caller can
 * fall back to the tracks it already holds locally.
 */
export const lookupAlbum = async (
  request: AlbumLookupRequest,
  options: AlbumLookupOptions = {}
): Promise<AlbumDetail | null> => {
  const title = request.title?.trim() ?? "";
  const artist = request.artist?.trim() ?? "";
  if (!title) return null;

  const collectionId =
    request.collectionId !== undefined && request.collectionId !== null
      ? String(request.collectionId).trim()
      : "";

  if (collectionId) {
    const direct = await lookupCollection(collectionId, options);
    if (direct) return direct;
  }

  const matched =
    (await searchCollection(title, artist, options)) ??
    (await findCollectionFromSongs(title, artist, options));
  if (!matched) return null;

  const matchedId = getCollectionId(matched);
  if (!matchedId) return null;

  return lookupCollection(matchedId, options);
};
