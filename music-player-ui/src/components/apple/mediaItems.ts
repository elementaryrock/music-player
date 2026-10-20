import type { Track } from "../../types/api.types";
import type { SearchResult } from "../../services/searchEngine";
import { normalizeSearchText } from "../../services/textNormalization.ts";

/** Anything the browse surface can show: a queued track or a metadata result. */
export type MediaItem = Track | SearchResult;

export const isSearchResult = (item: MediaItem): item is SearchResult =>
  "confidence" in item;

export const getArtworkUrl = (item: MediaItem): string | undefined => {
  if (isSearchResult(item)) return item.artworkUrl || item.imageUrl;
  return item.albumArtUrl;
};

export const getAlbumLabel = (item: MediaItem): string => item.album || "Single";

/** The album a card represents, falling back to the track title for singles. */
export const getAlbumTitle = (item: MediaItem): string =>
  (item.album || item.title || "").trim();

/**
 * Reduce a list of tracks to one entry per album so a shelf of albums never
 * shows the same release twice.
 */
export const dedupeByAlbum = (items: MediaItem[]): MediaItem[] => {
  const seen = new Set<string>();
  const unique: MediaItem[] = [];

  items.forEach((item) => {
    const key = normalizeSearchText(getAlbumTitle(item)) || normalizeSearchText(item.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique;
};
