/**
 * SearchFilters Component
 * 
 * Provides filtering and sorting options for search results
 */

import React, { useState, useRef, useEffect } from 'react';
import './SearchFilters.css';

export interface FilterOptions {
  source: 'all' | 'jiosaavn' | 'tidal';
  duration: 'any' | 'short' | 'medium' | 'long';
  quality: 'any' | 'high' | 'lossless';
  sortBy: 'relevance' | 'title' | 'artist' | 'duration' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

export interface SearchFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  resultCount?: number;
  isVisible?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  resultCount = 0,
  isVisible = false,
  onToggle,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    const newFilters = { ...filters, [key]: value };
    onFiltersChange(newFilters);
  };

  const resetFilters = () => {
    const defaultFilters: FilterOptions = {
      source: 'all',
      duration: 'any',
      quality: 'any',
      sortBy: 'relevance',
      sortOrder: 'desc',
    };
    onFiltersChange(defaultFilters);
  };

  const hasActiveFilters = () => {
    return (
      filters.source !== 'all' ||
      filters.duration !== 'any' ||
      filters.quality !== 'any' ||
      filters.sortBy !== 'relevance'
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.source !== 'all') count++;
    if (filters.duration !== 'any') count++;
    if (filters.quality !== 'any') count++;
    if (filters.sortBy !== 'relevance') count++;
    return count;
  };

  if (!isVisible) return null;

  return (
    <div ref={filtersRef} className={`search-filters ${disabled ? 'disabled' : ''}`}>
      {/* Filter Toggle Button */}
      <div className="filters-header">
        <button
          className={`filters-toggle ${isExpanded ? 'expanded' : ''} ${hasActiveFilters() ? 'has-filters' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Hide' : 'Show'} search filters`}
        >
          <div className="filters-toggle-content">
            <svg 
              className="filters-icon" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="filters-text">
              Filters
              {hasActiveFilters() && (
                <span className="active-count">({getActiveFilterCount()})</span>
              )}
            </span>
            <svg 
              className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Result Count */}
        <div className="result-count">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className={`filters-panel ${isExpanded ? 'expanded' : ''}`}>
        <div className="filters-content">
          {/* Source Filter */}
          <div className="filter-group">
            <label className="filter-label">Source</label>
            <div className="filter-options">
              {[
                { value: 'all', label: 'All Sources' },
                { value: 'jiosaavn', label: 'JioSaavn' },
                { value: 'tidal', label: 'Tidal' },
              ].map(option => (
                <button
                  key={option.value}
                  className={`filter-option ${filters.source === option.value ? 'active' : ''}`}
                  onClick={() => handleFilterChange('source', option.value)}
                  disabled={disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Filter */}
          <div className="filter-group">
            <label className="filter-label">Duration</label>
            <div className="filter-options">
              {[
                { value: 'any', label: 'Any Length' },
                { value: 'short', label: 'Short (< 3min)' },
                { value: 'medium', label: 'Medium (3-5min)' },
                { value: 'long', label: 'Long (> 5min)' },
              ].map(option => (
                <button
                  key={option.value}
                  className={`filter-option ${filters.duration === option.value ? 'active' : ''}`}
                  onClick={() => handleFilterChange('duration', option.value)}
                  disabled={disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Filter */}
          <div className="filter-group">
            <label className="filter-label">Quality</label>
            <div className="filter-options">
              {[
                { value: 'any', label: 'Any Quality' },
                { value: 'high', label: 'High Quality' },
                { value: 'lossless', label: 'Lossless Only' },
              ].map(option => (
                <button
                  key={option.value}
                  className={`filter-option ${filters.quality === option.value ? 'active' : ''}`}
                  onClick={() => handleFilterChange('quality', option.value)}
                  disabled={disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <div className="sort-controls">
              <select
                className="sort-select"
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                disabled={disabled}
              >
                <option value="relevance">Relevance</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="duration">Duration</option>
                <option value="popularity">Popularity</option>
              </select>
              
              <button
                className={`sort-order-btn ${filters.sortOrder === 'desc' ? 'desc' : 'asc'}`}
                onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                disabled={disabled}
                aria-label={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                title={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  {filters.sortOrder === 'asc' ? (
                    <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
                  ) : (
                    <path d="M3 7l6 6 4-4 8 8M21 17v-6h-6" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="filter-actions">
            <button
              className="reset-filters-btn"
              onClick={resetFilters}
              disabled={disabled || !hasActiveFilters()}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;