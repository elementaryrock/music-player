/**
 * Backend-free playlist import helpers.
 *
 * This module only turns exported metadata into a small, provider-neutral
 * representation.  It deliberately does not resolve audio, call a provider,
 * or infer that an account library was imported.  Callers can pass the
 * resulting entries to the app's existing strict metadata/stream resolver.
 */

export const PLAYLIST_IMPORT_SOURCES = [
  "spotify",
  "youtube-music",
  "apple-music",
  "itunes",
  "csv",
  "json",
  "m3u",
  "unknown",
] as const;

export type PlaylistImportSource = (typeof PLAYLIST_IMPORT_SOURCES)[number];

/** A normalized track row produced by {@link parsePlaylistImport}. */
export interface ImportedPlaylistEntry {
  source: PlaylistImportSource;
  playlistName: string;
  sourceUrl?: string;
  sourceId?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  isrc?: string;
  /** One-based input line for text formats such as CSV and M3U. */
  sourceLine?: number;
  /** Zero-based item index for structured formats and parsed rows. */
  sourceIndex?: number;
}

export interface ImportedPlaylist {
  source: PlaylistImportSource;
  playlistName: string;
  sourceUrl?: string;
  sourceId?: string;
  entries: ImportedPlaylistEntry[];
  /** Rows that could not be normalized. Duplicate rows are not counted. */
  skippedCount: number;
  warnings: string[];
  /** A user-facing message when the import was empty, invalid, or unsupported. */
  error?: string;
}

export interface PlaylistImportOptions {
  /** Explicit source or provider hint. */
  source?: PlaylistImportSource | string;
  /** Explicit format/provider hint, for example `csv`, `m3u8`, or `spotify`. */
  format?: string;
  playlistName?: string;
  sourceUrl?: string;
  sourceId?: string;
  /** Used for automatic format detection when the input came from a file. */
  fileName?: string;
  /** Lower-case alias accepted for callers that use DOM/File naming. */
  filename?: string;
}

export type PlaylistImportInput = unknown;

interface RecordValue {
  [key: string]: unknown;
}

interface CandidateEntry {
  raw: unknown;
  sourceIndex?: number;
  sourceLine?: number;
  sourceUrl?: string;
  sourceId?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  isrc?: string;
}

interface ParsedCollection {
  items: unknown[];
  metadata?: RecordValue;
  sourceHint?: PlaylistImportSource;
}

interface ParsedText {
  candidates: CandidateEntry[];
  warnings: string[];
  skippedCount: number;
  playlistName?: string;
  sourceUrl?: string;
  sourceId?: string;
}

interface NormalizedCandidates {
  entries: ImportedPlaylistEntry[];
  warnings: string[];
  skippedCount: number;
}

const DEFAULT_PLAYLIST_NAME = "Imported Playlist";
const DEFAULT_ARTIST = "Unknown Artist";

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
};

/** Convert common API display-text objects and artist arrays into plain text. */
export const displayText = (value: unknown): string | undefined => {
  const direct = textValue(value);
  if (direct) return direct;

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => displayText(item))
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : undefined;
  }

  if (isRecord(value)) {
    for (const key of ["text", "name", "title", "label", "value"]) {
      const nested = displayText(value[key]);
      if (nested) return nested;
    }
  }

  return undefined;
};

const cleanText = (value: unknown): string | undefined => {
  const text = displayText(value);
  return text ? text.replace(/\s+/g, " ").trim() || undefined : undefined;
};

const normalizeSource = (value: unknown): PlaylistImportSource | undefined => {
  const raw = textValue(value);
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().trim().replace(/[_.\s]+/g, "-");
  switch (normalized) {
    case "spotify":
      return "spotify";
    case "youtube":
    case "youtube-music":
    case "youtubemusic":
    case "ytmusic":
      return "youtube-music";
    case "apple":
    case "apple-music":
    case "applemusic":
    case "music":
      return "apple-music";
    case "itunes":
    case "i-tunes":
      return "itunes";
    case "csv":
      return "csv";
    case "json":
      return "json";
    case "m3u":
    case "m3u8":
      return "m3u";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
};

const sourceHintFromOptions = (
  options: PlaylistImportOptions,
): PlaylistImportSource | undefined =>
  normalizeSource(options.source) || normalizeSource(options.format);

const getPath = (value: unknown, path: string): unknown => {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!isRecord(current)) return undefined;
    if (segment in current) {
      current = current[segment];
      continue;
    }
    const normalizedSegment = segment.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchingKey = Object.keys(current).find(
      (key) => key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedSegment,
    );
    current = matchingKey ? current[matchingKey] : undefined;
  }
  return current;
};

const firstValue = (objects: readonly unknown[], paths: readonly string[]): unknown => {
  for (const object of objects) {
    for (const path of paths) {
      const value = getPath(object, path);
      if (value !== undefined && value !== null && displayText(value)) return value;
    }
  }
  return undefined;
};

const firstText = (objects: readonly unknown[], paths: readonly string[]): string | undefined =>
  cleanText(firstValue(objects, paths));

const firstField = (
  objects: readonly unknown[],
  paths: readonly string[],
): { value: unknown; path: string } | undefined => {
  for (const object of objects) {
    for (const path of paths) {
      const value = getPath(object, path);
      if (value !== undefined && value !== null && displayText(value)) {
        return { value, path };
      }
    }
  }
  return undefined;
};

const sourceLineLabel = (candidate: CandidateEntry): string =>
  candidate.sourceLine !== undefined
    ? `line ${candidate.sourceLine}`
    : candidate.sourceIndex !== undefined
      ? `entry ${candidate.sourceIndex + 1}`
      : "entry";

const isUrl = (value: string): boolean =>
  /^(?:https?|ftps?|file|spotify|apple|itunes|youtube(?:-music)?):\/\//i.test(value) ||
  /^(?:www\.)/i.test(value) ||
  /^\/\//.test(value);

const isAudioPath = (value: string): boolean =>
  /\.(?:aac|flac|m4a|mp3|ogg|opus|wav|webm)(?:[?#].*)?$/i.test(value);

const normalizeForKey = (value: string | undefined): string =>
  (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The stable dedupe key used by playlist imports. */
export const createImportedPlaylistDedupeKey = (
  title: string,
  artist: string,
  album?: string,
): string =>
  [normalizeForKey(title), normalizeForKey(artist), normalizeForKey(album)].join("\u0000");

const parseDuration = (value: unknown, unitHint = ""): number | undefined => {
  if (isRecord(value)) {
    const seconds = value.seconds ?? value.durationSeconds;
    if (seconds !== undefined) return parseDuration(seconds, "seconds");
    const milliseconds = value.milliseconds ?? value.durationMs ?? value.durationInMillis;
    if (milliseconds !== undefined) return parseDuration(milliseconds, "milliseconds");
    return undefined;
  }

  const raw = textValue(value);
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-1") return undefined;

  const isoMatch = trimmed.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] || 0);
    const minutes = Number(isoMatch[2] || 0);
    const seconds = Number(isoMatch[3] || 0);
    const total = hours * 3600 + minutes * 60 + seconds;
    return Number.isFinite(total) && total > 0 ? Math.round(total) : undefined;
  }

  if (/^\d+(?::\d{1,2}){1,2}$/.test(trimmed)) {
    const parts = trimmed.split(":").map(Number);
    const total = parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
    return Number.isFinite(total) && total > 0 ? Math.round(total) : undefined;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  const lowerHint = unitHint.toLowerCase();
  const milliseconds = lowerHint.includes("millisecond") || lowerHint.includes("millis") || lowerHint.endsWith("_ms") || lowerHint.endsWith("ms");
  const seconds = milliseconds ? numeric / 1000 : numeric;
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : undefined;
};

const normalizeIsrc = (value: unknown): string | undefined => {
  const text = cleanText(value);
  if (!text) return undefined;
  const normalized = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || undefined;
};

const unwrapObjects = (value: unknown): RecordValue[] => {
  if (!isRecord(value)) return [];
  const nested: RecordValue[] = [];
  for (const key of ["track", "song", "entry", "attributes", "snippet", "item"]) {
    if (isRecord(value[key])) nested.push(value[key]);
  }
  return [...nested, value];
};

const artistText = (objects: readonly unknown[], source: PlaylistImportSource): string | undefined => {
  const artist = firstValue(objects, [
    "artist",
    "artistName",
    "artistNames",
    "artistName(s)",
    "artists",
    "primaryArtists",
    "featuredArtists",
    "singers",
    "performer",
    "author",
    "channelTitle",
    "videoOwnerChannelTitle",
    "ownerChannelName",
  ]);
  let result = cleanText(artist);
  if (!result) return undefined;

  if (source === "youtube-music") {
    result = result.replace(/\s+-\s+Topic$/i, "").trim();
  }
  return result || undefined;
};

const titleText = (objects: readonly unknown[]): string | undefined =>
  firstText(objects, [
    "title",
    "name",
    "trackName",
    "songName",
    "track_title",
    "song_title",
    "videoTitle",
    "trackTitle",
  ]);

const albumText = (objects: readonly unknown[]): string | undefined =>
  firstText(objects, [
    "album",
    "albumName",
    "collectionName",
    "collection",
    "releaseName",
    "albumTitle",
  ]);

const sourceUrlText = (objects: readonly unknown[]): string | undefined =>
  firstText(objects, [
    "sourceUrl",
    "source_url",
    "external_urls.spotify",
    "trackViewUrl",
    "url",
    "href",
    "webpageUrl",
    "videoUrl",
    "link",
    "permalink",
  ]);

const sourceIdText = (objects: readonly unknown[]): string | undefined =>
  firstText(objects, [
    "sourceId",
    "source_id",
    "id",
    "trackId",
    "track_id",
    "songId",
    "persistentID",
    "videoId",
    "resourceId.videoId",
  ]);

const isrcText = (objects: readonly unknown[]): string | undefined =>
  normalizeIsrc(firstValue(objects, [
    "isrc",
    "ISRC",
    "external_ids.isrc",
    "externalIds.isrc",
    "attributes.isrc",
  ]));

const durationValue = (objects: readonly unknown[]): number | undefined => {
  const field = firstField(objects, [
    "duration_ms",
    "durationMs",
    "durationMillis",
    "durationMilliseconds",
    "trackTimeMillis",
    "track_time_millis",
    "durationInMillis",
    "lengthSeconds",
    "durationSeconds",
    "duration",
    "length",
    "lengthText",
    "time",
  ]);
  return field ? parseDuration(field.value, field.path) : undefined;
};

const splitArtistTitle = (value: string): { title: string; artist?: string } => {
  const match = value.match(/^\s*(.*?)\s+[-–—]\s+(.*?)\s*$/);
  if (!match) return { title: value.trim() };
  return {
    artist: match[1].trim() || undefined,
    title: match[2].trim(),
  };
};

const candidateFromRecord = (
  raw: unknown,
  source: PlaylistImportSource,
  sourceIndex?: number,
  sourceLine?: number,
): CandidateEntry => {
  if (typeof raw === "string") {
    const value = cleanText(raw);
    const parts = value && !isUrl(value) ? splitArtistTitle(value) : undefined;
    return {
      raw,
      sourceIndex,
      sourceLine,
      title: parts?.title,
      artist: parts?.artist,
    };
  }
  const objects = unwrapObjects(raw);
  const rawTitle = titleText(objects);
  const rawArtist = artistText(objects, source);
  const titleParts = rawTitle && !rawArtist ? splitArtistTitle(rawTitle) : undefined;
  const title = titleParts?.title || rawTitle;

  return {
    raw,
    sourceIndex,
    sourceLine,
    sourceUrl: sourceUrlText(objects),
    title,
    artist: rawArtist || titleParts?.artist,
    album: albumText(objects),
    duration: durationValue(objects),
    isrc: isrcText(objects),
  };
};

const isLikelySpotifyRecord = (value: unknown): boolean => {
  const objects = unwrapObjects(value);
  return Boolean(
    firstValue(objects, ["duration_ms", "external_urls.spotify", "external_ids.isrc"]) ||
    (isRecord(value) && isRecord(value.track)),
  );
};

const isLikelyYouTubeRecord = (value: unknown): boolean => {
  const objects = unwrapObjects(value);
  return Boolean(firstValue(objects, ["resourceId.videoId", "videoId"]));
};

const isLikelyAppleRecord = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.attributes)) return false;
  return Boolean(firstValue([value.attributes], ["durationInMillis", "artistName", "albumName"]));
};

const isLikelyITunesRecord = (value: unknown): boolean => {
  const objects = unwrapObjects(value);
  return Boolean(firstValue(objects, ["trackTimeMillis", "trackViewUrl", "collectionName", "artistName"]));
};

const inferJsonSource = (root: unknown, items: readonly unknown[]): PlaylistImportSource => {
  if (isRecord(root)) {
    const explicit = normalizeSource(firstValue([root], ["source", "provider", "platform", "service"]));
    if (explicit) return explicit;
    if (isRecord(root.playlist)) {
      const playlistSource = normalizeSource(firstValue([root.playlist], ["source", "provider", "platform", "service"]));
      if (playlistSource) return playlistSource;
    }
  }

  if (items.some(isLikelySpotifyRecord)) return "spotify";
  if (items.some(isLikelyYouTubeRecord)) return "youtube-music";
  if (items.some(isLikelyAppleRecord)) return "apple-music";
  if (items.some(isLikelyITunesRecord)) return "itunes";
  return "json";
};

const collectionFromValue = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return undefined;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.data)) return value.data;
  return undefined;
};

const findCollection = (root: RecordValue): { items?: unknown[]; metadata?: RecordValue } => {
  if (isRecord(root.playlist)) {
    const playlist = root.playlist;
    for (const key of ["tracks", "items", "songs", "entries"]) {
      const items = collectionFromValue(playlist[key]);
      if (items) return { items, metadata: { ...root, ...playlist } };
    }
  }

  for (const key of ["tracks", "songs", "entries", "items", "results"]) {
    const items = collectionFromValue(root[key]);
    if (items) return { items, metadata: root };
  }

  if (Array.isArray(root.data)) return { items: root.data, metadata: root };

  if (isRecord(root.data)) {
    const nested = findCollection(root.data);
    if (nested.items) return nested;
  }

  if (titleText([root]) || isRecord(root.track) || isRecord(root.attributes)) {
    return { items: [root], metadata: root };
  }

  return { metadata: root };
};

const extractJsonCollection = (
  root: unknown,
  options: PlaylistImportOptions,
): ParsedCollection | undefined => {
  if (Array.isArray(root)) {
    return {
      items: root,
      sourceHint: sourceHintFromOptions(options) || inferJsonSource(root, root),
    };
  }
  if (!isRecord(root)) return undefined;

  const found = findCollection(root);
  if (!found.items) return undefined;
  const sourceHint = sourceHintFromOptions(options) || inferJsonSource(root, found.items);
  return { items: found.items, metadata: found.metadata || root, sourceHint };
};

const metadataFromRecord = (
  metadata: RecordValue | undefined,
  options: PlaylistImportOptions,
): { playlistName?: string; sourceUrl?: string; sourceId?: string } => {
  const objects = metadata ? unwrapObjects(metadata) : [];
  return {
    playlistName:
      cleanText(options.playlistName) ||
      firstText(objects, ["playlistName", "name", "title", "playlist.name", "metadata.name"]),
    sourceUrl:
      cleanText(options.sourceUrl) ||
      firstText(objects, ["sourceUrl", "source_url", "url", "href", "external_urls.spotify"]),
    sourceId:
      cleanText(options.sourceId) ||
      firstText(objects, ["sourceId", "source_id", "id", "playlistId", "playlist_id"]),
  };
};

const parseJsonValue = (
  value: unknown,
  options: PlaylistImportOptions,
): { collection?: ParsedCollection; error?: string; warnings: string[] } => {
  let root: unknown = value;
  const warnings: string[] = [];

  if (typeof value === "string") {
    if (!value.trim()) {
      return { warnings, error: "No playlist data was provided." };
    }
    try {
      root = JSON.parse(value);
    } catch {
      return {
        warnings: ["The playlist text is not valid JSON."],
        error: "Could not parse playlist import as JSON.",
      };
    }
  }

  const collection = extractJsonCollection(root, options);
  if (!collection) {
    return {
      warnings: ["The JSON does not contain a supported playlist collection."],
      error: "This JSON format is not a supported playlist export.",
    };
  }
  return { collection, warnings };
};

const normalizeCandidate = (
  candidate: CandidateEntry,
  source: PlaylistImportSource,
  playlistName: string,
): { entry?: ImportedPlaylistEntry; warning?: string } => {
  try {
    const title = cleanText(candidate.title);
    if (!title || isUrl(title)) {
      return { warning: `Skipped ${sourceLineLabel(candidate)}: no usable track title was found.` };
    }

    const artist = cleanText(candidate.artist) || DEFAULT_ARTIST;
    const album = cleanText(candidate.album);
    const sourceUrl = cleanText(candidate.sourceUrl);
    const entry: ImportedPlaylistEntry = {
      source,
      playlistName,
      title,
      artist,
    };
    if (sourceUrl && !isUrl(title)) entry.sourceUrl = sourceUrl;
    if (candidate.sourceIndex !== undefined) entry.sourceIndex = candidate.sourceIndex;
    if (candidate.sourceLine !== undefined) entry.sourceLine = candidate.sourceLine;
    if (album) entry.album = album;
    if (candidate.duration !== undefined) entry.duration = candidate.duration;
    if (candidate.isrc) entry.isrc = candidate.isrc;

    const rawRecord = isRecord(candidate.raw) ? candidate.raw : undefined;
    const sourceId = candidate.sourceId || (rawRecord ? sourceIdText(unwrapObjects(rawRecord)) : undefined);
    if (sourceId) entry.sourceId = sourceId;

    return { entry };
  } catch {
    return { warning: `Skipped ${sourceLineLabel(candidate)}: the row could not be read.` };
  }
};

const normalizeCandidates = (
  candidates: readonly CandidateEntry[],
  source: PlaylistImportSource,
  playlistName: string,
  initialWarnings: readonly string[] = [],
  initialSkippedCount = 0,
): NormalizedCandidates => {
  const entries: ImportedPlaylistEntry[] = [];
  const warnings = [...initialWarnings];
  let skippedCount = initialSkippedCount;
  const seen = new Map<string, number>();

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate, source, playlistName);
    if (!normalized.entry) {
      skippedCount += 1;
      if (normalized.warning) warnings.push(normalized.warning);
      continue;
    }

    const key = createImportedPlaylistDedupeKey(
      normalized.entry.title,
      normalized.entry.artist,
      normalized.entry.album,
    );
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      const existing = entries[existingIndex];
      const merged = { ...existing };
      if (!merged.sourceUrl && normalized.entry.sourceUrl) merged.sourceUrl = normalized.entry.sourceUrl;
      if (!merged.sourceId && normalized.entry.sourceId) merged.sourceId = normalized.entry.sourceId;
      if (!merged.album && normalized.entry.album) merged.album = normalized.entry.album;
      if (merged.duration === undefined && normalized.entry.duration !== undefined) {
        merged.duration = normalized.entry.duration;
      }
      if (!merged.isrc && normalized.entry.isrc) merged.isrc = normalized.entry.isrc;
      entries[existingIndex] = merged;
      continue;
    }
    seen.set(key, entries.length);
    entries.push(normalized.entry);
  }

  return { entries, warnings, skippedCount };
};

const parseJsonText = (
  value: unknown,
  options: PlaylistImportOptions,
): { source: PlaylistImportSource; parsed?: ParsedText; error?: string; warnings: string[] } => {
  const parsedJson = parseJsonValue(value, options);
  if (!parsedJson.collection) {
    return {
      source: sourceHintFromOptions(options) || "unknown",
      error: parsedJson.error,
      warnings: parsedJson.warnings,
    };
  }

  const collection = parsedJson.collection;
  const source = collection.sourceHint || sourceHintFromOptions(options) || "json";
  const metadata = metadataFromRecord(collection.metadata, options);
  const candidates = collection.items.map((item, index) => candidateFromRecord(item, source, index));
  return {
    source,
    parsed: {
      candidates,
      warnings: parsedJson.warnings,
      skippedCount: 0,
      playlistName: metadata.playlistName,
      sourceUrl: metadata.sourceUrl,
      sourceId: metadata.sourceId,
    },
    warnings: [],
  };
};

const parseCsvRows = (
  input: string,
): { fields: string[]; line: number; malformed: boolean }[] => {
  const rows: { fields: string[]; line: number; malformed: boolean }[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowLine = 1;
  let line = 1;
  let fieldQuoted = false;

  const pushField = () => {
    fields.push(fieldQuoted ? field : field.trim());
    field = "";
    fieldQuoted = false;
  };

  const pushRow = (malformed = false) => {
    pushField();
    if (fields.some((item) => item.length > 0)) rows.push({ fields, line: rowLine, malformed });
    fields = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
      fieldQuoted = true;
    } else if (character === ",") {
      pushField();
    } else if (character === "\n") {
      pushRow();
      line += 1;
      rowLine = line;
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (inQuotes) {
    pushRow(true);
  } else if (field.length > 0 || fields.length > 0) {
    pushRow();
  }
  return rows;
};

const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["title", "name", "track", "trackname", "song", "songname", "tracktitle", "songtitle"],
  artist: ["artist", "artistname", "artists", "performer", "singer", "primaryartist", "author"],
  album: ["album", "albumname", "collection", "collectionname", "albumtitle"],
  duration: ["duration", "durationseconds", "durationms", "durationmillis", "durationmilliseconds", "tracktimemillis", "length", "time"],
  isrc: ["isrc", "recordingcode"],
  sourceUrl: ["sourceurl", "url", "link", "href", "trackviewurl", "webpageurl"],
  sourceId: ["sourceid", "id", "trackid", "songid", "persistentid"],
};

const findHeaderIndex = (headers: readonly string[], key: string): number => {
  const aliases = HEADER_ALIASES[key] || [];
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
};

const detectedCsvDelimiter = (input: string): string => {
  const firstLine = input.split(/\r?\n/, 1)[0] || "";
  if (!firstLine.includes(",") && firstLine.includes(";")) return ";";
  return ",";
};

const parseCsv = (input: string, options: PlaylistImportOptions): ParsedText => {
  const delimiter = detectedCsvDelimiter(input);
  const csvInput = delimiter === "," ? input : input.replace(/;/g, ",");
  const rows = parseCsvRows(csvInput);
  if (rows.length === 0) {
    return {
      candidates: [],
      warnings: ["The CSV does not contain any rows."],
      skippedCount: 0,
    };
  }

  const firstRow = rows[0];
  const firstHeaders = firstRow.fields.map(normalizeHeader);
  const looksLikeHeader = Object.values(HEADER_ALIASES).some((aliases) =>
    firstHeaders.some((header) => aliases.includes(header)),
  );
  const headerRow = looksLikeHeader ? firstRow : undefined;
  const headers = headerRow
    ? headerRow.fields
    : ["title", "artist", "album", "duration", "isrc", "sourceUrl", "sourceId"];
  const dataRows = headerRow ? rows.slice(1) : rows;
  const titleIndex = findHeaderIndex(headers, "title");
  const artistIndex = findHeaderIndex(headers, "artist");
  const albumIndex = findHeaderIndex(headers, "album");
  const durationIndex = findHeaderIndex(headers, "duration");
  const isrcIndex = findHeaderIndex(headers, "isrc");
  const sourceUrlIndex = findHeaderIndex(headers, "sourceUrl");
  const sourceIdIndex = findHeaderIndex(headers, "sourceId");
  const warnings: string[] = [];
  if (titleIndex < 0) warnings.push("The CSV has no title/name column; positional columns were used.");

  const candidates = dataRows.map((row, index) => {
    const get = (column: number): string | undefined => column >= 0 ? cleanText(row.fields[column]) : undefined;
    const positional = (column: number): string | undefined => cleanText(row.fields[column]);
    const durationHeader = durationIndex >= 0 ? normalizeHeader(headers[durationIndex]) : "duration";
    const rawDuration = get(durationIndex >= 0 ? durationIndex : 3);
    return {
      raw: row.fields,
      sourceIndex: index,
      sourceLine: row.line,
      title: get(titleIndex >= 0 ? titleIndex : 0) || positional(0),
      artist: get(artistIndex >= 0 ? artistIndex : 1) || positional(1),
      album: get(albumIndex >= 0 ? albumIndex : 2) || positional(2),
      duration: parseDuration(rawDuration, durationHeader),
      isrc: normalizeIsrc(get(isrcIndex >= 0 ? isrcIndex : 4)),
      sourceUrl: get(sourceUrlIndex >= 0 ? sourceUrlIndex : 5),
      sourceId: get(sourceIdIndex >= 0 ? sourceIdIndex : 6),
      malformed: row.malformed,
    };
  });

  const malformedWarnings = candidates
    .filter((candidate) => candidate.malformed)
    .map((candidate) => `Skipped line ${candidate.sourceLine}: the CSV row has an unterminated quoted field.`);
  const malformedCount = candidates.filter((candidate) => candidate.malformed).length;
  const candidateEntries: CandidateEntry[] = candidates.map((candidate) => ({
    raw: candidate.raw,
    sourceIndex: candidate.sourceIndex,
    sourceLine: candidate.sourceLine,
    sourceUrl: candidate.sourceUrl,
    sourceId: candidate.sourceId,
    title: candidate.title,
    artist: candidate.artist,
    album: candidate.album,
    duration: candidate.duration,
    isrc: candidate.isrc,
  }));

  return {
    candidates: candidateEntries.filter((_, index) => !candidates[index].malformed),
    warnings: [...warnings, ...malformedWarnings],
    skippedCount: malformedCount,
    playlistName: cleanText(options.playlistName),
    sourceUrl: cleanText(options.sourceUrl),
    sourceId: cleanText(options.sourceId),
  };
};

interface M3uPending {
  candidate: CandidateEntry;
  sourceLine: number;
}

const parseM3uDisplay = (display: string): { title?: string; artist?: string } => {
  const parts = splitArtistTitle(display);
  return {
    title: cleanText(parts.title),
    artist: cleanText(parts.artist),
  };
};

const parseExtinf = (line: string, sourceLine: number, artist?: string, album?: string): M3uPending => {
  const content = line.slice(line.indexOf(":") + 1);
  const commaIndex = content.indexOf(",");
  const durationText = commaIndex >= 0 ? content.slice(0, commaIndex).trim() : content.trim();
  const display = commaIndex >= 0 ? content.slice(commaIndex + 1).trim() : "";
  const metadata = parseM3uDisplay(display);
  return {
    sourceLine,
    candidate: {
      raw: line,
      sourceLine,
      title: metadata.title,
      artist: metadata.artist || artist,
      album,
      duration: parseDuration(durationText, "seconds"),
    },
  };
};

const parseM3u = (input: string, options: PlaylistImportOptions): ParsedText => {
  const candidates: CandidateEntry[] = [];
  const warnings: string[] = [];
  let skippedCount = 0;
  let pending: M3uPending | undefined;
  let pendingPlain: M3uPending | undefined;
  let directiveArtist: string | undefined;
  let directiveAlbum: string | undefined;
  let playlistName: string | undefined = cleanText(options.playlistName);
  let candidateIndex = 0;

  const addCandidate = (candidate: CandidateEntry) => {
    candidate.sourceIndex = candidateIndex;
    candidateIndex += 1;
    candidates.push(candidate);
  };

  const flush = (entry: M3uPending | undefined, sourceUrl?: string) => {
    if (!entry) return;
    if (sourceUrl) entry.candidate.sourceUrl = sourceUrl;
    addCandidate(entry.candidate);
  };

  const skipUrl = (lineNumber: number) => {
    skippedCount += 1;
    warnings.push(`Skipped line ${lineNumber}: a URL has no track metadata.`);
  };

  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach((rawLine, lineIndex) => {
    const sourceLine = lineIndex + 1;
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("#")) {
      const upper = line.toUpperCase();
      if (upper.startsWith("#PLAYLIST:")) {
        playlistName = cleanText(line.slice(line.indexOf(":") + 1)) || playlistName;
      } else if (upper.startsWith("#EXTINF:")) {
        flush(pending);
        flush(pendingPlain);
        pending = parseExtinf(line, sourceLine, directiveArtist, directiveAlbum);
        directiveArtist = undefined;
        directiveAlbum = undefined;
      } else if (upper.startsWith("#EXTART:")) {
        directiveArtist = cleanText(line.slice(line.indexOf(":") + 1));
      } else if (upper.startsWith("#EXTALB:") || upper.startsWith("#EXTGRP:")) {
        directiveAlbum = cleanText(line.slice(line.indexOf(":") + 1));
      }
      return;
    }

    if (isUrl(line)) {
      if (pending) {
        flush(pending, line);
        pending = undefined;
      } else if (pendingPlain) {
        flush(pendingPlain, line);
        pendingPlain = undefined;
      } else {
        skipUrl(sourceLine);
      }
      return;
    }

    if (pending) {
      flush(pending);
      pending = undefined;
    }
    if (pendingPlain) {
      flush(pendingPlain);
      pendingPlain = undefined;
    }

    if (isAudioPath(line)) {
      skipUrl(sourceLine);
      return;
    }

    const metadata = parseM3uDisplay(line);
    if (!metadata.title || isUrl(metadata.title)) {
      skippedCount += 1;
      warnings.push(`Skipped line ${sourceLine}: no usable track metadata was found.`);
      return;
    }
    pendingPlain = {
      sourceLine,
      candidate: {
        raw: line,
        sourceLine,
        title: metadata.title,
        artist: metadata.artist || directiveArtist,
        album: directiveAlbum,
      },
    };
    directiveArtist = undefined;
    directiveAlbum = undefined;
  });

  if (pending) flush(pending);
  if (pendingPlain) flush(pendingPlain);

  return {
    candidates,
    warnings,
    skippedCount,
    playlistName,
    sourceUrl: cleanText(options.sourceUrl),
    sourceId: cleanText(options.sourceId),
  };
};

const extensionFormat = (options: PlaylistImportOptions): PlaylistImportSource | undefined => {
  const hint = options.format || options.fileName || options.filename;
  const value = hint?.toLowerCase().trim();
  if (!value) return undefined;
  if (value.endsWith(".csv") || value === "csv") return "csv";
  if (value.endsWith(".m3u") || value.endsWith(".m3u8") || value === "m3u" || value === "m3u8") return "m3u";
  if (value.endsWith(".json") || value === "json") return "json";
  return normalizeSource(value);
};

const looksLikeJson = (input: string): boolean => {
  const trimmed = input.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{");
};

const looksLikeCsv = (input: string): boolean => {
  const lines = input.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return false;
  const first = lines[0];
  return first.includes(",") || first.includes(";") || lines.some((line) => line.includes(","));
};

const looksLikeM3u = (input: string): boolean => {
  const lines = input.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return false;
  if (lines.some((line) => /^#(?:EXTM3U|EXTINF|EXTART|EXTALB|EXTGRP|PLAYLIST):?/i.test(line))) return true;
  if (lines.some((line) => isUrl(line))) return true;
  return lines.some((line) => /\s+[-–—]\s+/.test(line));
};

const createResult = (
  source: PlaylistImportSource,
  playlistName: string,
  parsed: NormalizedCandidates,
  metadata: { sourceUrl?: string; sourceId?: string },
  error?: string,
): ImportedPlaylist => {
  const result: ImportedPlaylist = {
    source,
    playlistName,
    entries: parsed.entries,
    skippedCount: parsed.skippedCount,
    warnings: parsed.warnings,
  };
  if (metadata.sourceUrl) result.sourceUrl = metadata.sourceUrl;
  if (metadata.sourceId) result.sourceId = metadata.sourceId;
  if (error) result.error = error;
  return result;
};

/**
 * Parse a pasted export or already-decoded JSON object into normalized tracks.
 *
 * The function is synchronous and intentionally side-effect free.  It never
 * throws for malformed rows or unsupported input; inspect `error`,
 * `skippedCount`, and `warnings` for recoverable import feedback.
 */
export const parsePlaylistImport = (
  input: PlaylistImportInput,
  options: PlaylistImportOptions = {},
): ImportedPlaylist => {
  const optionSource = sourceHintFromOptions(options);
  const format = extensionFormat(options) || optionSource;
  const fallbackName = cleanText(options.playlistName) || DEFAULT_PLAYLIST_NAME;

  if (input === null || input === undefined || (typeof input === "string" && !input.trim())) {
    return createResult(
      optionSource || "unknown",
      fallbackName,
      { entries: [], warnings: [], skippedCount: 0 },
      { sourceUrl: cleanText(options.sourceUrl), sourceId: cleanText(options.sourceId) },
      "No playlist data was provided.",
    );
  }

  if (typeof input === "string") {
    const text = input.replace(/^\uFEFF/, "");
    const detected = format || (looksLikeJson(text) ? "json" : looksLikeM3u(text) ? "m3u" : looksLikeCsv(text) ? "csv" : undefined);

    if (detected === "csv") {
      const parsed = parseCsv(text, options);
      const source = optionSource && optionSource !== "json" ? optionSource : "csv";
      const playlistName = parsed.playlistName || fallbackName;
      const normalized = normalizeCandidates(parsed.candidates, source, playlistName, parsed.warnings, parsed.skippedCount);
      const error = normalized.entries.length === 0 ? "No valid playlist entries were found in the CSV." : undefined;
      return createResult(source, playlistName, normalized, {
        sourceUrl: parsed.sourceUrl || cleanText(options.sourceUrl),
        sourceId: parsed.sourceId || cleanText(options.sourceId),
      }, error);
    }

    if (detected === "m3u") {
      const parsed = parseM3u(text, options);
      const playlistName = parsed.playlistName || fallbackName;
      const normalized = normalizeCandidates(parsed.candidates, "m3u", playlistName, parsed.warnings, parsed.skippedCount);
      const error = normalized.entries.length === 0 ? "No valid playlist entries were found in the M3U playlist." : undefined;
      return createResult("m3u", playlistName, normalized, {
        sourceUrl: parsed.sourceUrl || cleanText(options.sourceUrl),
        sourceId: parsed.sourceId || cleanText(options.sourceId),
      }, error);
    }

    if (detected === "json" || optionSource === "spotify" || optionSource === "youtube-music" || optionSource === "apple-music" || optionSource === "itunes") {
      const json = parseJsonText(text, options);
      if (!json.parsed) {
        return createResult(
          json.source,
          fallbackName,
          { entries: [], warnings: json.warnings, skippedCount: 0 },
          { sourceUrl: cleanText(options.sourceUrl), sourceId: cleanText(options.sourceId) },
          json.error,
        );
      }
      const parsed = json.parsed;
      const playlistName = parsed.playlistName || fallbackName;
      const normalized = normalizeCandidates(parsed.candidates, json.source, playlistName, parsed.warnings, parsed.skippedCount);
      const error = normalized.entries.length === 0 ? "No valid playlist entries were found in the JSON." : undefined;
      return createResult(json.source, playlistName, normalized, {
        sourceUrl: parsed.sourceUrl || cleanText(options.sourceUrl),
        sourceId: parsed.sourceId || cleanText(options.sourceId),
      }, error);
    }

    return createResult(
      optionSource || "unknown",
      fallbackName,
      { entries: [], warnings: ["The playlist text is not a supported JSON, CSV, or M3U format."], skippedCount: 0 },
      { sourceUrl: cleanText(options.sourceUrl), sourceId: cleanText(options.sourceId) },
      "This playlist format is not supported.",
    );
  }

  const json = parseJsonText(input, options);
  if (!json.parsed) {
    return createResult(
      json.source,
      fallbackName,
      { entries: [], warnings: json.warnings, skippedCount: 0 },
      { sourceUrl: cleanText(options.sourceUrl), sourceId: cleanText(options.sourceId) },
      json.error,
    );
  }

  const parsed = json.parsed;
  const playlistName = parsed.playlistName || fallbackName;
  const normalized = normalizeCandidates(parsed.candidates, json.source, playlistName, parsed.warnings, parsed.skippedCount);
  const error = normalized.entries.length === 0 ? "No valid playlist entries were found in the structured playlist." : undefined;
  return createResult(json.source, playlistName, normalized, {
    sourceUrl: parsed.sourceUrl || cleanText(options.sourceUrl),
    sourceId: parsed.sourceId || cleanText(options.sourceId),
  }, error);
};

export default parsePlaylistImport;
