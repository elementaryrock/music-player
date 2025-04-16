import React from "react";
import { SpeakerHigh } from "phosphor-react";
import { Track } from "../types/api.types";

interface PlaylistProps {
  tracks: Track[];
  currentTrackId: number | string;
  onTrackSelect: (trackId: number | string) => void;
}

const Playlist: React.FC<PlaylistProps> = ({
  tracks,
  currentTrackId,
  onTrackSelect,
}) => {
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="playlist">
      <h3 className="playlist-title">Playlist ({tracks.length})</h3>
      {tracks.length === 0 ? (
        <div className="empty-playlist">
          <p>Your playlist is empty. Search for songs to add them here.</p>
        </div>
      ) : (
        <ul className="playlist-tracks">
          {tracks.map((track) => (
            <li
              key={track.id}
              className={`playlist-track ${
                track.id === currentTrackId ? "active" : ""
              }`}
              onClick={() => onTrackSelect(track.id)}
            >
              {track.albumArtUrl && (
                <div className="playlist-track-art">
                  <img src={track.albumArtUrl} alt={`${track.title} album art`} />
                </div>
              )}
              <div className="playlist-track-info">
                <div className="playlist-track-title">{track.title}</div>
                <div className="playlist-track-artist">{track.artist}</div>
                {track.album && (
                  <div className="playlist-track-album">{track.album}</div>
                )}
              </div>
              <div className="playlist-track-duration">
                {formatDuration(track.duration)}
              </div>
              {track.id === currentTrackId && (
                <div className="now-playing-indicator">
                  <SpeakerHigh weight="fill" size={16} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Playlist;
