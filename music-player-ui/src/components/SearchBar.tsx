import React, { FormEvent } from "react";

interface SearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onQueryChange,
  onSearch,
  isSearching,
}) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search for songs, artists, albums..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <button type="submit" disabled={isSearching || !query.trim()}>
        {isSearching ? "Searching..." : "Search"}
      </button>
    </form>
  );
};

export default SearchBar;
