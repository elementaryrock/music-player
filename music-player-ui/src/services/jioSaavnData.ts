/**
 * Normalizers for the response shape documented by the JioSaavn API.
 *
 * The API returns artists as an object containing `primary`, `featured`, and
 * `all` arrays, and full-track URLs in `downloadUrl[].url`. Keeping these
 * adapters separate makes the playback resolver testable without a network
 * request and prevents a metadata-shape change from silently forcing an
 * iTunes preview.
 */

type JioArtistCollections = {
  primary?: unknown;
  featured?: unknown;
  all?: unknown;
};

export interface JioSearchQueryInput {
  title: string;
  artist?: string;
  primaryArtist?: string;
  album?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? value as Record<string, unknown> : undefined;

const asNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const decodeCommonHtmlEntities = (value: string): string =>
  value
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ");

/**
 * iTunes commonly appends a soundtrack marker such as `(From "Brahmastra")`
 * while JioSaavn stores the same recording as simply `Kesariya`. This is a
 * catalog label, not a recording-version marker, so it is safe to compare the
 * title both with and without this suffix.
 */
const stripSafeCatalogSuffix = (value: string): string => {
  let stripped = decodeCommonHtmlEntities(value).trim();
  let previous = "";

  // Jio/iTunes disagree on soundtrack labels. These suffixes identify the
  // source release and do not identify a different performance. Repeat so
  // `Title (From "Film") [Original Motion Picture Soundtrack]` is handled
  // without touching version labels such as `(Live)` or `(Remix)`.
  while (stripped && stripped !== previous) {
    previous = stripped;
    stripped = stripped
      .replace(
        /\s*(?:\(|\[)\s*from\b[^)\]]*(?:\)|\])\s*$/i,
        ""
      )
      .replace(
        /\s*(?:\(|\[)\s*original\s+motion\s+picture\s+soundtrack\s*(?:\)|\])\s*$/i,
        ""
      )
      .replace(/\s+[-–—]\s*from\b.+$/i, "")
      .trim();
  }

  return stripped;
};

const normalizeTitleForMatch = (value: string): string =>
  decodeCommonHtmlEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleVariantsForMatch = (value: string): string[] => {
  const variants = [
    value,
    stripSafeCatalogSuffix(value),
  ];

  return variants
    .map(normalizeTitleForMatch)
    .filter((variant, index, all) => variant && all.indexOf(variant) === index);
};

/** Compare catalog titles while preserving live/remix/karaoke distinctions. */
export const jioTitlesMatch = (left: unknown, right: unknown): boolean => {
  const leftText = asNonEmptyString(left);
  const rightText = asNonEmptyString(right);
  if (!leftText || !rightText) return false;

  const leftVariants = new Set(titleVariantsForMatch(leftText));
  const rightVariants = new Set(titleVariantsForMatch(rightText));

  return [...leftVariants].some((variant) => variant && rightVariants.has(variant));
};

const artistNamesFromArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((artist) =>
      typeof artist === "string"
        ? asNonEmptyString(artist)
        : asNonEmptyString(asRecord(artist)?.name)
    )
    .filter((name): name is string => Boolean(name));
};

const performerNamesFromAllCredits = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((artist) => {
      const role = asNonEmptyString(asRecord(artist)?.role);
      return role
        ? /^(?:primary|featured|secondary|supporting|lead|background)?_?artists?$|^(?:singer|vocalist|performer)$/i.test(role)
        : false;
    })
    .map((artist) => asNonEmptyString(asRecord(artist)?.name))
    .filter((name): name is string => Boolean(name));
};

const uniqueNames = (names: string[]): string[] =>
  names.filter((name, index) => names.indexOf(name) === index);

const getJioArtistCollections = (
  song: Record<string, unknown>
): JioArtistCollections | undefined =>
  asRecord(song.artists) as JioArtistCollections | undefined;

const getDirectArtistNames = (song: Record<string, unknown>): string[] =>
  uniqueNames(
    [song.primaryArtists, song.artist, song.singers]
      .map(asNonEmptyString)
      .filter((name): name is string => Boolean(name))
  );

/** Return the primary artist credits without falling back to composers/lyricists. */
export const getJioPrimaryArtistNames = (song: Record<string, unknown>): string[] => {
  const artists = song.artists;
  if (Array.isArray(artists)) return uniqueNames(artistNamesFromArray(artists));

  const collections = getJioArtistCollections(song);
  const primary = collections ? uniqueNames(artistNamesFromArray(collections.primary)) : [];
  if (primary.length > 0) return primary;

  return collections ? [] : getDirectArtistNames(song).slice(0, 1);
};

/** Return featured artist credits from the documented nested response. */
export const getJioFeaturedArtistNames = (song: Record<string, unknown>): string[] => {
  const collections = getJioArtistCollections(song);
  return collections ? uniqueNames(artistNamesFromArray(collections.featured)) : [];
};

/**
 * Return display artist names while keeping `artists.all` as a last-resort
 * compatibility fallback. Playback matching uses primary/featured only, since
 * `all` also contains composers and lyricists who are not performers.
 */
export const getJioArtistNames = (song: Record<string, unknown>): string[] => {
  const artists = song.artists;
  if (Array.isArray(artists)) return uniqueNames(artistNamesFromArray(artists));

  const collections = getJioArtistCollections(song);
  const primaryAndFeatured = collections
    ? uniqueNames([
        ...artistNamesFromArray(collections.primary),
        ...artistNamesFromArray(collections.featured),
      ])
    : [];
  if (primaryAndFeatured.length > 0) return primaryAndFeatured;

  const directNames = getDirectArtistNames(song);
  if (directNames.length > 0) return directNames;

  return collections ? uniqueNames(artistNamesFromArray(collections.all)) : [];
};

/** Return only credits that can identify a performing artist. */
export const getJioPlayableArtistNames = (song: Record<string, unknown>): string[] => {
  const primary = getJioPrimaryArtistNames(song);
  const featured = getJioFeaturedArtistNames(song);
  if (primary.length > 0 || featured.length > 0) {
    return uniqueNames([...primary, ...featured]);
  }

  const collections = getJioArtistCollections(song);
  const performerAll = collections
    ? performerNamesFromAllCredits(collections.all)
    : [];
  return uniqueNames([...getDirectArtistNames(song), ...performerAll]);
};

const splitArtistCredits = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];

  return uniqueNames([
    trimmed,
    ...trimmed
      .split(/\s+(?:feat\.?|ft\.?|featuring|with)\s+/i)
      .flatMap((part) => part.split(/\s*[,/&]\s*/))
      .map((part) => part.trim())
      .filter(Boolean),
  ]);
};

const normalizeArtistForMatch = (value: string): string =>
  normalizeTitleForMatch(value).replace(/^the\s+/, "").trim();

const artistMatchVariants = (value: string): string[] => {
  const variants = splitArtistCredits(value).map(normalizeArtistForMatch);
  return variants.filter((variant, index, all) => variant && all.indexOf(variant) === index);
};

/**
 * Conservative artist alias score. A short stage name may be credited with a
 * legal-name suffix (`Sia`/`Sia Furler`), while unrelated artists still need a
 * full title and duration match before a stream can be selected.
 */
export const jioArtistMatchScore = (
  requested: unknown,
  candidates: unknown
): number => {
  const requestedNames = typeof requested === "string"
    ? artistMatchVariants(requested)
    : [];
  const candidateValues = Array.isArray(candidates)
    ? candidates.filter((value): value is string => typeof value === "string")
    : typeof candidates === "string"
      ? [candidates]
      : [];
  const candidateNames = candidateValues.flatMap(artistMatchVariants);
  if (requestedNames.length === 0 || candidateNames.length === 0) return 0;

  let best = 0;
  for (const left of requestedNames) {
    for (const right of candidateNames) {
      if (left === right) {
        best = Math.max(best, 1);
        continue;
      }

      const leftTokens = left.split(" ");
      const rightTokens = right.split(" ");
      const shorter = leftTokens.length <= rightTokens.length ? left : right;
      const longer = shorter === left ? right : left;
      if (
        shorter.length >= 3 &&
        (longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`))
      ) {
        best = Math.max(best, 0.9);
        continue;
      }

      const leftSet = new Set(leftTokens);
      const rightSet = new Set(rightTokens);
      const shared = [...leftSet].filter((token) => rightSet.has(token)).length;
      const union = new Set([...leftSet, ...rightSet]).size;
      if (union > 0) best = Math.max(best, shared / union);
    }
  }

  return best;
};

const VERSION_MARKER =
  /\b(?:cover|karaoke|instrumental|remix|live|acoustic|tribute|rework|demo|sped\s*up|slowed|nightcore|lo[\s-]?fi|piano|orchestral|mashup|medley|originally\s+performed|version|edit|alternate|extended|radio)\b/i;

const hasMatchingVersionMarkers = (requested: string, candidate: string): boolean => {
  const markers = candidate.match(new RegExp(VERSION_MARKER.source, "gi")) ?? [];
  return markers.every((marker) =>
    new RegExp(`\\b${marker.replace(/\\s+/g, "\\\\s*")}\\b`, "i").test(requested)
  );
};

const getJioAlbumText = (song: Record<string, unknown>): string => {
  const album = asRecord(song.album);
  return asNonEmptyString(album?.name ?? album?.title) ?? asNonEmptyString(song.album) ?? "";
};

/**
 * Reject alternate performances before URL selection. The requested title may
 * explicitly name a version, so a marker is only tolerated when it is present
 * in the requested title too; an album/language marker alone is never allowed
 * to turn a canonical song into a cover or instrumental.
 */
export const isJioVersionSafe = (
  requestedTitle: unknown,
  song: Record<string, unknown>
): boolean => {
  const requested = asNonEmptyString(requestedTitle) ?? "";
  const candidateTitle = asNonEmptyString(song.name ?? song.title) ?? "";
  const candidateArtist = getJioPlayableArtistNames(song).join(", ");
  const candidateAlbum = getJioAlbumText(song);
  const language = asNonEmptyString(song.language) ?? "";
  const label = asNonEmptyString(song.label) ?? "";

  if (VERSION_MARKER.test(candidateArtist)) return false;
  if (VERSION_MARKER.test(candidateTitle) && !hasMatchingVersionMarkers(requested, candidateTitle)) return false;
  if (VERSION_MARKER.test(candidateAlbum) && !hasMatchingVersionMarkers(requested, candidateAlbum)) return false;
  if (VERSION_MARKER.test(label) && !hasMatchingVersionMarkers(requested, label)) return false;
  if (/^instrumental$/i.test(language) && !/\binstrumental\b/i.test(requested)) {
    return false;
  }

  return true;
};

const uniqueQueries = (queries: string[]): string[] => {
  const seen = new Set<string>();
  return queries
    .map((query) => query.trim().replace(/\s+/g, " "))
    .filter((query) => {
      const key = normalizeTitleForMatch(query);
      if (!query || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/** Build bounded title/artist variants for Jio's relevance-sensitive search. */
export const buildJioSearchQueries = (input: JioSearchQueryInput): string[] => {
  const title = input.title.trim();
  if (!title) return [];

  const baseTitle = stripSafeCatalogSuffix(title);
  const titleVariants = uniqueQueries([title, baseTitle]);
  const primaryArtist = input.primaryArtist?.trim() || input.artist?.trim() || "";
  const fullArtist = input.artist?.trim() || primaryArtist;
  const artists = uniqueQueries([primaryArtist, fullArtist]);
  const album = input.album?.trim() ?? "";
  const queries: string[] = [];

  for (const titleVariant of titleVariants) {
    if (primaryArtist) queries.push(`${titleVariant} ${primaryArtist}`);
    if (fullArtist && fullArtist !== primaryArtist) {
      queries.push(`${titleVariant} ${fullArtist}`);
    }
    if (primaryArtist) queries.push(`${primaryArtist} ${titleVariant}`);
    if (album) queries.push(`${titleVariant} ${primaryArtist} ${album}`);
    queries.push(titleVariant);
  }

  return uniqueQueries([...queries, ...artists.map((artist) => `${artist} ${title}`)]).slice(0, 6);
};

/** Return a stable artist string suitable for strict title/artist matching. */
export const getJioArtistText = (song: Record<string, unknown>): string =>
  getJioArtistNames(song).join(", ");

/**
 * Select the highest quality documented JioSaavn download URL. The API lists
 * qualities from low to high, but the helper also accepts an unsorted response.
 */
export const getJioAudioUrl = (song: Record<string, unknown>): string | undefined => {
  const direct = asNonEmptyString(song.audioUrl) ?? asNonEmptyString(song.audioSrc);
  if (direct) return direct;

  if (typeof song.downloadUrl === "string") {
    return asNonEmptyString(song.downloadUrl);
  }

  if (!Array.isArray(song.downloadUrl)) return undefined;

  const candidates = song.downloadUrl
    .map((item) => {
      if (typeof item === "string") {
        return { quality: "", url: asNonEmptyString(item) };
      }
      const record = asRecord(item);
      return {
        quality: asNonEmptyString(record?.quality) ?? "",
        url: asNonEmptyString(record?.url) ?? asNonEmptyString(record?.link),
      };
    })
    .filter((candidate): candidate is { quality: string; url: string } => Boolean(candidate.url));

  const qualityValue = (quality: string): number => {
    const match = quality.match(/(\d+)\s*kbps/i);
    return match ? Number(match[1]) : 0;
  };

  return candidates
    .sort((left, right) => qualityValue(right.quality) - qualityValue(left.quality))[0]?.url;
};
