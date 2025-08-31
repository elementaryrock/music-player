/**
 * Tests for SearchResultProcessor service
 */

import { SearchResultProcessor } from '../searchResultProcessor';
import { SearchResult } from '../searchEngine';
import { FilterOptions } from '../../components/SearchFilters';

describe('SearchResultProcessor', () => {
  const mockResults: SearchResult[] = [
    {
      id: '1',
      title: 'Song A',
      artist: 'Artist A',
      source: 'jiosaavn',
      confidence: 0.9,
      duration: 120, // 2 minutes
    },
    {
      id: '2',
      title: 'Song B',
      artist: 'Artist B',
      source: 'tidal',
      confidence: 0.8,
      duration: 240, // 4 minutes
    },
    {
      id: '3',
      title: 'Song C',
      artist: 'Artist C',
      source: 'jiosaavn',
      confidence: 0.7,
      duration: 360, // 6 minutes
    },
    {
      id: '4',
      title: 'Song D',
      artist: 'Artist D',
      source: 'tidal',
      confidence: 0.6,
      // No duration
    },
  ];

  const defaultFilters: FilterOptions = {
    source: 'all',
    duration: 'any',
    quality: 'any',
    sortBy: 'relevance',
    sortOrder: 'desc',
  };

  describe('processResults', () => {
    it('returns all results with default filters', () => {
      const processed = SearchResultProcessor.processResults(mockResults, defaultFilters);

      expect(processed.results).toHaveLength(4);
      expect(processed.totalCount).toBe(4);
      expect(processed.filteredCount).toBe(4);
      expect(processed.appliedFilters).toEqual(defaultFilters);
    });

    it('filters by source correctly', () => {
      const filters = { ...defaultFilters, source: 'tidal' as const };
      const processed = SearchResultProcessor.processResults(mockResults, filters);

      expect(processed.results).toHaveLength(2);
      expect(processed.results.every(r => r.source === 'tidal')).toBe(true);
      expect(processed.filteredCount).toBe(2);
    });

    it('filters by duration correctly', () => {
      const shortFilters = { ...defaultFilters, duration: 'short' as const };
      const processed = SearchResultProcessor.processResults(mockResults, shortFilters);

      expect(processed.results).toHaveLength(2); // Song A (120s) + Song D (no duration)
      expect(processed.filteredCount).toBe(2);

      const mediumFilters = { ...defaultFilters, duration: 'medium' as const };
      const processedMedium = SearchResultProcessor.processResults(mockResults, mediumFilters);

      expect(processedMedium.results).toHaveLength(2); // Song B (240s) + Song D (no duration)
      expect(processedMedium.filteredCount).toBe(2);

      const longFilters = { ...defaultFilters, duration: 'long' as const };
      const processedLong = SearchResultProcessor.processResults(mockResults, longFilters);

      expect(processedLong.results).toHaveLength(2); // Song C (360s) + Song D (no duration)
      expect(processedLong.filteredCount).toBe(2);
    });

    it('filters by quality correctly', () => {
      const losslessFilters = { ...defaultFilters, quality: 'lossless' as const };
      const processed = SearchResultProcessor.processResults(mockResults, losslessFilters);

      expect(processed.results).toHaveLength(2);
      expect(processed.results.every(r => r.source === 'tidal')).toBe(true);
      expect(processed.filteredCount).toBe(2);
    });

    it('sorts by relevance correctly', () => {
      const filters = { ...defaultFilters, sortBy: 'relevance' as const };
      const processed = SearchResultProcessor.processResults(mockResults, filters);

      // Should be sorted by confidence descending
      expect(processed.results[0].confidence).toBe(0.9);
      expect(processed.results[1].confidence).toBe(0.8);
      expect(processed.results[2].confidence).toBe(0.7);
      expect(processed.results[3].confidence).toBe(0.6);
    });

    it('sorts by title correctly', () => {
      const filters = { ...defaultFilters, sortBy: 'title' as const };
      const processed = SearchResultProcessor.processResults(mockResults, filters);

      // Should be sorted alphabetically by title descending (default order)
      expect(processed.results[0].title).toBe('Song D');
      expect(processed.results[1].title).toBe('Song C');
      expect(processed.results[2].title).toBe('Song B');
      expect(processed.results[3].title).toBe('Song A');
    });

    it('sorts by artist correctly', () => {
      const filters = { ...defaultFilters, sortBy: 'artist' as const };
      const processed = SearchResultProcessor.processResults(mockResults, filters);

      // Should be sorted alphabetically by artist descending
      expect(processed.results[0].artist).toBe('Artist D');
      expect(processed.results[1].artist).toBe('Artist C');
      expect(processed.results[2].artist).toBe('Artist B');
      expect(processed.results[3].artist).toBe('Artist A');
    });

    it('sorts by duration correctly', () => {
      const filters = { ...defaultFilters, sortBy: 'duration' as const };
      const processed = SearchResultProcessor.processResults(mockResults, filters);

      // Should be sorted by duration descending (longest first)
      expect(processed.results[0].duration).toBe(360);
      expect(processed.results[1].duration).toBe(240);
      expect(processed.results[2].duration).toBe(120);
      expect(processed.results[3].duration).toBeUndefined();
    });

    it('respects sort order', () => {
      const ascFilters = { ...defaultFilters, sortBy: 'title' as const, sortOrder: 'asc' as const };
      const processed = SearchResultProcessor.processResults(mockResults, ascFilters);

      // Should be sorted alphabetically ascending
      expect(processed.results[0].title).toBe('Song A');
      expect(processed.results[1].title).toBe('Song B');
      expect(processed.results[2].title).toBe('Song C');
      expect(processed.results[3].title).toBe('Song D');
    });

    it('combines multiple filters', () => {
      const filters: FilterOptions = {
        source: 'jiosaavn',
        duration: 'short',
        quality: 'any',
        sortBy: 'title',
        sortOrder: 'asc',
      };

      const processed = SearchResultProcessor.processResults(mockResults, filters);

      expect(processed.results).toHaveLength(1);
      expect(processed.results[0].title).toBe('Song A');
      expect(processed.results[0].source).toBe('jiosaavn');
      expect(processed.results[0].duration).toBe(120);
    });
  });

  describe('getFilterStats', () => {
    it('calculates source statistics correctly', () => {
      const stats = SearchResultProcessor.getFilterStats(mockResults);

      expect(stats.sources.jiosaavn).toBe(2);
      expect(stats.sources.tidal).toBe(2);
    });

    it('calculates duration statistics correctly', () => {
      const stats = SearchResultProcessor.getFilterStats(mockResults);

      expect(stats.durations.short).toBe(1); // Song A (120s)
      expect(stats.durations.medium).toBe(1); // Song B (240s)
      expect(stats.durations.long).toBe(1); // Song C (360s)
      expect(stats.durations.unknown).toBe(1); // Song D (no duration)
    });

    it('calculates quality statistics correctly', () => {
      const stats = SearchResultProcessor.getFilterStats(mockResults);

      expect(stats.qualities.high).toBe(2); // JioSaavn results
      expect(stats.qualities.lossless).toBe(2); // Tidal results
    });
  });

  describe('getSuggestedFilters', () => {
    it('suggests source filter when one dominates', () => {
      const tidalResults = mockResults.filter(r => r.source === 'tidal');
      const suggestions = SearchResultProcessor.getSuggestedFilters([
        ...tidalResults,
        ...tidalResults,
        ...tidalResults, // Make Tidal dominate
      ]);

      expect(suggestions.source).toBe('tidal');
    });

    it('suggests duration filter when one dominates', () => {
      const shortResults = mockResults.filter(r => r.duration && r.duration < 180);
      const suggestions = SearchResultProcessor.getSuggestedFilters([
        ...shortResults,
        ...shortResults,
        ...shortResults, // Make short duration dominate
      ]);

      expect(suggestions.duration).toBe('short');
    });

    it('suggests lossless quality when available', () => {
      const suggestions = SearchResultProcessor.getSuggestedFilters(mockResults);

      expect(suggestions.quality).toBe('lossless');
    });

    it('returns empty suggestions when no clear dominance', () => {
      const suggestions = SearchResultProcessor.getSuggestedFilters(mockResults);

      expect(suggestions.source).toBeUndefined();
      expect(suggestions.duration).toBeUndefined();
    });
  });

  describe('utility methods', () => {
    it('formats duration correctly', () => {
      expect(SearchResultProcessor.formatDuration(120)).toBe('2:00');
      expect(SearchResultProcessor.formatDuration(125)).toBe('2:05');
      expect(SearchResultProcessor.formatDuration(65)).toBe('1:05');
      expect(SearchResultProcessor.formatDuration(undefined)).toBe('Unknown');
    });

    it('gets quality label correctly', () => {
      expect(SearchResultProcessor.getQualityLabel(mockResults[0])).toBe('High Quality');
      expect(SearchResultProcessor.getQualityLabel(mockResults[1])).toBe('Lossless');
    });

    it('gets source display name correctly', () => {
      expect(SearchResultProcessor.getSourceDisplayName('jiosaavn')).toBe('JioSaavn');
      expect(SearchResultProcessor.getSourceDisplayName('tidal')).toBe('Tidal');
      expect(SearchResultProcessor.getSourceDisplayName('unknown')).toBe('unknown');
    });

    it('detects active filters correctly', () => {
      expect(SearchResultProcessor.hasActiveFilters(defaultFilters)).toBe(false);
      
      const activeFilters = { ...defaultFilters, source: 'tidal' as const };
      expect(SearchResultProcessor.hasActiveFilters(activeFilters)).toBe(true);
    });

    it('validates filters correctly', () => {
      const invalidFilters = {
        source: 'invalid',
        duration: 'invalid',
        quality: 'invalid',
        sortBy: 'invalid',
        sortOrder: 'invalid',
      };

      const validated = SearchResultProcessor.validateFilters(invalidFilters);

      expect(validated).toEqual(defaultFilters);
    });

    it('handles partial filter validation', () => {
      const partialFilters = {
        source: 'tidal' as const,
        // Missing other properties
      };

      const validated = SearchResultProcessor.validateFilters(partialFilters);

      expect(validated.source).toBe('tidal');
      expect(validated.duration).toBe('any');
      expect(validated.quality).toBe('any');
      expect(validated.sortBy).toBe('relevance');
      expect(validated.sortOrder).toBe('desc');
    });
  });

  describe('URL parameter handling', () => {
    it('serializes filters to URL parameters correctly', () => {
      const filters: FilterOptions = {
        source: 'tidal',
        duration: 'short',
        quality: 'lossless',
        sortBy: 'title',
        sortOrder: 'asc',
      };

      const params = SearchResultProcessor.filtersToUrlParams(filters);

      expect(params.get('source')).toBe('tidal');
      expect(params.get('duration')).toBe('short');
      expect(params.get('quality')).toBe('lossless');
      expect(params.get('sortBy')).toBe('title');
      expect(params.get('sortOrder')).toBe('asc');
    });

    it('omits default values from URL parameters', () => {
      const params = SearchResultProcessor.filtersToUrlParams(defaultFilters);

      expect(params.toString()).toBe('');
    });

    it('parses filters from URL parameters correctly', () => {
      const params = new URLSearchParams();
      params.set('source', 'tidal');
      params.set('duration', 'short');
      params.set('quality', 'lossless');
      params.set('sortBy', 'title');
      params.set('sortOrder', 'asc');

      const filters = SearchResultProcessor.filtersFromUrlParams(params);

      expect(filters.source).toBe('tidal');
      expect(filters.duration).toBe('short');
      expect(filters.quality).toBe('lossless');
      expect(filters.sortBy).toBe('title');
      expect(filters.sortOrder).toBe('asc');
    });

    it('handles invalid URL parameters gracefully', () => {
      const params = new URLSearchParams();
      params.set('source', 'invalid');
      params.set('duration', 'invalid');

      const filters = SearchResultProcessor.filtersFromUrlParams(params);

      expect(filters.source).toBe('all'); // Falls back to default
      expect(filters.duration).toBe('any'); // Falls back to default
    });

    it('handles empty URL parameters', () => {
      const params = new URLSearchParams();
      const filters = SearchResultProcessor.filtersFromUrlParams(params);

      expect(filters).toEqual(defaultFilters);
    });
  });
});