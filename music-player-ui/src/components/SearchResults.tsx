import React, { useCallback, useMemo } from "react";
import "./SearchResults.css";
import { SearchResult } from "../services/searchEngine";
import { SearchResultProcessor } from "../services/searchResultProcessor";

export interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
  isLoading?: boolean;
  error?: string | null;
  query?: string;
  emptyMessage?: string;
  showSource?: boolean;
  showDuration?: boolean;
  showQuality?: boolean;
  maxResults?: number;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onSelect,
  isLoading = false,
  error = null,
  query = '',
  emptyMessage = 'No results found',
  showSource = true,
  showDuration = true,
  showQuality = true,
  maxResults,
}) => {
  // Limit results if maxResults is specified
  const displayResults = useMemo(() => {
    return maxResults ? results.slice(0, maxResults) : results;
  }, [results, maxResults]);

  // Handle result selection
  const handleSelect = useCallback((result: SearchResult, event: React.MouseEvent) => {
    event.preventDefault();
    onSelect(result);
  }, [onSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((result: SearchResult, event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(result);
    }
  }, [onSelect]);

  // Get image URL with proper fallback
  const getImageUrl = useCallback((result: SearchResult): string => {
    if (result.imageUrl) return result.imageUrl;
    
    // Use a music-themed placeholder
    return `https://via.placeholder.com/150x150/1a1a1a/ffffff?text=${encodeURIComponent(result.title.charAt(0).toUpperCase())}`;
  }, []);

  // Handle image error
  const handleImageError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'true';
      img.src = 'https://via.placeholder.com/150x150/1a1a1a/ffffff?text=♪';
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="search-results loading">
        <div className="search-results-header">
          <h3 className="search-results-title">Searching...</h3>
        </div>
        <div className="search-results-loading">
          <div className="loading-spinner" aria-label="Loading search results">
            <svg 
              className="spinner" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </div>
          <p>Finding the best music for you...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="search-results error">
        <div className="search-results-header">
          <h3 className="search-results-title">Search Error</h3>
        </div>
        <div className="search-results-error" role="alert">
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="error-message">{error}</p>
            <p className="error-suggestion">Try searching with different keywords or check your connection.</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!displayResults.length) {
    return (
      <div className="search-results empty">
        <div className="search-results-header">
          <h3 className="search-results-title">No Results</h3>
        </div>
        <div className="search-results-empty">
          <svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="empty-message">{emptyMessage}</p>
          {query && (
            <p className="empty-suggestion">
              No results found for "<strong>{query}</strong>". Try different keywords or check spelling.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h3 className="search-results-title">
          Results {query && <span className="query-highlight">for "{query}"</span>}
        </h3>
        <span className="results-count">
          {displayResults.length} {displayResults.length === 1 ? 'result' : 'results'}
          {maxResults && results.length > maxResults && (
            <span className="more-results"> (showing first {maxResults})</span>
          )}
        </span>
      </div>
      
      <ul className="search-results-list" role="listbox" aria-label="Search results">
        {displayResults.map((result, index) => (
          <li
            key={result.id}
            className="search-result-item"
            onClick={(e) => handleSelect(result, e)}
            onKeyDown={(e) => handleKeyDown(result, e)}
            role="option"
            tabIndex={0}
            aria-label={`${result.title} by ${result.artist}`}
          >
            <div className="result-thumb-container">
              <img
                src={getImageUrl(result)}
                alt={`${result.title} album art`}
                className="result-thumb"
                onError={handleImageError}
                loading="lazy"
              />
            </div>
            
            <div className="result-info">
              <span className="result-title" title={result.title}>
                {result.title}
              </span>
              <span className="result-artist" title={result.artist}>
                {result.artist}
              </span>
              
              <div className="result-metadata">
                {result.album && (
                  <span className="result-album" title={result.album}>
                    {result.album}
                  </span>
                )}
                
                {showDuration && result.duration && (
                  <span className="result-duration">
                    {SearchResultProcessor.formatDuration(result.duration)}
                  </span>
                )}
                
                {showSource && (
                  <span className={`result-source source-${result.source}`}>
                    {SearchResultProcessor.getSourceDisplayName(result.source)}
                  </span>
                )}
                
                {showQuality && (
                  <span className={`result-quality quality-${result.source}`}>
                    {SearchResultProcessor.getQualityLabel(result)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="result-actions">
              <div className="result-confidence" title={`Relevance: ${Math.round(result.confidence * 100)}%`}>
                <div 
                  className="confidence-bar"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
              
              <button 
                className="result-play-button" 
                aria-label={`Play ${result.title} by ${result.artist}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(result, e);
                }}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  width="20" 
                  height="20" 
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchResults;
