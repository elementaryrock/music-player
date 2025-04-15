import React, { useState, useEffect } from "react";
import { FaVolumeUp, FaVolumeDown, FaVolumeMute } from "react-icons/fa";

interface VolumeControlProps {
  initialVolume?: number;
}

const VolumeControl: React.FC<VolumeControlProps> = ({
  initialVolume = 0.7,
}) => {
  const [volume, setVolume] = useState<number>(initialVolume);
  const [prevVolume, setPrevVolume] = useState<number>(initialVolume); // Store previous volume when muting
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Update audio element volume when volume state changes
  useEffect(() => {
    const audioElements = document.getElementsByTagName("audio");
    if (audioElements.length > 0) {
      const audioEl = audioElements[0];
      audioEl.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      // Restore previous volume if it was muted
      if (volume === 0) {
        setVolume(prevVolume > 0 ? prevVolume : 0.5);
      }
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
    }
  };

  // Determine which volume icon to show
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <FaVolumeMute />;
    } else if (volume < 0.5) {
      return <FaVolumeDown />;
    } else {
      return <FaVolumeUp />;
    }
  };

  return (
    <div className="volume-control">
      <button
        className="volume-button control-button"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute" : "Mute"}
        type="button"
      >
        {getVolumeIcon()}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={handleVolumeChange}
        className="volume-slider"
        aria-label="Volume"
      />
    </div>
  );
};

export default VolumeControl;
