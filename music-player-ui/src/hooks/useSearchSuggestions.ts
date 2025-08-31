/**
 * Hook for managing search suggestions and history
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

interface UseSearchSuggestionsOptions {
  maxHistoryItems?: number;
  maxSuggestions?: number;
  enablePopularSuggestions?: boolean;
  storageKey?: string;
}

interface UseSearchSuggestionsReturn {
  suggestions: string[];
  history: string[];
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  removeFromHistory: (query: string) => void;
  getSuggestionsForQuery: (query: string) => string[];
}

// Popular music-related search terms
const POPULAR_SEARCHES = [
  'Taylor Swift',
  'Ed Sheeran',
  'Billie Eilish',
  'The Weeknd',
  'Ariana Grande',
  'Drake',
  'Dua Lipa',
  'Post Malone',
  'Harry Styles',
  'Olivia Rodrigo',
  'Bad Bunny',
  'BTS',
  'Adele',
  'Justin Bieber',
  'Eminem',
  'Rihanna',
  'Bruno Mars',
  'Lady Gaga',
  'Coldplay',
  'Imagine Dragons',
  'Maroon 5',
  'OneRepublic',
  'Shawn Mendes',
  'Camila Cabello',
  'Selena Gomez',
  'Katy Perry',
  'Sia',
  'Alan Walker',
  'Marshmello',
  'Calvin Harris',
  // Add some popular song titles
  'Shape of You',
  'Blinding Lights',
  'Watermelon Sugar',
  'Levitating',
  'Good 4 U',
  'Stay',
  'Heat Waves',
  'As It Was',
  'Anti-Hero',
  'Flowers',
];

// Genre-based suggestions
const GENRE_SUGGESTIONS = [
  'pop music',
  'rock songs',
  'hip hop',
  'electronic music',
  'indie rock',
  'country music',
  'jazz classics',
  'classical music',
  'r&b songs',
  'reggae music',
  'folk songs',
  'blues music',
  'metal songs',
  'punk rock',
  'alternative rock',
];

// Mood-based suggestions
const MOOD_SUGGESTIONS = [
  'happy songs',
  'sad songs',
  'workout music',
  'chill music',
  'party songs',
  'love songs',
  'breakup songs',
  'motivational music',
  'relaxing music',
  'energetic songs',
  'nostalgic music',
  'feel good songs',
];

export const useSearchSuggestions = (
  options: UseSearchSuggestionsOptions = {}
): UseSearchSuggestionsReturn => {
  const {
    maxHistoryItems = 20,
    maxSuggestions = 8,
    enablePopularSuggestions = true,
    storageKey = 'music_search_history',
  } = options;

  const [history, setHistory] = useState<string[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, maxHistoryItems));
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, [storageKey, maxHistoryItems]);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, [history, storageKey]);

  // Add item to history
  const addToHistory = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setHistory(prev => {
      // Remove if already exists
      const filtered = prev.filter(item => item !== trimmedQuery);
      // Add to beginning
      const newHistory = [trimmedQuery, ...filtered];
      // Limit size
      return newHistory.slice(0, maxHistoryItems);
    });
  }, [maxHistoryItems]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Remove specific item from history
  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => prev.filter(item => item !== query));
  }, []);

  // Generate all available suggestions
  const allSuggestions = useMemo(() => {
    const suggestions = [...POPULAR_SEARCHES];
    
    if (enablePopularSuggestions) {
      suggestions.push(...GENRE_SUGGESTIONS, ...MOOD_SUGGESTIONS);
    }
    
    return suggestions;
  }, [enablePopularSuggestions]);

  // Get suggestions for a specific query
  const getSuggestionsForQuery = useCallback((query: string): string[] => {
    const trimmedQuery = query.trim().toLowerCase();
    
    if (!trimmedQuery) {
      // Return recent history for empty query
      return history.slice(0, maxSuggestions);
    }

    const suggestions: string[] = [];
    const seen = new Set<string>();

    // First, add matching history items
    for (const historyItem of history) {
      if (historyItem.toLowerCase().includes(trimmedQuery) && 
          suggestions.length < maxSuggestions) {
        suggestions.push(historyItem);
        seen.add(historyItem.toLowerCase());
      }
    }

    // Then add matching popular suggestions
    for (const suggestion of allSuggestions) {
      if (suggestions.length >= maxSuggestions) break;
      
      const suggestionLower = suggestion.toLowerCase();
      if (suggestionLower.includes(trimmedQuery) && 
          !seen.has(suggestionLower)) {
        suggestions.push(suggestion);
        seen.add(suggestionLower);
      }
    }

    // If we still need more suggestions, try partial word matches
    if (suggestions.length < maxSuggestions) {
      const words = trimmedQuery.split(/\s+/);
      
      for (const suggestion of allSuggestions) {
        if (suggestions.length >= maxSuggestions) break;
        
        const suggestionLower = suggestion.toLowerCase();
        if (!seen.has(suggestionLower)) {
          // Check if any word in the query matches any word in the suggestion
          const suggestionWords = suggestionLower.split(/\s+/);
          const hasWordMatch = words.some(queryWord => 
            suggestionWords.some(suggestionWord => 
              suggestionWord.startsWith(queryWord) || queryWord.startsWith(suggestionWord)
            )
          );
          
          if (hasWordMatch) {
            suggestions.push(suggestion);
            seen.add(suggestionLower);
          }
        }
      }
    }

    return suggestions;
  }, [history, allSuggestions, maxSuggestions]);

  // Current suggestions (for when no specific query is provided)
  const suggestions = useMemo(() => {
    return getSuggestionsForQuery('');
  }, [getSuggestionsForQuery]);

  return {
    suggestions,
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
    getSuggestionsForQuery,
  };
};

export default useSearchSuggestions;