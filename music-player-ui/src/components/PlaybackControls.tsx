import React from "react";
import { Play, Pause, SkipBack, SkipForward } from "phosphor-react"; // Premium icon set
import VolumeControl from "./VolumeControl";

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
          <SkipBack weight="thin" size={24} />
        </button>
        <button
          className="control-button play-pause-button"
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
          type="button"
        >
          {isPlaying ? (
            <Pause weight="regular" size={30} />
          ) : (
            <Play weight="regular" size={30} />
          )}
        </button>
        <button
          className="control-button next-button"
          onClick={onNext}
          aria-label="Next track"
          disabled={!onNext}
          type="button"
        >
          <SkipForward weight="thin" size={24} />
        </button>

        {/* Volume control */}
        <div className="volume-control-wrapper">
          <VolumeControl />
        </div>
      </div>
    </div>
  );
};

export default PlaybackControls;
