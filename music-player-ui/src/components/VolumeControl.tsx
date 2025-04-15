import React, { useState, useEffect, useRef } from "react";
import { SpeakerHigh, SpeakerLow, SpeakerX } from "phosphor-react";

interface VolumeControlProps {
  initialVolume?: number;
}

const VolumeControl: React.FC<VolumeControlProps> = ({
  initialVolume = 0.7,
}) => {
  const [volume, setVolume] = useState<number>(initialVolume);
  const [prevVolume, setPrevVolume] = useState<number>(initialVolume); // Store previous volume when muting
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSliderVisible, setIsSliderVisible] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Update audio element volume when volume state changes
  useEffect(() => {
    const audioElements = document.getElementsByTagName("audio");
    if (audioElements.length > 0) {
      const audioEl = audioElements[0];
      audioEl.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Removed unused handleVolumeChange function

  // Calculate volume based on mouse position
  const calculateVolumeFromMousePosition = (clientY: number) => {
    if (!trackRef.current) return volume;

    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    const clickPosition = rect.bottom - clientY; // Distance from bottom
    return Math.max(0, Math.min(1, clickPosition / trackHeight));
  };

  // Custom handler for clicking directly on the slider track
  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const newVolume = calculateVolumeFromMousePosition(e.clientY);
    setVolume(newVolume);
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  };

  // Handle mouse down on thumb to start dragging
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling to track
    setIsDragging(true);
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newVolume = calculateVolumeFromMousePosition(e.clientY);
        setVolume(newVolume);
        if (isMuted && newVolume > 0) {
          setIsMuted(false);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isMuted, volume, calculateVolumeFromMousePosition]);

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

  const toggleVolumeSlider = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up
    setIsSliderVisible(!isSliderVisible);
  };

  // Only toggle the slider visibility when clicking the volume icon
  const handleVolumeIconClick = (e: React.MouseEvent) => {
    toggleVolumeSlider(e);
  };

  // Handle clicks outside the volume control to close the slider
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        volumeControlRef.current &&
        !volumeControlRef.current.contains(event.target as Node)
      ) {
        setIsSliderVisible(false);
      }
    };

    if (isSliderVisible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSliderVisible]);

  // Determine which volume icon to show
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <SpeakerX weight="thin" size={24} />;
    } else if (volume < 0.5) {
      return <SpeakerLow weight="thin" size={24} />;
    } else {
      return <SpeakerHigh weight="thin" size={24} />;
    }
  };

  return (
    <div className="volume-control" ref={volumeControlRef}>
      <button
        className="volume-button control-button"
        onClick={handleVolumeIconClick}
        aria-label={isMuted ? "Unmute" : "Mute"}
        type="button"
      >
        {getVolumeIcon()}
      </button>

      {isSliderVisible && (
        <div className="volume-slider-popup">
          {/* Custom vertical slider implementation */}
          <div className="custom-volume-slider">
            <div
              className="custom-volume-track"
              onClick={handleSliderClick}
              ref={trackRef}
            >
              <div
                className="custom-volume-fill"
                style={{ height: `${(isMuted ? 0 : volume) * 100}%` }}
              ></div>
              <div
                className={`custom-volume-thumb ${
                  isDragging ? "dragging" : ""
                }`}
                style={{
                  bottom: `calc(${(isMuted ? 0 : volume) * 100}% - 7px)`,
                }}
                onMouseDown={handleThumbMouseDown}
              ></div>
            </div>
            {/* Add mute button */}
            <button className="mute-button" onClick={toggleMute} type="button">
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeControl;
