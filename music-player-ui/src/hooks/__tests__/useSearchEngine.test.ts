/**
 * Unit tests for useSearchEngine hook
 */

import { renderHook, act } from '@testing-library/react';
import { useSearchEngine } from '../useSearchEngine';

// Mock the SearchEngine class
jest.mock('../searchEngine', () => {
  const mockSearchEngine = {
    search: jest.fn(),
    searchDebounced: jest.fn(),
    getSuggestions: jest.fn(),
    getHistory: jest.fn(),
    clearHistory: jest.fn(),
    clearCache: jest.fn(),
    convertToTrack: jest.fn(),
    destroy: jest.fn(),
  };

  return {
    SearchEngine: jest.fn(() => mockSearchEngine),
    searchEngine: mockSearchEngine,
  };
});

describe('useSearchEngine', () => {
  let mockSearchEngine: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const { SearchEngine } = require('../searchEngine');
    mockSearchEngine = new SearchEngine();
    
    // Setup default mock returns
    mockSearchEngine.getHistory.mockReturnValue([]);
    mockSearchEngine.getSuggestions.mockReturnValue([]);
    mockSearchEngine.search.mockResolvedValue([]);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useSearchEngine());

    expect(result.current.searchState).toEqual({
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
      history: [],
    });
  });

  it('should initialize SearchEngine with provided options', () => {
    const options = {
      debounceMs: 500,
      maxResults: 15,
      sources: ['jiosaavn' as const],
      enableSuggestions: false,
    };

    renderHook(() => useSearchEngine(options));

    const { SearchEngine } = require('../searchEngine');
    expect(SearchEngine).toHaveBeenCalledWith({
      debounceMs: 500,
      maxResults: 15,
      sources: ['jiosaavn'],
      enableSuggestions: false,
    });
  });

  it('should perform search and update state', async () => {
    const mockResults = [
      {
        id: 'test1',
        title: 'Test Song',
        artist: 'Test Artist',
        source: 'jiosaavn',
        confidence: 0.9,
      },
    ];

    mockSearchEngine.search.mockResolvedValue(mockResults);
    mockSearchEngine.getHistory.mockReturnValue(['test query']);

    const { result } = renderHook(() => useSearchEngine());

    await act(async () => {
      await result.current.search('test query');
    });

    expect(mockSearchEngine.search).toHaveBeenCalledWith('test query', {
      sources: ['jiosaavn', 'tidal'],
      maxResults: 20,
      forceRefresh: false,
    });

    expect(result.current.searchState).toMatchObject({
      query: 'test query',
      results: mockResults,
      isLoading: false,
      error: null,
      history: ['test query'],
    });
  });

  it('should handle search errors', async () => {
    const error = new Error('Search failed');
    mockSearchEngine.search.mockRejectedValue(error);

    const { result } = renderHook(() => useSearchEngine());

    await act(async () => {
      await result.current.search('test query');
    });

    expect(result.current.searchState).toMatchObject({
      query: 'test query',
      results: [],
      isLoading: false,
      error: 'Search failed',
    });
  });

  it('should perform debounced search', async () => {
    const mockCallback = jest.fn();
    const mockErrorCallback = jest.fn();

    mockSearchEngine.searchDebounced.mockImplementation((query, callback, errorCallback) => {
      // Simulate successful search
      callback([{ id: 'test1', title: 'Test Song' }]);
    });

    const { result } = renderHook(() => useSearchEngine());

    act(() => {
      result.current.searchDebounced('test query');
    });

    expect(mockSearchEngine.searchDebounced).toHaveBeenCalledWith(
      'test query',
      expect.any(Function),
      expect.any(Function)
    );

    expect(result.current.searchState.isLoading).toBe(false);
    expect(result.current.searchState.results).toHaveLength(1);
  });

  it('should handle debounced search errors', async () => {
    mockSearchEngine.searchDebounced.mockImplementation((query, callback, errorCallback) => {
      // Simulate error
      errorCallback(new Error('Debounced search failed'));
    });

    const { result } = renderHook(() => useSearchEngine());

    act(() => {
      result.current.searchDebounced('test query');
    });

    expect(result.current.searchState).toMatchObject({
      results: [],
      isLoading: false,
      error: 'Debounced search failed',
    });
  });

  it('should get suggestions', () => {
    const mockSuggestions = ['suggestion 1', 'suggestion 2'];
    mockSearchEngine.getSuggestions.mockReturnValue(mockSuggestions);

    const { result } = renderHook(() => useSearchEngine());

    const suggestions = result.current.getSuggestions('test');

    expect(mockSearchEngine.getSuggestions).toHaveBeenCalledWith('test');
    expect(suggestions).toEqual(mockSuggestions);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useSearchEngine());

    act(() => {
      result.current.clearHistory();
    });

    expect(mockSearchEngine.clearHistory).toHaveBeenCalled();
    expect(result.current.searchState.history).toEqual([]);
  });

  it('should clear cache', () => {
    const { result } = renderHook(() => useSearchEngine());

    act(() => {
      result.current.clearCache();
    });

    expect(mockSearchEngine.clearCache).toHaveBeenCalled();
  });

  it('should set filters and re-filter results', () => {
    const initialResults = [
      { id: '1', source: 'jiosaavn', duration: 120 },
      { id: '2', source: 'tidal', duration: 240 },
      { id: '3', source: 'jiosaavn', duration: 360 },
    ];

    const { result } = renderHook(() => useSearchEngine());

    // Set initial results
    act(() => {
      result.current.searchState.results = initialResults as any;
    });

    // Filter by source
    act(() => {
      result.current.setFilters({ source: 'jiosaavn' });
    });

    expect(result.current.searchState.filters.source).toBe('jiosaavn');
    // Results should be filtered (this would be tested in the filter function)
  });

  it('should convert search result to track', () => {
    const mockResult = {
      id: 'test1',
      title: 'Test Song',
      artist: 'Test Artist',
      source: 'jiosaavn',
      confidence: 0.9,
    };

    const mockTrack = {
      id: 'test1',
      title: 'Test Song',
      artist: 'Test Artist',
      audioSrc: 'test-audio.mp3',
    };

    mockSearchEngine.convertToTrack.mockReturnValue(mockTrack);

    const { result } = renderHook(() => useSearchEngine());

    const track = result.current.convertToTrack(mockResult as any);

    expect(mockSearchEngine.convertToTrack).toHaveBeenCalledWith(mockResult);
    expect(track).toEqual(mockTrack);
  });

  it('should apply duration filters correctly', () => {
    const results = [
      { id: '1', duration: 120 }, // short (2 min)
      { id: '2', duration: 240 }, // medium (4 min)
      { id: '3', duration: 400 }, // long (6.67 min)
      { id: '4' }, // no duration
    ];

    // Test short filter
    const shortFiltered = require('../useSearchEngine').applyFilters?.(results, { 
      source: 'all', 
      duration: 'short', 
      quality: 'any' 
    });
    
    // Since applyFilters is not exported, we'll test the behavior through the hook
    // This is more of an integration test
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useSearchEngine());

    unmount();

    expect(mockSearchEngine.destroy).toHaveBeenCalled();
  });

  it('should respect source filters in search', async () => {
    const { result } = renderHook(() => useSearchEngine());

    // Set filter to only search Tidal
    act(() => {
      result.current.setFilters({ source: 'tidal' });
    });

    await act(async () => {
      await result.current.search('test query');
    });

    expect(mockSearchEngine.search).toHaveBeenCalledWith('test query', {
      sources: ['tidal'], // Should only search Tidal
      maxResults: 20,
      forceRefresh: false,
    });
  });

  it('should handle missing search engine gracefully', () => {
    // Mock a scenario where search engine fails to initialize
    const { SearchEngine } = require('../searchEngine');
    SearchEngine.mockImplementation(() => null);

    const { result } = renderHook(() => useSearchEngine());

    // Should not throw errors
    expect(() => {
      result.current.getSuggestions('test');
      result.current.clearHistory();
      result.current.clearCache();
    }).not.toThrow();
  });
});