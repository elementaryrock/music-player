/**
 * Tests for useSearchSuggestions hook
 */

import { renderHook, act } from '@testing-library/react';
import { useSearchSuggestions } from '../useSearchSuggestions';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSearchSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('initializes with empty history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    expect(result.current.history).toEqual([]);
    expect(result.current.suggestions).toEqual([]);
  });

  it('loads history from localStorage on mount', () => {
    const savedHistory = ['saved search 1', 'saved search 2'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory));

    const { result } = renderHook(() => useSearchSuggestions());

    expect(result.current.history).toEqual(savedHistory);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('music_search_history');
  });

  it('handles invalid localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useSearchSuggestions());

    expect(result.current.history).toEqual([]);
  });

  it('uses custom storage key', () => {
    const customKey = 'custom_search_history';
    renderHook(() => useSearchSuggestions({ storageKey: customKey }));

    expect(localStorageMock.getItem).toHaveBeenCalledWith(customKey);
  });

  it('adds items to history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('test search');
    });

    expect(result.current.history).toEqual(['test search']);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'music_search_history',
      JSON.stringify(['test search'])
    );
  });

  it('adds new items to the beginning of history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('first search');
    });

    act(() => {
      result.current.addToHistory('second search');
    });

    expect(result.current.history).toEqual(['second search', 'first search']);
  });

  it('removes duplicates when adding to history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('test search');
    });

    act(() => {
      result.current.addToHistory('other search');
    });

    act(() => {
      result.current.addToHistory('test search'); // Duplicate
    });

    expect(result.current.history).toEqual(['test search', 'other search']);
  });

  it('limits history size', () => {
    const { result } = renderHook(() => useSearchSuggestions({ maxHistoryItems: 3 }));

    act(() => {
      result.current.addToHistory('search 1');
      result.current.addToHistory('search 2');
      result.current.addToHistory('search 3');
      result.current.addToHistory('search 4'); // Should remove oldest
    });

    expect(result.current.history).toEqual(['search 4', 'search 3', 'search 2']);
    expect(result.current.history).toHaveLength(3);
  });

  it('ignores empty or whitespace-only queries', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('');
      result.current.addToHistory('   ');
      result.current.addToHistory('\t\n');
    });

    expect(result.current.history).toEqual([]);
  });

  it('clears all history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('test search');
    });

    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
      'music_search_history',
      JSON.stringify([])
    );
  });

  it('removes specific items from history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('search 1');
      result.current.addToHistory('search 2');
      result.current.addToHistory('search 3');
    });

    act(() => {
      result.current.removeFromHistory('search 2');
    });

    expect(result.current.history).toEqual(['search 3', 'search 1']);
  });

  it('returns suggestions for empty query from history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('recent search 1');
      result.current.addToHistory('recent search 2');
    });

    const suggestions = result.current.getSuggestionsForQuery('');

    expect(suggestions).toEqual(['recent search 2', 'recent search 1']);
  });

  it('returns matching suggestions for query', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    const suggestions = result.current.getSuggestionsForQuery('taylor');

    expect(suggestions).toContain('Taylor Swift');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('prioritizes history items in suggestions', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('Taylor Swift - Love Story');
    });

    const suggestions = result.current.getSuggestionsForQuery('taylor');

    expect(suggestions[0]).toBe('Taylor Swift - Love Story');
    expect(suggestions).toContain('Taylor Swift');
  });

  it('limits number of suggestions returned', () => {
    const { result } = renderHook(() => useSearchSuggestions({ maxSuggestions: 3 }));

    const suggestions = result.current.getSuggestionsForQuery('music');

    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('handles case-insensitive matching', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    const suggestions = result.current.getSuggestionsForQuery('TAYLOR');

    expect(suggestions).toContain('Taylor Swift');
  });

  it('includes genre and mood suggestions when enabled', () => {
    const { result } = renderHook(() => useSearchSuggestions({ enablePopularSuggestions: true }));

    const suggestions = result.current.getSuggestionsForQuery('pop');

    expect(suggestions).toContain('pop music');
  });

  it('excludes genre and mood suggestions when disabled', () => {
    const { result } = renderHook(() => useSearchSuggestions({ enablePopularSuggestions: false }));

    const suggestions = result.current.getSuggestionsForQuery('pop');

    expect(suggestions).not.toContain('pop music');
  });

  it('performs partial word matching', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    const suggestions = result.current.getSuggestionsForQuery('ed she');

    expect(suggestions).toContain('Ed Sheeran');
  });

  it('handles multi-word queries', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    const suggestions = result.current.getSuggestionsForQuery('happy songs');

    expect(suggestions).toContain('happy songs');
  });

  it('avoids duplicate suggestions', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('Taylor Swift');
    });

    const suggestions = result.current.getSuggestionsForQuery('taylor');

    // Should only appear once (from history, not from popular suggestions)
    const taylorCount = suggestions.filter(s => s === 'Taylor Swift').length;
    expect(taylorCount).toBe(1);
  });

  it('saves to localStorage when history changes', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('test search');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'music_search_history',
      JSON.stringify(['test search'])
    );
  });

  it('handles localStorage errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const { result } = renderHook(() => useSearchSuggestions());

    // Should not throw
    expect(() => {
      act(() => {
        result.current.addToHistory('test search');
      });
    }).not.toThrow();
  });

  it('trims whitespace from queries before adding to history', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    act(() => {
      result.current.addToHistory('  test search  ');
    });

    expect(result.current.history).toEqual(['test search']);
  });

  it('returns empty array for suggestions when query has no matches', () => {
    const { result } = renderHook(() => useSearchSuggestions());

    const suggestions = result.current.getSuggestionsForQuery('xyznonexistent');

    expect(suggestions).toEqual([]);
  });

  it('respects maxHistoryItems when loading from localStorage', () => {
    const longHistory = Array.from({ length: 50 }, (_, i) => `search ${i}`);
    localStorageMock.getItem.mockReturnValue(JSON.stringify(longHistory));

    const { result } = renderHook(() => useSearchSuggestions({ maxHistoryItems: 10 }));

    expect(result.current.history).toHaveLength(10);
  });

  it('handles non-array data from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ not: 'an array' }));

    const { result } = renderHook(() => useSearchSuggestions());

    expect(result.current.history).toEqual([]);
  });
});