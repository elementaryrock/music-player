import React, { useState } from "react";
import { Heart } from "phosphor-react";
import AudioFormatInfo from "./AudioFormatInfo";

interface NowPlayingDisplayProps {
  albumArtUrl?: string; // Optional for now
  trackTitle: string;
  artistName: string;
  initialLiked?: boolean;
  onLikeToggle?: (liked: boolean) => void;
  currentTrack?: {
    audioSrc: string;
    source?: string;
  };
  currentQuality?: string;
}

const NowPlayingDisplay: React.FC<NowPlayingDisplayProps> = ({
  albumArtUrl,
  trackTitle,
  artistName,
  initialLiked = false,
  onLikeToggle,
  currentTrack,
  currentQuality,
}) => {
  const [isLiked, setIsLiked] = useState<boolean>(initialLiked);
  const defaultAlbumArt =
    "https://via.placeholder.com/150/121212/FFFFFF?text=Music"; // Placeholder

  const handleLikeClick = () => {
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    if (onLikeToggle) {
      onLikeToggle(newLikedState);
    }
  };

  return (
    <div className="now-playing-display">
      <div className="album-art-container">
        <img
          src={albumArtUrl || defaultAlbumArt}
          alt={`Album art for ${trackTitle}`}
          className="album-art"
        />
      </div>
      <div className="track-info-container">
        <div className="track-info">
          <h2 className="track-title">{trackTitle}</h2>
          <p className="artist-name">{artistName}</p>
          {currentTrack && (
            <AudioFormatInfo
              currentTrack={currentTrack}
              currentQuality={currentQuality}
              className="compact"
            />
          )}
        </div>
        <button
          className="like-button"
          onClick={handleLikeClick}
          aria-label={isLiked ? "Unlike" : "Like"}
          type="button"
        >
          <Heart
            weight={isLiked ? "fill" : "regular"}
            className={`heart-icon ${isLiked ? "liked" : ""}`}
            size={24}
          />
        </button>
      </div>
    </div>
  );
};

export default NowPlayingDisplay;
