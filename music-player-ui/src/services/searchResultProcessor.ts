/**
 * Search Result Processing Service
 * 
 * Handles filtering, sorting, and processing of search results
 */

import { SearchResult } from './searchEngine';
import { FilterOptions } from '../components/SearchFilters';

export interface ProcessedSearchResults {
  results: SearchResult[];
  totalCount: number;
  filteredCount: number;
  appliedFilters: FilterOptions;
}

export class SearchResultProcessor {
  /**
   * Process search results with filtering and sorting
   */
  static processResults(
    results: SearchResult[],
    filters: FilterOptions
  ): ProcessedSearchResults {
    const totalCount = results.length;
    
    // Apply filters
    let filteredResults = this.applyFilters(results, filters);
    const filteredCount = filteredResults.length;
    
    // Apply sorting
    filteredResults = this.applySorting(filteredResults, filters);
    
    return {
      results: filteredResults,
      totalCount,
      filteredCount,
      appliedFilters: filters,
    };
  }

  /**
   * Apply filters to search results
   */
  private static applyFilters(
    results: SearchResult[],
    filters: FilterOptions
  ): SearchResult[] {
    let filtered = [...results];

    // Filter by source
    if (filters.source !== 'all') {
      filtered = filtered.filter(result => result.source === filters.source);
    }

    // Filter by duration
    if (filters.duration !== 'any') {
      filtered = filtered.filter(result => {
        if (!result.duration) return true; // Keep results without duration info
        
        switch (filters.duration) {
          case 'short':
            return result.duration < 180; // Less than 3 minutes
          case 'medium':
            return result.duration >= 180 && result.duration < 300; // 3-5 minutes
          case 'long':
            return result.duration >= 300; // More than 5 minutes
          default:
            return true;
        }
      });
    }

    // Filter by quality
    if (filters.quality !== 'any') {
      filtered = filtered.filter(result => {
        switch (filters.quality) {
          case 'lossless':
            return result.source === 'tidal'; // Only Tidal has lossless
          case 'high':
            return true; // Both sources have high quality
          default:
            return true;
        }
      });
    }

    return filtered;
  }

  /**
   * Apply sorting to search results
   */
  private static applySorting(
    results: SearchResult[],
    filters: FilterOptions
  ): SearchResult[] {
    const sorted = [...results];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'relevance':
          comparison = b.confidence - a.confidence;
          break;
        
        case 'title':
          comparison = a.title.localeCompare(b.title, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
          break;
        
        case 'artist':
          comparison = a.artist.localeCompare(b.artist, undefined, { 
            numeric: true, 
            sensitivity: 'base' 
          });
          break;
        
        case 'duration':
          const aDuration = a.duration || 0;
          const bDuration = b.duration || 0;
          comparison = aDuration - bDuration;
          break;
        
        case 'popularity':
          // Use confidence as a proxy for popularity
          // In a real app, you might have actual popularity scores
          comparison = b.confidence - a.confidence;
          break;
        
        default:
          comparison = b.confidence - a.confidence;
      }

      // Apply sort order
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Get filter statistics for the current results
   */
  static getFilterStats(results: SearchResult[]): {
    sources: Record<string, number>;
    durations: Record<string, number>;
    qualities: Record<string, number>;
  } {
    const stats = {
      sources: { jiosaavn: 0, tidal: 0 },
      durations: { short: 0, medium: 0, long: 0, unknown: 0 },
      qualities: { high: 0, lossless: 0 },
    };

    results.forEach(result => {
      // Count sources
      stats.sources[result.source]++;

      // Count durations
      if (!result.duration) {
        stats.durations.unknown++;
      } else if (result.duration < 180) {
        stats.durations.short++;
      } else if (result.duration < 300) {
        stats.durations.medium++;
      } else {
        stats.durations.long++;
      }

      // Count qualities
      if (result.source === 'tidal') {
        stats.qualities.lossless++;
      } else {
        stats.qualities.high++;
      }
    });

    return stats;
  }

  /**
   * Get suggested filters based on current results
   */
  static getSuggestedFilters(results: SearchResult[]): Partial<FilterOptions> {
    const stats = this.getFilterStats(results);
    const suggestions: Partial<FilterOptions> = {};

    // Suggest source filter if one source dominates
    const totalResults = results.length;
    if (stats.sources.tidal > totalResults * 0.7) {
      suggestions.source = 'tidal';
    } else if (stats.sources.jiosaavn > totalResults * 0.7) {
      suggestions.source = 'jiosaavn';
    }

    // Suggest duration filter if one duration dominates
    const maxDuration = Math.max(
      stats.durations.short,
      stats.durations.medium,
      stats.durations.long
    );
    
    if (maxDuration > totalResults * 0.6) {
      if (stats.durations.short === maxDuration) {
        suggestions.duration = 'short';
      } else if (stats.durations.medium === maxDuration) {
        suggestions.duration = 'medium';
      } else if (stats.durations.long === maxDuration) {
        suggestions.duration = 'long';
      }
    }

    // Suggest quality filter if lossless is available
    if (stats.qualities.lossless > 0) {
      suggestions.quality = 'lossless';
    }

    return suggestions;
  }

  /**
   * Format duration for display
   */
  static formatDuration(seconds?: number): string {
    if (!seconds) return 'Unknown';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get quality label for a result
   */
  static getQualityLabel(result: SearchResult): string {
    switch (result.source) {
      case 'tidal':
        return 'Lossless';
      case 'jiosaavn':
        return 'High Quality';
      default:
        return 'Standard';
    }
  }

  /**
   * Get source display name
   */
  static getSourceDisplayName(source: string): string {
    switch (source) {
      case 'jiosaavn':
        return 'JioSaavn';
      case 'tidal':
        return 'Tidal';
      default:
        return source;
    }
  }

  /**
   * Check if filters are applied (not default)
   */
  static hasActiveFilters(filters: FilterOptions): boolean {
    return (
      filters.source !== 'all' ||
      filters.duration !== 'any' ||
      filters.quality !== 'any' ||
      filters.sortBy !== 'relevance'
    );
  }

  /**
   * Get default filter options
   */
  static getDefaultFilters(): FilterOptions {
    return {
      source: 'all',
      duration: 'any',
      quality: 'any',
      sortBy: 'relevance',
      sortOrder: 'desc',
    };
  }

  /**
   * Validate filter options
   */
  static validateFilters(filters: Partial<FilterOptions>): FilterOptions {
    const defaults = this.getDefaultFilters();
    
    return {
      source: this.isValidSource(filters.source) ? filters.source! : defaults.source,
      duration: this.isValidDuration(filters.duration) ? filters.duration! : defaults.duration,
      quality: this.isValidQuality(filters.quality) ? filters.quality! : defaults.quality,
      sortBy: this.isValidSortBy(filters.sortBy) ? filters.sortBy! : defaults.sortBy,
      sortOrder: this.isValidSortOrder(filters.sortOrder) ? filters.sortOrder! : defaults.sortOrder,
    };
  }

  private static isValidSource(source?: string): source is FilterOptions['source'] {
    return ['all', 'jiosaavn', 'tidal'].includes(source || '');
  }

  private static isValidDuration(duration?: string): duration is FilterOptions['duration'] {
    return ['any', 'short', 'medium', 'long'].includes(duration || '');
  }

  private static isValidQuality(quality?: string): quality is FilterOptions['quality'] {
    return ['any', 'high', 'lossless'].includes(quality || '');
  }

  private static isValidSortBy(sortBy?: string): sortBy is FilterOptions['sortBy'] {
    return ['relevance', 'title', 'artist', 'duration', 'popularity'].includes(sortBy || '');
  }

  private static isValidSortOrder(sortOrder?: string): sortOrder is FilterOptions['sortOrder'] {
    return ['asc', 'desc'].includes(sortOrder || '');
  }

  /**
   * Serialize filters to URL parameters
   */
  static filtersToUrlParams(filters: FilterOptions): URLSearchParams {
    const params = new URLSearchParams();
    
    if (filters.source !== 'all') params.set('source', filters.source);
    if (filters.duration !== 'any') params.set('duration', filters.duration);
    if (filters.quality !== 'any') params.set('quality', filters.quality);
    if (filters.sortBy !== 'relevance') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
    
    return params;
  }

  /**
   * Parse filters from URL parameters
   */
  static filtersFromUrlParams(params: URLSearchParams): FilterOptions {
    const filters: Partial<FilterOptions> = {};
    
    if (params.has('source')) filters.source = params.get('source') as any;
    if (params.has('duration')) filters.duration = params.get('duration') as any;
    if (params.has('quality')) filters.quality = params.get('quality') as any;
    if (params.has('sortBy')) filters.sortBy = params.get('sortBy') as any;
    if (params.has('sortOrder')) filters.sortOrder = params.get('sortOrder') as any;
    
    return this.validateFilters(filters);
  }
}