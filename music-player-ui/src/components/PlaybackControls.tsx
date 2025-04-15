import React from "react";
import { FaPlay, FaPause, FaStepBackward, FaStepForward } from "react-icons/fa"; // Import icons

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
    <div className="playback-controls">
      <button
        className="control-button prev-button"
        onClick={onPrev}
        aria-label="Previous track"
        disabled={!onPrev}
      >
        <FaStepBackward />
      </button>
      <button
        className="control-button play-pause-button"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>
      <button
        className="control-button next-button"
        onClick={onNext}
        aria-label="Next track"
        disabled={!onNext}
      >
        <FaStepForward />
      </button>
    </div>
  );
};

export default PlaybackControls;
