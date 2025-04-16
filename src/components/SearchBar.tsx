import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, X } from 'phosphor-react';
import { searchSongs } from '../services/api';
import { SaavnSong, Track, convertSaavnSongToTrack } from '../types/api.types';

interface SearchBarProps {
  onAddToPlaylist: (track: Track) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onAddToPlaylist }) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SaavnSong[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle search when query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearching(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async () => {
    if (query.trim().length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchSongs(query);
      setResults(searchResults.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    setIsSearching(true);
  };

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleAddTrack = (song: SaavnSong) => {
    const track = convertSaavnSongToTrack(song);
    onAddToPlaylist(track);
    setIsSearching(false);
    setQuery('');
    setResults([]);
  };

  const formatDuration = (seconds: string) => {
    const totalSeconds = parseInt(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="search-container" ref={searchContainerRef}>
      <div className="search-input-container">
        <MagnifyingGlass size={20} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search for songs..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />
        {query && (
          <button
            className="clear-search-button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            type="button"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="search-results">
          {isLoading && <div className="search-loading">Searching...</div>}
          
          {error && <div className="search-error">{error}</div>}
          
          {!isLoading && !error && results.length === 0 && query.trim().length > 2 && (
            <div className="no-results">No songs found</div>
          )}
          
          {!isLoading && results.length > 0 && (
            <ul className="results-list">
              {results.map((song) => (
                <li key={song.id} className="result-item" onClick={() => handleAddTrack(song)}>
                  <div className="result-image">
                    <img 
                      src={song.image[song.image.length - 1]?.link || ''} 
                      alt={song.name} 
                    />
                  </div>
                  <div className="result-info">
                    <div className="result-title">{song.name}</div>
                    <div className="result-artist">{song.primaryArtists}</div>
                  </div>
                  <div className="result-duration">{formatDuration(song.duration)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
