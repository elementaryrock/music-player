import React from "react";

interface TrackProgressProps {
  currentTime: number;
  duration: number;
  onSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const TrackProgress: React.FC<TrackProgressProps> = ({
  currentTime,
  duration,
  onSeek,
}) => {
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
      return "0:00"; // Handle cases where duration isn't loaded yet
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="track-progress">
      <span className="time current-time">{formatTime(currentTime)}</span>
      <input
        type="range"
        className="progress-bar"
        min="0"
        max={duration || 0} // Ensure max is not NaN
        value={currentTime}
        onChange={onSeek} // Attach the handler
        aria-label="Track progress"
      />
      <span className="time duration">{formatTime(duration)}</span>
    </div>
  );
};

export default TrackProgress;
