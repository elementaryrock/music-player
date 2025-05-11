import React from "react";
import "./SearchResults.css";

interface SearchResultsProps {
  results: any[];
  onSelect: (song: any) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ results, onSelect }) => {
  if (!results.length) return null;

  // Function to get a valid image URL from different possible formats
  const getImageUrl = (song: any): string => {
    if (song.imageUrl) return song.imageUrl;
    
    if (song.image) {
      // Handle array of images
      if (Array.isArray(song.image) && song.image.length > 0) {
        return song.image[song.image.length - 1].link || song.image[song.image.length - 1].url || '';
      }
      // Handle image as string
      if (typeof song.image === 'string') return song.image;
      // Handle image as object
      if (typeof song.image === 'object' && song.image) {
        return song.image.link || song.image.url || '';
      }
    }
    
    // Fallback to placeholder
    return 'https://via.placeholder.com/150x150?text=No+Image';
  };

  // Function to get artist name from different possible formats
  const getArtistName = (song: any): string => {
    return song.primaryArtists || song.artist || 'Unknown Artist';
  };

  return (
    <div className="search-results">
      <h3 className="search-results-title">Results</h3>
      <ul className="search-results-list">
        {results.map((song) => (
          <li
            key={song.id || Math.random().toString()}
            className="search-result-item"
            onClick={() => onSelect(song)}
          >
            <div className="result-thumb-container">
              <img
                src={getImageUrl(song)}
                alt={song.name || 'Album art'}
                className="result-thumb"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x150?text=Music';
                }}
              />
            </div>
            <div className="result-info">
              <span className="result-title">{song.name || 'Unknown Title'}</span>
              <span className="result-artist">{getArtistName(song)}</span>
              {song.year && <span className="result-year">{song.year}</span>}
            </div>
            <button className="result-play-button" aria-label="Play song">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchResults;
