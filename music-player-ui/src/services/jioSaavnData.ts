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
const stripCatalogSourceSuffix = (value: string): string =>
  decodeCommonHtmlEntities(value)
    .replace(/\s*(?:\(|\[)\s*from\b[\s\S]*?(?:\)|\])\s*$/i, "")
    .trim();

const normalizeTitleForMatch = (value: string): string =>
  decodeCommonHtmlEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Compare catalog titles while preserving live/remix/karaoke distinctions. */
export const jioTitlesMatch = (left: unknown, right: unknown): boolean => {
  const leftText = asNonEmptyString(left);
  const rightText = asNonEmptyString(right);
  if (!leftText || !rightText) return false;

  const leftVariants = new Set([
    normalizeTitleForMatch(leftText),
    normalizeTitleForMatch(stripCatalogSourceSuffix(leftText)),
  ]);
  const rightVariants = new Set([
    normalizeTitleForMatch(rightText),
    normalizeTitleForMatch(stripCatalogSourceSuffix(rightText)),
  ]);

  return [...leftVariants].some((variant) => variant && rightVariants.has(variant));
};

const artistNamesFromArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((artist) => asNonEmptyString(asRecord(artist)?.name))
    .filter((name): name is string => Boolean(name));
};

const uniqueNames = (names: string[]): string[] =>
  names.filter((name, index) => names.indexOf(name) === index);

/** Return the primary/featured artist names from a documented Jio song. */
export const getJioArtistNames = (song: Record<string, unknown>): string[] => {
  const directNames = [song.primaryArtists, song.artist, song.singers]
    .map(asNonEmptyString)
    .filter((name): name is string => Boolean(name));
  if (directNames.length > 0) return uniqueNames(directNames);

  const artists = song.artists;
  if (Array.isArray(artists)) {
    return uniqueNames(artistNamesFromArray(artists));
  }

  const collections = asRecord(artists) as JioArtistCollections | undefined;
  if (!collections) return [];

  const primaryAndFeatured = uniqueNames([
    ...artistNamesFromArray(collections.primary),
    ...artistNamesFromArray(collections.featured),
  ]);
  return primaryAndFeatured.length > 0
    ? primaryAndFeatured
    : uniqueNames(artistNamesFromArray(collections.all));
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
