import React from "react";

interface SearchResultsProps {
  results: any[];
  onSelect: (song: any) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect }) => {
  if (!results.length) return null;

  return (
    <div className="search-results">
      <h3>Results</h3>
      <ul>
        {results.map((song) => (
          <li
            key={song.id}
            className="search-result-item"
            onClick={() => onSelect(song)}
          >
            {song.imageUrl && (
              <img
                src={song.imageUrl}
                alt={song.name}
                className="result-thumb"
              />
            )}
            <div className="result-info">
              <span className="result-title">{song.name}</span>
              <span className="result-artist">{song.primaryArtists}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchResults;
