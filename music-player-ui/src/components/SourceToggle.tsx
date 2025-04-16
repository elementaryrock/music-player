import React from 'react';
import './SourceToggle.css';

interface SourceToggleProps {
  useLocalFiles: boolean;
  onToggle: () => void;
}

const SourceToggle: React.FC<SourceToggleProps> = ({
  useLocalFiles,
  onToggle
}) => {
  return (
    <div className="source-toggle">
      <span className="source-label">Source:</span>
      <button 
        className="toggle-button"
        onClick={onToggle}
      >
        {useLocalFiles ? 'Local Files' : 'JioSaavn API'}
      </button>
    </div>
  );
};

export default SourceToggle;
