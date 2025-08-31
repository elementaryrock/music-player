/**
 * Enhanced Search Engine Service
 * 
 * Provides intelligent search functionality with debouncing, caching,
 * multi-source support, and error handling.
 */

import { searchSongs as searchJioSaavn, searchCombined } from './api';
import { searchTidalSongs, searchAndGetTidalSongs } from './tidalApi';
import { Track } from '../types/api.types';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  source: 'jiosaavn' | 'tidal';
  imageUrl?: string;
  audioUrl?: string;
  confidence: number; // Relevance score 0-1
  originalData?: any; // Store original API response
}

export interface SearchEngineConfig {
  debounceMs: number;
  maxResults: number;
  enableSuggestions: boolean;
  sources: ('jiosaavn' | 'tidal')[];
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

export class SearchEngine {
  private config: SearchEngineConfig;
  private cache = new Map<string, CacheEntry>();
  private debounceTimer: NodeJS.Timeout | null = null;
  private searchHistory: string[] = [];
  private abortController: AbortController | null = null;

  constructor(config: Partial<SearchEngineConfig> = {}) {
    this.config = {
      debounceMs: 300,
      maxResults: 20,
      enableSuggestions: true,
      sources: ['jiosaavn', 'tidal'],
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
      sources?: ('jiosaavn' | 'tidal')[];
      maxResults?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      return [];
    }

    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
      const cached = this.getCachedResults(trimmedQuery);
      if (cached) {
        return cached;
      }
    }

    // Cancel any ongoing search
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const sources = options.sources || this.config.sources;
    const maxResults = options.maxResults || this.config.maxResults;

    try {
      const searchPromises: Promise<SearchResult[]>[] = [];

      // Search JioSaavn if requested
      if (sources.includes('jiosaavn')) {
        searchPromises.push(this.searchJioSaavn(trimmedQuery, maxResults));
      }

      // Search Tidal if requested
      if (sources.includes('tidal')) {
        searchPromises.push(this.searchTidal(trimmedQuery, maxResults));
      }

      // Execute searches in parallel
      const results = await Promise.allSettled(searchPromises);
      
      // Combine and process results
      const allResults: SearchResult[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          console.warn(`Search failed for source ${sources[index]}:`, result.reason);
        }
      });

      // Deduplicate and rank results
      const processedResults = this.processResults(allResults, trimmedQuery, maxResults);

      // Cache results
      this.cacheResults(trimmedQuery, processedResults);

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

        return response.results.map((song: any, index: number): SearchResult => ({
          id: `jiosaavn_${song.id}`,
          title: song.name || song.title || 'Unknown Title',
          artist: this.extractArtistName(song),
          album: song.album?.name || song.album || undefined,
          duration: song.duration ? parseInt(song.duration) : undefined,
          source: 'jiosaavn',
          imageUrl: this.extractImageUrl(song),
          audioUrl: this.extractAudioUrl(song),
          confidence: this.calculateConfidence(song, query, index),
          originalData: song,
        }));

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('JioSaavn search failed');
        console.warn(`JioSaavn search attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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
        // Use the enhanced HiFi Tidal API
        const tracks = await searchAndGetTidalSongs(query, 'LOSSLESS', maxResults);
        
        return tracks.map((track, index): SearchResult => ({
          id: `tidal_${track.id}`,
          title: track.title,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          source: 'tidal',
          imageUrl: track.albumArtUrl,
          audioUrl: track.audioSrc,
          confidence: this.calculateConfidence(track, query, index),
          originalData: track,
        }));

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('HiFi Tidal search failed');
        console.warn(`HiFi Tidal search attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // If all retries failed, log error but don't throw (allow other sources to work)
    console.error('HiFi Tidal search failed after all retries:', lastError);
    return [];
  }

  /**
   * Process and rank search results
   */
  private processResults(results: SearchResult[], query: string, maxResults: number): SearchResult[] {
    // Remove duplicates based on title and artist similarity
    const deduped = this.deduplicateResults(results);
    
    // Sort by confidence score
    const sorted = deduped.sort((a, b) => b.confidence - a.confidence);
    
    // Limit results
    return sorted.slice(0, maxResults);
  }

  /**
   * Remove duplicate results based on title and artist similarity
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];

    for (const result of results) {
      const key = this.createDedupeKey(result.title, result.artist);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(result);
      } else {
        // If we have a duplicate, keep the one with higher confidence
        const existingIndex = deduped.findIndex(r => 
          this.createDedupeKey(r.title, r.artist) === key
        );
        
        if (existingIndex !== -1 && result.confidence > deduped[existingIndex].confidence) {
          deduped[existingIndex] = result;
        }
      }
    }

    return deduped;
  }

  /**
   * Create a normalized key for deduplication
   */
  private createDedupeKey(title: string, artist: string): string {
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[^\w\s]/g, '')
         .replace(/\s+/g, ' ')
         .trim();
    
    return `${normalize(title)}_${normalize(artist)}`;
  }

  /**
   * Calculate relevance confidence score
   */
  private calculateConfidence(item: any, query: string, index: number): number {
    const queryLower = query.toLowerCase();
    const title = (item.title || item.name || '').toLowerCase();
    const artist = (item.artist || item.primaryArtists || '').toLowerCase();
    
    let score = 0;
    
    // Exact title match gets highest score
    if (title === queryLower) {
      score += 0.5;
    } else if (title.includes(queryLower)) {
      score += 0.3;
    }
    
    // Artist match
    if (artist.includes(queryLower)) {
      score += 0.2;
    }
    
    // Position in results (earlier = better)
    score += Math.max(0, (20 - index) / 20 * 0.2);
    
    // Source preference (can be configured)
    if (item.source === 'tidal') {
      score += 0.05; // Slight preference for Tidal due to quality
    }
    
    return Math.min(1, score);
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
  private getCachedResults(query: string): SearchResult[] | null {
    const cached = this.cache.get(query.toLowerCase());
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.results;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(query.toLowerCase());
    }
    
    return null;
  }

  private cacheResults(query: string, results: SearchResult[]): void {
    this.cache.set(query.toLowerCase(), {
      results,
      timestamp: Date.now(),
      query,
    });

    // Limit cache size (keep only 50 most recent)
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
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
      id: result.id,
      title: result.title,
      artist: result.artist,
      audioSrc: result.audioUrl || '',
      albumArtUrl: result.imageUrl,
      album: result.album,
      duration: result.duration,
      source: result.source,
      // Include original data for additional processing
      ...(result.originalData || {}),
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