import React from "react";
import "./SourceToggle.css";

export type AudioSource = "local" | "jiosaavn" | "tidal";

interface SourceToggleProps {
  currentSource: AudioSource;
  onSourceChange: (source: AudioSource) => void;
}

const SourceToggle: React.FC<SourceToggleProps> = ({
  currentSource,
  onSourceChange,
}) => {
  const sources: { value: AudioSource; label: string }[] = [
    { value: "local", label: "Local Files" },
    { value: "jiosaavn", label: "JioSaavn" },
    { value: "tidal", label: "Tidal" },
  ];

  return (
    <div className="source-toggle">
      <span className="source-label">Source:</span>
      <div className="source-buttons">
        {sources.map((source) => (
          <button
            key={source.value}
            type="button"
            className={`source-button ${
              currentSource === source.value ? "active" : ""
            }`}
            onClick={() => onSourceChange(source.value)}
          >
            {source.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SourceToggle;
