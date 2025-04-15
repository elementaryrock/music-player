import React from "react";
import { Play, Pause, SkipBack, SkipForward } from "phosphor-react"; // Premium icon set

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev?: () => void; // Optional for now
  onNext?: () => void; // Optional for now
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
}) => {
  return (
    <div className="playback-controls-container">
      <div className="playback-controls">
        <button
          className="control-button prev-button"
          onClick={onPrev}
          aria-label="Previous track"
          disabled={!onPrev}
          type="button"
        >
          <SkipBack weight="fill" size={22} />
        </button>
        <button
          className="control-button play-pause-button"
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          type="button"
        >
          {isPlaying ? (
            <Pause weight="fill" size={28} />
          ) : (
            <Play weight="fill" size={28} />
          )}
        </button>
        <button
          className="control-button next-button"
          onClick={onNext}
          aria-label="Next track"
          disabled={!onNext}
          type="button"
        >
          <SkipForward weight="fill" size={22} />
        </button>
      </div>
    </div>
  );
};

export default PlaybackControls;
