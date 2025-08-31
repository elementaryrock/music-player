import React, { FormEvent, useState, useRef, useEffect, useCallback } from "react";
import "./SearchBar.css";

export interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: (query?: string) => void;
  onDebounceSearch?: (query: string) => void;
  isSearching: boolean;
  error?: string | null;
  children?: React.ReactNode; // For the search results dropdown
  hasResults?: boolean; // To indicate if there are search results
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showClearButton?: boolean;
  onClear?: () => void;
  debounceMs?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  onSearch,
  onDebounceSearch,
  isSearching,
  error,
  children,
  hasResults = false,
  placeholder = "Search for songs, artists, albums...",
  disabled = false,
  autoFocus = false,
  showClearButton = true,
  onClear,
  debounceMs = 300,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle form submission
  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (disabled || !query.trim()) return;
    
    onSearch(query.trim());
    setIsDropdownOpen(true);
  }, [disabled, query, onSearch]);

  // Handle input change with debouncing
  const handleInputChange = useCallback((value: string) => {
    onQueryChange(value);
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set up debounced search
    if (onDebounceSearch && value.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        onDebounceSearch(value.trim());
      }, debounceMs);
    }
  }, [onQueryChange, onDebounceSearch, debounceMs]);

  // Handle clear button
  const handleClear = useCallback(() => {
    onQueryChange('');
    setIsDropdownOpen(false);
    if (onClear) {
      onClear();
    }
    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onQueryChange, onClear]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (hasResults && query.trim()) {
      setIsDropdownOpen(true);
    }
  }, [hasResults, query]);

  // Handle input blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Delay closing dropdown to allow for clicks
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsDropdownOpen(false);
      }
    }, 150);
  }, []);

  // Handle clicks outside the search container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Show dropdown when there are results and query isn't empty
  useEffect(() => {
    if (hasResults && query.trim() && (isFocused || isDropdownOpen)) {
      setIsDropdownOpen(true);
    } else if (!hasResults || !query.trim()) {
      setIsDropdownOpen(false);
    }
  }, [hasResults, query, isFocused, isDropdownOpen]);

  // Auto focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  }, []);

  const hasQuery = query.trim().length > 0;
  const showError = error && !isSearching;

  return (
    <div 
      className={`search-container ${disabled ? 'disabled' : ''} ${showError ? 'has-error' : ''}`} 
      ref={containerRef}
    >
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-icon">
          {isSearching ? (
            <div className="search-spinner" aria-label="Searching">
              <svg 
                className="spinner" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              width="20" 
              height="20" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Search for music"
          aria-describedby={showError ? "search-error" : undefined}
          aria-expanded={isDropdownOpen}
          aria-autocomplete="list"
          role="combobox"
        />
        
        {/* Clear button */}
        {showClearButton && hasQuery && !isSearching && (
          <button
            type="button"
            className="clear-button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
            tabIndex={-1}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        
        <button 
          type="submit" 
          disabled={isSearching || !hasQuery || disabled}
          aria-label={isSearching ? "Searching..." : "Search"}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>
      
      {/* Error message */}
      {showError && (
        <div id="search-error" className="search-error" role="alert">
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
      
      {/* Dropdown for search results */}
      <div 
        className={`search-dropdown ${isDropdownOpen ? 'active' : ''}`}
        role="listbox"
        aria-label="Search results"
      >
        {children}
      </div>
    </div>
  );
};

export default SearchBar;
