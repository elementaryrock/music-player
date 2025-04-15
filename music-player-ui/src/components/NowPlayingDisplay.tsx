import React from "react";

interface NowPlayingDisplayProps {
  albumArtUrl?: string; // Optional for now
  trackTitle: string;
  artistName: string;
}

const NowPlayingDisplay: React.FC<NowPlayingDisplayProps> = ({
  albumArtUrl,
  trackTitle,
  artistName,
}) => {
  const defaultAlbumArt =
    "https://via.placeholder.com/150/121212/FFFFFF?text=Music"; // Placeholder

  return (
    <div className="now-playing-display">
      <img
        src={albumArtUrl || defaultAlbumArt}
        alt={`Album art for ${trackTitle}`}
        className="album-art"
      />
      <div className="track-info">
        <h2 className="track-title">{trackTitle}</h2>
        <p className="artist-name">{artistName}</p>
      </div>
    </div>
  );
};

export default NowPlayingDisplay;
