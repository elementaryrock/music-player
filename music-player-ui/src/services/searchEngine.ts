/**
 * Enhanced Search Engine Service
 * 
 * Provides intelligent search functionality with debouncing, caching,
 * multi-source support, and error handling.
 */

import { searchSongs as searchJioSaavn } from './api';
import { searchTidalSongs } from './tidalApi';
import { searchITunesSongs } from './itunesApi';
import type {
  AudioCandidate,
  DiscoveryProvider,
  ProviderMetadata,
  StreamQuality,
  UnifiedTrackMetadata,
} from '../types/discovery.types';
import type { Track } from '../types/api.types';

export type SearchProvider = DiscoveryProvider;

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  primaryArtist?: string;
  album?: string;
  duration?: number;
  source: SearchProvider;
  imageUrl?: string;
  artworkUrl?: string;
  audioUrl?: string;
  audioCandidates?: AudioCandidate[];
  metadataSource?: DiscoveryProvider;
  explicit?: boolean;
  popularity?: number;
  rank?: number;
  isrc?: string;
  providerMetadata?: ProviderMetadata;
  providers?: ProviderMetadata[];
  quality?: StreamQuality;
  streamMatchConfidence?: number;
  confidence: number; // Relevance score 0-1
  originalData?: any; // Store original API response
}

export interface SearchEngineConfig {
  debounceMs: number;
  maxResults: number;
  enableSuggestions: boolean;
  sources: SearchProvider[];
  cacheTimeout: number; // Cache TTL in milliseconds
  retryAttempts: number;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  suggestions: string[];
  filters: {
    source: 'all' | 'jiosaavn' | 'tidal';
    duration: 'any' | 'short' | 'medium' | 'long';
    quality: 'any' | 'high' | 'lossless';
  };
  history: string[];
}

interface CacheEntry {
  results: SearchResult[];
  timestamp: number;
  query: string;
}

/** Normalize text for search keys without discarding version labels. */
export const normalizeSearchText = (value: unknown): string =>
  (typeof value === 'string' ? value : value == null ? '' : String(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeTitle = normalizeSearchText;
export const normalizeArtist = normalizeSearchText;

const primaryArtistForKey = (artist: string): string =>
  normalizeArtist(artist)
    .split(/\s+(?:feat|ft)\.?\s+/i)[0]
    .split(/\s*[,/&]\s*/)[0]
    .trim();

export const createTrackDedupeKey = (title: string, artist: string): string =>
  `${normalizeTitle(title)}_${primaryArtistForKey(artist)}`;

export const createDedupeKey = createTrackDedupeKey;

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

const parseSearchQuery = (query: string): { title: string; artist?: string } => {
  const trimmed = query.trim();
  const byMatch = trimmed.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) return { title: byMatch[1].trim(), artist: byMatch[2].trim() };

  const dashMatch = trimmed.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) return { title: dashMatch[2].trim(), artist: dashMatch[1].trim() };

  return { title: trimmed };
};

const tokenSimilarity = (left: string, right: string): number => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.72;
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? shared / union : 0;
};

const popularityBoost = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  // Tidal popularity is generally 0..100; Jio play counts can be much larger.
  const normalized = numeric > 100 ? Math.min(1, Math.log10(numeric + 1) / 10) : numeric / 100;
  return clamp(normalized) * 0.12;
};

const resultVersionPenalty = (title: string, query: string): number => {
  const normalizedTitle = normalizeTitle(title);
  const normalizedQuery = normalizeTitle(query);
  const versionTerms = [
    'cover',
    'tribute',
    'karaoke',
    'remix',
    'live',
    'acoustic',
    'instrumental',
    'demo',
    'rework',
    'edit',
    'version',
    'sped up',
    'slowed',
  ];
  return versionTerms.some((term) => normalizedTitle.includes(term) && !normalizedQuery.includes(term))
    ? 0.22
    : 0;
};

/** Deterministic 0..1 relevance score used for every metadata provider. */
export const calculateRelevanceScore = (
  result: Pick<SearchResult, 'title' | 'artist' | 'source' | 'popularity' | 'rank' | 'primaryArtist'>,
  query: string,
  index = result.rank ?? 0
): number => {
  const parsed = parseSearchQuery(query);
  const normalizedTitle = normalizeTitle(result.title);
  const normalizedArtist = normalizeArtist(result.primaryArtist || result.artist);
  const normalizedTitleQuery = normalizeTitle(parsed.title);
  const normalizedRawQuery = normalizeTitle(query);

  const titleScore = normalizedTitle === normalizedTitleQuery
    ? 1
    : tokenSimilarity(normalizedTitle, normalizedTitleQuery);
  const requestedArtist = parsed.artist ? normalizeArtist(parsed.artist) : undefined;
  let artistScore = requestedArtist
    ? tokenSimilarity(normalizedArtist, requestedArtist)
    : normalizedArtist === normalizedRawQuery
      ? 1
      : normalizedRawQuery.includes(normalizedArtist) && normalizedArtist.length > 2
        ? 0.75
        : 0;

  // A query that names an artist should penalize unrelated artists strongly,
  // even when their titles happen to contain the query terms.
  const artistPenalty = requestedArtist && artistScore < 0.45 ? 0.18 : 0;
  artistScore = clamp(artistScore);
  const rankBoost = clamp(1 - Math.max(0, index) / 20) * 0.08;
  const providerBoost = result.source === 'tidal' ? 0.04 : result.source === 'itunes' ? 0.02 : 0;
  const versionPenalty = resultVersionPenalty(result.title, query);

  return clamp(
    titleScore * 0.57 + artistScore * 0.24 + popularityBoost(result.popularity) +
      rankBoost + providerBoost - versionPenalty - artistPenalty
  );
};

export const mergeSearchResults = (
  results: SearchResult[],
  query: string,
  maxResults = results.length
): SearchResult[] => {
  const merged = new Map<string, SearchResult>();
  const providerPriority: Record<SearchProvider, number> = { tidal: 3, itunes: 2, jiosaavn: 1 };

  results.forEach((input, index) => {
    const scored: SearchResult = {
      ...input,
      confidence: calculateRelevanceScore(input, query, input.rank ?? index),
    };
    const key = createTrackDedupeKey(scored.title, scored.primaryArtist || scored.artist);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, scored);
      return;
    }

    const existingProviderPriority = providerPriority[existing.source];
    const scoredProviderPriority = providerPriority[scored.source];
    const scoreDelta = scored.confidence - existing.confidence;
    // Keep the preferred metadata provider canonical when scores are close;
    // only a materially stronger relevance score can displace it.
    const shouldReplace = scoreDelta > 0.08 ||
      (Math.abs(scoreDelta) <= 0.08 && scoredProviderPriority > existingProviderPriority);
    const winner = shouldReplace ? scored : existing;
    const loser = shouldReplace ? existing : scored;
    const candidateUrls = [
      ...(winner.audioCandidates || []),
      ...(loser.audioCandidates || []),
    ];
    const audioCandidates = candidateUrls.length > 0
      ? candidateUrls.filter((candidate, candidateIndex, all) =>
          all.findIndex((item) => item.source === candidate.source && item.url === candidate.url) === candidateIndex
        )
      : undefined;
    const providers = [
      ...(winner.providers || (winner.providerMetadata ? [winner.providerMetadata] : [])),
      ...(loser.providers || (loser.providerMetadata ? [loser.providerMetadata] : [])),
    ].filter((provider, providerIndex, all) =>
      all.findIndex((item) => item.provider === provider.provider && item.providerId === provider.providerId) === providerIndex
    );

    merged.set(key, {
      ...loser,
      ...winner,
      // Keep metadata that exists only on the lower-scoring provider.
      primaryArtist: winner.primaryArtist || loser.primaryArtist,
      album: winner.album || loser.album,
      imageUrl: winner.imageUrl || loser.imageUrl,
      artworkUrl: winner.artworkUrl || loser.artworkUrl,
      duration: winner.duration ?? loser.duration,
      explicit: winner.explicit ?? loser.explicit,
      isrc: winner.isrc || loser.isrc,
      audioUrl: winner.audioUrl || (winner.source === loser.source ? loser.audioUrl : undefined),
      metadataSource: winner.metadataSource || loser.metadataSource,
      providerMetadata: winner.providerMetadata || loser.providerMetadata,
      audioCandidates,
      providers: providers.length ? providers : undefined,
      confidence: Math.max(winner.confidence, loser.confidence),
    });
  });

  return [...merged.values()]
    .sort((left, right) =>
      right.confidence - left.confidence ||
      (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id)
    )
    .slice(0, Math.max(0, maxResults));
};

export const dedupeAndRankResults = mergeSearchResults;
export const rankSearchResults = mergeSearchResults;

export class SearchEngine {
  private config: SearchEngineConfig;
  private cache = new Map<string, CacheEntry>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private searchHistory: string[] = [];
  private abortController: AbortController | null = null;

  constructor(config: Partial<SearchEngineConfig> = {}) {
    this.config = {
      debounceMs: 300,
      maxResults: 20,
      enableSuggestions: true,
      // Metadata indexes are primary. JioSaavn is deliberately last and is
      // only a supplemental/fallback source for discovery and playback.
      sources: ['tidal', 'itunes', 'jiosaavn'],
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      retryAttempts: 3,
      ...config,
    };

    // Load search history from localStorage
    this.loadSearchHistory();
  }

  /**
   * Main search method with debouncing and caching
   */
  async search(
    query: string,
    options: {
      sources?: SearchProvider[];
      maxResults?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      return [];
    }

    const sources = options.sources || this.config.sources;
    const maxResults = options.maxResults || this.config.maxResults;
    const cacheKey = this.getCacheKey(trimmedQuery, sources, maxResults);

    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
      const cached = this.getCachedResults(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Cancel any ongoing search
    if (this.abortController) {
      this.abortController.abort();
    }
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const signal = controller.signal;
      const searchTasks: Array<{
        source: SearchProvider;
        promise: Promise<SearchResult[]>;
      }> = [];

      // Tidal and iTunes are metadata indexes. JioSaavn is intentionally
      // supplemental and is never needed for a healthy default search.
      if (sources.includes('tidal')) {
        searchTasks.push({
          source: 'tidal',
          promise: this.withAbort(this.searchTidal(trimmedQuery, maxResults), signal),
        });
      }
      if (sources.includes('itunes')) {
        searchTasks.push({
          source: 'itunes',
          promise: this.withAbort(this.searchITunes(trimmedQuery, maxResults, signal), signal),
        });
      }
      if (sources.includes('jiosaavn')) {
        searchTasks.push({
          source: 'jiosaavn',
          promise: this.withAbort(this.searchJioSaavn(trimmedQuery, maxResults), signal),
        });
      }

      const results = await Promise.allSettled(searchTasks.map((task) => task.promise));

      // A newer search or destroy() may have superseded this request. Return a
      // safe empty result instead of allowing stale providers to update UI.
      if (signal.aborted) return [];

      const allResults: SearchResult[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          console.warn(`Search failed for source ${searchTasks[index]?.source}:`, result.reason);
        }
      });

      const processedResults = this.processResults(allResults, trimmedQuery, maxResults);

      // Cache results
      this.cacheResults(cacheKey, processedResults, trimmedQuery);

      // Add to search history
      this.addToHistory(trimmedQuery);

      return processedResults;

    } catch (error) {
      console.error('Search engine error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Debounced search method
   */
  searchDebounced(
    query: string,
    callback: (results: SearchResult[]) => void,
    errorCallback?: (error: Error) => void
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        const results = await this.search(query);
        callback(results);
      } catch (error) {
        if (errorCallback) {
          errorCallback(error instanceof Error ? error : new Error('Search failed'));
        }
      }
    }, this.config.debounceMs);
  }

  /**
   * Search JioSaavn with error handling and retry logic
   */
  private async searchJioSaavn(query: string, maxResults: number): Promise<SearchResult[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await searchJioSaavn(query, 0, maxResults);
        
        if (!response?.results) {
          throw new Error('Invalid JioSaavn response structure');
        }

        return response.results.map((song: any, index: number): SearchResult => {
          const audioUrl = this.extractAudioUrl(song);
          const providerMetadata: ProviderMetadata = {
            provider: 'jiosaavn',
            providerId: song.id,
            rank: index,
            popularity: this.toNumber(song.playCount || song.popularity),
            isrc: this.extractIsrc(song),
            sourceUrl: typeof song.url === 'string' ? song.url : undefined,
            raw: song,
          };
          const artist = this.extractArtistName(song);
          const primaryArtist = this.extractPrimaryArtist(artist);
          const title = song.name || song.title || 'Unknown Title';
          return {
            id: `jiosaavn_${song.id ?? index}`,
            title,
            artist,
            primaryArtist,
            album: song.album?.name || song.album || undefined,
            duration: this.parseDuration(song.duration),
            source: 'jiosaavn',
            metadataSource: 'jiosaavn',
            imageUrl: this.extractImageUrl(song),
            artworkUrl: this.extractImageUrl(song),
            audioUrl,
            audioCandidates: audioUrl
              ? [{ source: 'jiosaavn', url: audioUrl, quality: 'standard', providerMetadata }]
              : undefined,
            explicit: this.parseExplicit(song.explicitContent),
            popularity: providerMetadata.popularity,
            rank: index,
            isrc: providerMetadata.isrc,
            providerMetadata,
            providers: [providerMetadata],
            confidence: this.calculateConfidence({ ...song, title, artist, primaryArtist, source: 'jiosaavn' }, query, index),
            originalData: song,
          };
        });

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('JioSaavn search failed');
        console.warn(`JioSaavn search attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await this.wait(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // If all retries failed, log error but don't throw (allow other sources to work)
    console.error('JioSaavn search failed after all retries:', lastError);
    return [];
  }

  /**
   * Search Tidal with error handling and retry logic (now using HiFi API)
   */
  private async searchTidal(query: string, maxResults: number): Promise<SearchResult[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Metadata only: stream resolution is intentionally deferred to
        // resolveTrackStream so a metadata outage never becomes an audio
        // provider dependency.
        const response = await searchTidalSongs(query, maxResults, 0);
        if (response?.items && Array.isArray(response.items)) {
          return response.items.map((track: any, index: number): SearchResult => {
            const artist = this.extractTidalArtist(track);
            const title = track.title || 'Unknown Title';
            const providerMetadata: ProviderMetadata = {
              provider: 'tidal',
              providerId: track.id,
              rank: index,
              popularity: this.toNumber(track.popularity),
              isrc: this.extractIsrc(track),
              sourceUrl: typeof track.url === 'string' ? track.url : undefined,
              raw: track,
            };
            return {
              id: `tidal_${track.id ?? index}`,
              title,
              artist,
              primaryArtist: artist,
              album: track.album?.title || track.album?.name || track.album,
              duration: this.parseDuration(track.duration),
              source: 'tidal',
              metadataSource: 'tidal',
              imageUrl: this.extractTidalImageUrl(track),
              artworkUrl: this.extractTidalImageUrl(track),
              audioUrl: undefined,
              explicit: typeof track.explicit === 'boolean' ? track.explicit : undefined,
              popularity: providerMetadata.popularity,
              rank: index,
              isrc: providerMetadata.isrc,
              providerMetadata,
              providers: [providerMetadata],
              confidence: this.calculateConfidence({ ...track, title, artist, source: 'tidal' }, query, index),
              originalData: track,
            };
          });
        }
        return [];

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('HiFi Tidal search failed');
        console.warn(`HiFi Tidal search attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await this.wait(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // If all retries failed, log error but don't throw (allow other sources to work)
    console.error('HiFi Tidal search failed after all retries:', lastError);
    return [];
  }

  /** Search the global metadata fallback without ever requiring audio URLs. */
  private async searchITunes(
    query: string,
    maxResults: number,
    signal: AbortSignal
  ): Promise<SearchResult[]> {
    const metadata = await searchITunesSongs(query, { limit: maxResults, signal });
    return metadata.map((item, index) => this.metadataToSearchResult(item, query, index));
  }

  private metadataToSearchResult(
    item: UnifiedTrackMetadata,
    query: string,
    index: number
  ): SearchResult {
    return {
      id: `${item.metadataProvider}_${item.id}`,
      title: item.title,
      artist: item.artist,
      primaryArtist: item.primaryArtist,
      album: item.album,
      duration: item.duration,
      source: item.metadataProvider,
      metadataSource: item.metadataProvider,
      imageUrl: item.artworkUrl,
      artworkUrl: item.artworkUrl,
      audioCandidates: item.audioCandidates,
      explicit: item.explicit,
      popularity: item.popularity,
      rank: item.rank ?? index,
      isrc: item.isrc,
      providerMetadata: item.providerMetadata,
      providers: [item.providerMetadata],
      confidence: calculateRelevanceScore(
        {
          title: item.title,
          artist: item.artist,
          primaryArtist: item.primaryArtist,
          source: item.metadataProvider,
          popularity: item.popularity,
          rank: item.rank ?? index,
        },
        query,
        item.rank ?? index
      ),
      originalData: item.providerMetadata.raw,
    };
  }

  private withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.resolve([] as T);

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let cleanup = () => undefined;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        // Provider failures are isolated from the other indexes.
        resolve([] as T);
      };
      cleanup = () => {
        signal.removeEventListener('abort', onAbort);
      };

      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        (value) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        }
      );
    });
  }

  private wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private parseDuration(value: unknown): number | undefined {
    if (typeof value === 'string' && value.includes(':')) {
      const parts = value.split(':').map(Number);
      if (parts.every(Number.isFinite) && parts.length === 2) {
        return Math.round(parts[0] * 60 + parts[1]);
      }
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : undefined;
  }

  private toNumber(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }

  private parseExplicit(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      if (/^(?:explicit|true|1)$/i.test(value.trim())) return true;
      if (/^(?:clean|false|0|notexplicit)$/i.test(value.trim())) return false;
    }
    return undefined;
  }

  private extractIsrc(item: any): string | undefined {
    const value = item?.isrc || item?.ISRC || item?.externalIds?.isrc || item?.externalIds?.isrcs?.[0];
    if (typeof value !== 'string') return undefined;
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return normalized || undefined;
  }

  private extractTidalArtist(track: any): string {
    if (track?.artist?.name) return track.artist.name;
    if (Array.isArray(track?.artists) && track.artists.length > 0) {
      return typeof track.artists[0] === 'string' ? track.artists[0] : track.artists[0]?.name || 'Unknown Artist';
    }
    return track?.artist || 'Unknown Artist';
  }

  private extractPrimaryArtist(artist: string): string {
    return artist
      .split(/\s+(?:feat|ft)\.?\s+/i)[0]
      .split(/\s*[,/&]\s*/)[0]
      .trim() || artist;
  }

  private extractTidalImageUrl(track: any): string | undefined {
    const cover = track?.album?.cover;
    if (typeof cover !== 'string' || !cover) return undefined;
    return `https://resources.tidal.com/images/${cover.replace(/-/g, '/')}/1280x1280.jpg`;
  }

  /**
   * Process and rank search results
   */
  private processResults(results: SearchResult[], query: string, maxResults: number): SearchResult[] {
    return this.deduplicateResults(results, query, maxResults);
  }

  /**
   * Remove duplicate results based on title and artist similarity
   */
  private deduplicateResults(results: SearchResult[], query = '', maxResults = results.length): SearchResult[] {
    // Keep this method as the compatibility seam used by older callers while
    // delegating the actual merge/rank policy to the exported pure helper.
    results.forEach((result) => this.createDedupeKey(result.title, result.artist));
    return mergeSearchResults(results, query, maxResults);
  }

  /**
   * Create a normalized key for deduplication
   */
  private createDedupeKey(title: string, artist: string): string {
    return createTrackDedupeKey(title, artist);
  }

  /**
   * Calculate relevance confidence score
   */
  private calculateConfidence(item: any, query: string, index: number): number {
    const title = item.title || item.name || '';
    const artist = item.primaryArtist || item.artist || item.primaryArtists || '';
    return calculateRelevanceScore({
      title,
      artist,
      primaryArtist: artist,
      source: item.source || 'jiosaavn',
      popularity: item.popularity,
      rank: index,
    }, query, index);
  }

  /**
   * Extract artist name from various API response formats
   */
  private extractArtistName(song: any): string {
    return song.primaryArtists || 
           song.artist || 
           (song.artists && Array.isArray(song.artists) && song.artists.length > 0 ? 
             (typeof song.artists[0] === 'string' ? song.artists[0] : song.artists[0].name) : '') ||
           song.featuredArtists || 
           song.singers || 
           'Unknown Artist';
  }

  /**
   * Extract image URL from various API response formats
   */
  private extractImageUrl(song: any): string | undefined {
    if (song.imageUrl) return song.imageUrl;
    
    if (song.image) {
      if (Array.isArray(song.image) && song.image.length > 0) {
        return song.image[song.image.length - 1].link || song.image[song.image.length - 1].url;
      }
      if (typeof song.image === 'string') return song.image;
      if (typeof song.image === 'object' && song.image) {
        return song.image.link || song.image.url;
      }
    }
    
    return undefined;
  }

  /**
   * Extract audio URL from various API response formats
   */
  private extractAudioUrl(song: any): string | undefined {
    if (song.audioSrc) return song.audioSrc;
    
    if (song.downloadUrl) {
      if (Array.isArray(song.downloadUrl) && song.downloadUrl.length > 0) {
        // Get highest quality
        return song.downloadUrl[song.downloadUrl.length - 1].link || 
               song.downloadUrl[song.downloadUrl.length - 1].url;
      }
    }
    
    return undefined;
  }

  /**
   * Cache management
   */
  private getCacheKey(query: string, sources: SearchProvider[], maxResults: number): string {
    return `${query.toLowerCase()}::${[...sources].sort().join(',')}::${maxResults}`;
  }

  private getCachedResults(cacheKey: string): SearchResult[] | null {
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.results;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  private cacheResults(cacheKey: string, results: SearchResult[], query = cacheKey): void {
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      query,
    });

    // Limit cache size (keep only 50 most recent)
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
  }

  /**
   * Search history management
   */
  private addToHistory(query: string): void {
    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }
    
    // Add to beginning
    this.searchHistory.unshift(query);
    
    // Limit history size
    if (this.searchHistory.length > 20) {
      this.searchHistory = this.searchHistory.slice(0, 20);
    }
    
    // Save to localStorage
    this.saveSearchHistory();
  }

  private loadSearchHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem('music_search_history');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      this.searchHistory = [];
    }
  }

  private saveSearchHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('music_search_history', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * Get search suggestions based on history and popular searches
   */
  getSuggestions(query: string): string[] {
    if (!query.trim()) {
      return this.searchHistory.slice(0, 5);
    }

    const queryLower = query.toLowerCase();
    const suggestions: string[] = [];

    // Add matching history items
    for (const historyItem of this.searchHistory) {
      if (historyItem.toLowerCase().includes(queryLower) && suggestions.length < 5) {
        suggestions.push(historyItem);
      }
    }

    // Add popular searches if we need more suggestions
    const popularSearches = [
      'Taylor Swift',
      'Ed Sheeran',
      'Billie Eilish',
      'The Weeknd',
      'Ariana Grande',
      'Drake',
      'Dua Lipa',
      'Post Malone',
    ];

    for (const popular of popularSearches) {
      if (popular.toLowerCase().includes(queryLower) && 
          !suggestions.includes(popular) && 
          suggestions.length < 8) {
        suggestions.push(popular);
      }
    }

    return suggestions;
  }

  /**
   * Get search history
   */
  getHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Convert SearchResult to Track for compatibility
   */
  convertToTrack(result: SearchResult): Track {
    return {
      ...(result.originalData && typeof result.originalData === 'object' ? result.originalData : {}),
      id: result.id,
      title: result.title,
      artist: result.artist,
      audioSrc: result.audioUrl || '',
      albumArtUrl: result.imageUrl || result.artworkUrl,
      album: result.album,
      duration: result.duration,
      source: result.source,
      metadataSource: result.metadataSource || result.source,
      primaryArtist: result.primaryArtist || result.artist,
      explicit: result.explicit,
      popularity: result.popularity,
      rank: result.rank,
      isrc: result.isrc,
      providerMetadata: result.providerMetadata,
      audioCandidates: result.audioCandidates,
      streamQuality: result.quality,
      streamMatchConfidence: result.streamMatchConfidence,
    };
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cache.clear();
  }
}

// Create a default instance
export const searchEngine = new SearchEngine();

/**
 * App-facing global metadata search.  Callers can opt into a narrower provider
 * set, but the default always keeps Tidal/iTunes discovery ahead of JioSaavn.
 */
export const searchGlobalTracks = (
  query: string,
  options: {
    sources?: SearchProvider[];
    maxResults?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<SearchResult[]> => searchEngine.search(query, options);

export const searchMetadata = searchGlobalTracks;

export const convertSearchResultToTrack = (result: SearchResult): Track =>
  searchEngine.convertToTrack(result);
