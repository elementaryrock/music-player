import React, { FormEvent, useState, useRef, useEffect } from "react";
import "./SearchBar.css";

interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  children?: React.ReactNode; // For the search results dropdown
  hasResults?: boolean; // To indicate if there are search results
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  children,
  hasResults = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
    // Open dropdown when search is submitted
    setIsDropdownOpen(true);
  };

  // Function to handle clicks outside the search container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Show dropdown when there are results and query isn't empty
  useEffect(() => {
    setIsDropdownOpen(hasResults && query.trim() !== '');
  }, [hasResults, query]);

  return (
    <div className="search-container" ref={containerRef}>
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search for songs, artists, albums..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => hasResults && setIsDropdownOpen(true)}
        />
        <button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? "Searching..." : "Search"}
        </button>
      </form>
      
      {/* Dropdown for search results */}
      <div className={`search-dropdown ${isDropdownOpen ? 'active' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default SearchBar;
