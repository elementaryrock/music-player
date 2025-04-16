import React from 'react';
import './QualitySelector.css';

interface QualitySelectorProps {
  currentQuality: string;
  onQualityChange: (quality: string) => void;
  availableQualities: string[];
}

const QualitySelector: React.FC<QualitySelectorProps> = ({
  currentQuality,
  onQualityChange,
  availableQualities
}) => {
  return (
    <div className="quality-selector">
      <span className="quality-label">Quality:</span>
      <div className="quality-options">
        {availableQualities.map((quality) => (
          <button
            key={quality}
            className={`quality-option ${currentQuality === quality ? 'active' : ''}`}
            onClick={() => onQualityChange(quality)}
          >
            {quality}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QualitySelector;
