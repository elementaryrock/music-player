/**
 * React hook for using the enhanced search engine
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchEngine, SearchResult, SearchState } from '../services/searchEngine';

interface UseSearchEngineOptions {
  debounceMs?: number;
  maxResults?: number;
  sources?: ('jiosaavn' | 'tidal')[];
  enableSuggestions?: boolean;
}

interface UseSearchEngineReturn {
  searchState: SearchState;
  search: (query: string, forceRefresh?: boolean) => Promise<void>;
  searchDebounced: (query: string) => void;
  getSuggestions: (query: string) => string[];
  clearHistory: () => void;
  clearCache: () => void;
  setFilters: (filters: Partial<SearchState['filters']>) => void;
  convertToTrack: (result: SearchResult) => any;
}

export const useSearchEngine = (options: UseSearchEngineOptions = {}): UseSearchEngineReturn => {
  const searchEngineRef = useRef<SearchEngine | null>(null);
  
  // Initialize search engine
  if (!searchEngineRef.current) {
    searchEngineRef.current = new SearchEngine({
      debounceMs: options.debounceMs || 300,
      maxResults: options.maxResults || 20,
      sources: options.sources || ['jiosaavn', 'tidal'],
      enableSuggestions: options.enableSuggestions !== false,
    });
  }

  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    error: null,
    suggestions: [],
    filters: {
      source: 'all',
      duration: 'any',
      quality: 'any',
    },
    history: searchEngineRef.current?.getHistory() || [],
  });

  // Update history when search engine changes
  useEffect(() => {
    if (searchEngineRef.current) {
      setSearchState(prev => ({
        ...prev,
        history: searchEngineRef.current!.getHistory(),
      }));
    }
  }, []);

  // Main search function
  const search = useCallback(async (query: string, forceRefresh = false) => {
    if (!searchEngineRef.current) return;

    setSearchState(prev => ({
      ...prev,
      query,
      isLoading: true,
      error: null,
    }));

    try {
      // Determine sources based on filters
      let sources: ('jiosaavn' | 'tidal')[] = ['jiosaavn', 'tidal'];
      if (searchState.filters.source !== 'all') {
        sources = [searchState.filters.source];
      }

      const results = await searchEngineRef.current.search(query, {
        sources,
        maxResults: options.maxResults || 20,
        forceRefresh,
      });

      // Apply additional filters
      const filteredResults = applyFilters(results, searchState.filters);

      setSearchState(prev => ({
        ...prev,
        results: filteredResults,
        isLoading: false,
        history: searchEngineRef.current!.getHistory(),
      }));

    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        results: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }));
    }
  }, [searchState.filters, options.maxResults]);

  // Debounced search function
  const searchDebounced = useCallback((query: string) => {
    if (!searchEngineRef.current) return;

    setSearchState(prev => ({
      ...prev,
      query,
      isLoading: true,
      error: null,
    }));

    searchEngineRef.current.searchDebounced(
      query,
      (results) => {
        const filteredResults = applyFilters(results, searchState.filters);
        setSearchState(prev => ({
          ...prev,
          results: filteredResults,
          isLoading: false,
          history: searchEngineRef.current!.getHistory(),
        }));
      },
      (error) => {
        setSearchState(prev => ({
          ...prev,
          results: [],
          isLoading: false,
          error: error.message,
        }));
      }
    );
  }, [searchState.filters]);

  // Get suggestions
  const getSuggestions = useCallback((query: string): string[] => {
    if (!searchEngineRef.current) return [];
    return searchEngineRef.current.getSuggestions(query);
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    if (!searchEngineRef.current) return;
    searchEngineRef.current.clearHistory();
    setSearchState(prev => ({
      ...prev,
      history: [],
    }));
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    if (!searchEngineRef.current) return;
    searchEngineRef.current.clearCache();
  }, []);

  // Set filters
  const setFilters = useCallback((newFilters: Partial<SearchState['filters']>) => {
    setSearchState(prev => {
      const updatedFilters = { ...prev.filters, ...newFilters };
      
      // Re-apply filters to current results
      const filteredResults = applyFilters(prev.results, updatedFilters);
      
      return {
        ...prev,
        filters: updatedFilters,
        results: filteredResults,
      };
    });
  }, []);

  // Convert search result to track
  const convertToTrack = useCallback((result: SearchResult) => {
    if (!searchEngineRef.current) return result;
    return searchEngineRef.current.convertToTrack(result);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchEngineRef.current) {
        searchEngineRef.current.destroy();
      }
    };
  }, []);

  return {
    searchState,
    search,
    searchDebounced,
    getSuggestions,
    clearHistory,
    clearCache,
    setFilters,
    convertToTrack,
  };
};

/**
 * Apply filters to search results
 */
function applyFilters(results: SearchResult[], filters: SearchState['filters']): SearchResult[] {
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

  // Filter by quality (mainly for Tidal)
  if (filters.quality !== 'any') {
    filtered = filtered.filter(result => {
      if (filters.quality === 'lossless') {
        return result.source === 'tidal'; // Only Tidal has lossless
      }
      if (filters.quality === 'high') {
        return true; // Both sources have high quality
      }
      return true;
    });
  }

  return filtered;
}

export default useSearchEngine;