/**
 * Enhanced Search Hook
 * 
 * Combines search engine with filtering, sorting, and suggestions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchEngine } from './useSearchEngine';
import { useSearchSuggestions } from './useSearchSuggestions';
import { SearchResultProcessor, ProcessedSearchResults } from '../services/searchResultProcessor';
import { FilterOptions } from '../components/SearchFilters';
import { SearchResult } from '../services/searchEngine';

interface UseEnhancedSearchOptions {
  debounceMs?: number;
  maxResults?: number;
  sources?: ('jiosaavn' | 'tidal')[];
  enableSuggestions?: boolean;
  enableUrlState?: boolean;
  storageKey?: string;
}

interface UseEnhancedSearchReturn {
  // Search state
  query: string;
  setQuery: (query: string) => void;
  isSearching: boolean;
  error: string | null;
  
  // Results
  processedResults: ProcessedSearchResults;
  rawResults: SearchResult[];
  
  // Filters
  filters: FilterOptions;
  setFilters: (filters: FilterOptions) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  
  // Suggestions
  suggestions: string[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  
  // History
  searchHistory: string[];
  clearHistory: () => void;
  
  // Actions
  search: (query?: string, forceRefresh?: boolean) => Promise<void>;
  searchDebounced: (query: string) => void;
  selectSuggestion: (suggestion: string) => void;
  selectHistoryItem: (item: string) => void;
  
  // Utilities
  convertToTrack: (result: SearchResult) => any;
  getFilterStats: () => any;
  getSuggestedFilters: () => Partial<FilterOptions>;
}

export const useEnhancedSearch = (
  options: UseEnhancedSearchOptions = {}
): UseEnhancedSearchReturn => {
  const {
    debounceMs = 300,
    maxResults = 20,
    sources = ['jiosaavn', 'tidal'],
    enableSuggestions = true,
    enableUrlState = false,
    storageKey = 'music_search_filters',
  } = options;

  // State
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFiltersState] = useState<FilterOptions>(() => {
    // Load filters from localStorage or URL
    if (enableUrlState && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return SearchResultProcessor.filtersFromUrlParams(urlParams);
    }
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return SearchResultProcessor.validateFilters(parsed);
      }
    } catch (error) {
      console.warn('Failed to load saved filters:', error);
    }
    
    return SearchResultProcessor.getDefaultFilters();
  });

  // Hooks
  const searchEngine = useSearchEngine({
    debounceMs,
    maxResults,
    sources,
  });

  const searchSuggestions = useSearchSuggestions({
    enablePopularSuggestions: enableSuggestions,
    maxSuggestions: 8,
    maxHistoryItems: 10,
  });

  // Process results with current filters
  const processedResults = useMemo(() => {
    return SearchResultProcessor.processResults(
      searchEngine.searchState.results,
      filters
    );
  }, [searchEngine.searchState.results, filters]);

  // Get suggestions for current query
  const suggestions = useMemo(() => {
    if (!enableSuggestions) return [];
    return searchSuggestions.getSuggestionsForQuery(query);
  }, [query, searchSuggestions, enableSuggestions]);

  // Save filters to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  }, [filters, storageKey]);

  // Update URL when filters change (if enabled)
  useEffect(() => {
    if (enableUrlState && typeof window !== 'undefined') {
      const params = SearchResultProcessor.filtersToUrlParams(filters);
      const newUrl = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      
      window.history.replaceState({}, '', newUrl);
    }
  }, [filters, enableUrlState]);

  // Set filters with validation
  const setFilters = useCallback((newFilters: FilterOptions) => {
    const validatedFilters = SearchResultProcessor.validateFilters(newFilters);
    setFiltersState(validatedFilters);
  }, []);

  // Reset filters to default
  const resetFilters = useCallback(() => {
    setFilters(SearchResultProcessor.getDefaultFilters());
  }, [setFilters]);

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return SearchResultProcessor.hasActiveFilters(filters);
  }, [filters]);

  // Search function
  const search = useCallback(async (searchQuery?: string, forceRefresh = false) => {
    const queryToSearch = searchQuery ?? query;
    if (!queryToSearch.trim()) return;

    try {
      await searchEngine.search(queryToSearch, forceRefresh);
      searchSuggestions.addToHistory(queryToSearch);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [query, searchEngine, searchSuggestions]);

  // Debounced search
  const searchDebounced = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim()) {
      searchEngine.searchDebounced(searchQuery);
    }
  }, [searchEngine]);

  // Select suggestion
  const selectSuggestion = useCallback((suggestion: string) => {
    setQuery(suggestion);
    search(suggestion);
  }, [search]);

  // Select history item
  const selectHistoryItem = useCallback((item: string) => {
    setQuery(item);
    search(item);
  }, [search]);

  // Clear search history
  const clearHistory = useCallback(() => {
    searchSuggestions.clearHistory();
  }, [searchSuggestions]);

  // Get filter statistics
  const getFilterStats = useCallback(() => {
    return SearchResultProcessor.getFilterStats(searchEngine.searchState.results);
  }, [searchEngine.searchState.results]);

  // Get suggested filters
  const getSuggestedFilters = useCallback(() => {
    return SearchResultProcessor.getSuggestedFilters(searchEngine.searchState.results);
  }, [searchEngine.searchState.results]);

  // Convert result to track
  const convertToTrack = useCallback((result: SearchResult) => {
    return searchEngine.convertToTrack(result);
  }, [searchEngine]);

  return {
    // Search state
    query,
    setQuery,
    isSearching: searchEngine.searchState.isLoading,
    error: searchEngine.searchState.error,
    
    // Results
    processedResults,
    rawResults: searchEngine.searchState.results,
    
    // Filters
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    
    // Suggestions
    suggestions,
    showSuggestions,
    setShowSuggestions,
    
    // History
    searchHistory: searchSuggestions.history,
    clearHistory,
    
    // Actions
    search,
    searchDebounced,
    selectSuggestion,
    selectHistoryItem,
    
    // Utilities
    convertToTrack,
    getFilterStats,
    getSuggestedFilters,
  };
};

export default useEnhancedSearch;