import React from "react";

interface Track {
  id: number;
  title: string;
  artist: string;
  audioSrc: string;
  albumArtUrl?: string;
  lrcUrl?: string;
}

interface PlaylistProps {
  tracks: Track[];
  currentTrackId: number;
  onTrackSelect: (trackId: number) => void;
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
            <div className="playlist-track-info">
              <div className="playlist-track-title">{track.title}</div>
              <div className="playlist-track-artist">{track.artist}</div>
            </div>
            {track.albumArtUrl && (
              <div className="playlist-track-art">
                <img src={track.albumArtUrl} alt={`${track.title} album art`} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Playlist;
