/**
 * SearchSuggestions Component
 * 
 * Displays search suggestions including history and popular searches
 */

import React, { useState, useEffect, useRef } from 'react';
import './SearchSuggestions.css';

export interface SearchSuggestionsProps {
  query: string;
  suggestions: string[];
  history: string[];
  isVisible: boolean;
  onSuggestionSelect: (suggestion: string) => void;
  onHistoryItemSelect: (item: string) => void;
  onClearHistory?: () => void;
  maxSuggestions?: number;
  maxHistoryItems?: number;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  suggestions,
  history,
  isVisible,
  onSuggestionSelect,
  onHistoryItemSelect,
  onClearHistory,
  maxSuggestions = 8,
  maxHistoryItems = 5,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter suggestions to remove duplicates with history
  const filteredSuggestions = suggestions
    .filter(suggestion => !history.includes(suggestion))
    .slice(0, maxSuggestions);

  // Get recent history items
  const recentHistory = history.slice(0, maxHistoryItems);

  // Total items for keyboard navigation
  const totalItems = recentHistory.length + filteredSuggestions.length;

  // Reset selection when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setSelectedIndex(-1);
    }
  }, [isVisible]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible || totalItems === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0) {
            handleItemSelect(selectedIndex);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setSelectedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, totalItems, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  const handleItemSelect = (index: number) => {
    if (index < recentHistory.length) {
      // History item
      onHistoryItemSelect(recentHistory[index]);
    } else {
      // Suggestion item
      const suggestionIndex = index - recentHistory.length;
      onSuggestionSelect(filteredSuggestions[suggestionIndex]);
    }
  };

  const handleMouseEnter = (index: number) => {
    setSelectedIndex(index);
  };

  const handleMouseLeave = () => {
    setSelectedIndex(-1);
  };

  if (!isVisible || (recentHistory.length === 0 && filteredSuggestions.length === 0)) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="search-suggestions"
      role="listbox"
      aria-label="Search suggestions"
    >
      {/* Recent History Section */}
      {recentHistory.length > 0 && (
        <div className="suggestions-section">
          <div className="suggestions-header">
            <span className="suggestions-title">Recent Searches</span>
            {onClearHistory && (
              <button
                className="clear-history-btn"
                onClick={onClearHistory}
                aria-label="Clear search history"
              >
                Clear
              </button>
            )}
          </div>
          <div className="suggestions-list">
            {recentHistory.map((item, index) => (
              <div
                key={`history-${index}`}
                ref={el => itemRefs.current[index] = el}
                className={`suggestion-item history-item ${
                  selectedIndex === index ? 'selected' : ''
                }`}
                onClick={() => handleItemSelect(index)}
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={handleMouseLeave}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <div className="suggestion-icon">
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="suggestion-text">{item}</span>
                <div className="suggestion-action">
                  <svg 
                    width="14" 
                    height="14" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Section */}
      {filteredSuggestions.length > 0 && (
        <div className="suggestions-section">
          {recentHistory.length > 0 && (
            <div className="suggestions-header">
              <span className="suggestions-title">Suggestions</span>
            </div>
          )}
          <div className="suggestions-list">
            {filteredSuggestions.map((suggestion, index) => {
              const globalIndex = recentHistory.length + index;
              return (
                <div
                  key={`suggestion-${index}`}
                  ref={el => itemRefs.current[globalIndex] = el}
                  className={`suggestion-item ${
                    selectedIndex === globalIndex ? 'selected' : ''
                  }`}
                  onClick={() => handleItemSelect(globalIndex)}
                  onMouseEnter={() => handleMouseEnter(globalIndex)}
                  onMouseLeave={handleMouseLeave}
                  role="option"
                  aria-selected={selectedIndex === globalIndex}
                >
                  <div className="suggestion-icon">
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                  </div>
                  <span className="suggestion-text">
                    {highlightMatch(suggestion, query)}
                  </span>
                  <div className="suggestion-action">
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <path d="M7 17L17 7M17 7H7M17 7V17" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results message */}
      {query.trim() && recentHistory.length === 0 && filteredSuggestions.length === 0 && (
        <div className="suggestions-section">
          <div className="no-suggestions">
            <div className="no-suggestions-icon">
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <span className="no-suggestions-text">No suggestions found</span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Highlight matching text in suggestions
 */
const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (regex.test(part)) {
      return (
        <mark key={index} className="suggestion-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
};

export default SearchSuggestions;