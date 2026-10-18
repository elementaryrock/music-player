/** Provider-neutral metadata discovery entry point for app integration. */
export {
  calculateRelevanceScore,
  createDedupeKey,
  createTrackDedupeKey,
  dedupeAndRankResults,
  mergeSearchResults,
  normalizeArtist,
  normalizeSearchText,
  normalizeTitle,
  rankSearchResults,
  searchGlobalTracks,
  searchMetadata,
} from "./searchEngine";
export type {
  SearchEngineConfig,
  SearchProvider,
  SearchResult,
  SearchState,
} from "./searchEngine";

export {
  ITUNES_SEARCH_URL,
  mapITunesResult,
  mapITunesSong,
  mapITunesSongToMetadata,
  mapITunesSongToSearchResult,
  searchITunes,
  searchITunesSongs,
  upgradeITunesArtworkUrl,
} from "./itunesApi";
export type {
  ITunesSearchOptions,
  ITunesSearchResponse,
  ITunesSong,
} from "./itunesApi";

export type {
  AudioCandidate,
  AudioProvider,
  DiscoveryProvider,
  ProviderMetadata,
  UnifiedTrackMetadata,
} from "../types/discovery.types";
