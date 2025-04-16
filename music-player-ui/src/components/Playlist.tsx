import React from "react";
import { SpeakerHigh } from "phosphor-react";

interface Track {
  id: number | string;
  title: string;
  artist: string;
  audioSrc: string;
  albumArtUrl?: string;
  lrcUrl?: string;
}

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
  return (
    <div className="playlist">
      <h3 className="playlist-title">Playlist</h3>
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
            </div>
            {track.id === currentTrackId && (
              <div className="now-playing-indicator">
                <SpeakerHigh weight="fill" size={16} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Playlist;
