import React from 'react';
import { 
  detectAudioFormatSupport, 
  getBrowserInfo, 
  getAudioFormatFromUrl,
  getTidalFormatForQuality 
} from '../utils/audioSupport';
import './AudioFormatInfo.css';

interface AudioFormatInfoProps {
  currentTrack?: {
    audioSrc: string;
    source?: string;
  };
  currentQuality?: string;
  className?: string;
}

const AudioFormatInfo: React.FC<AudioFormatInfoProps> = ({ 
  currentTrack, 
  currentQuality,
  className = '' 
}) => {
  const formatSupport = detectAudioFormatSupport();
  const browserInfo = getBrowserInfo();
  
  if (!currentTrack) return null;

  const currentFormat = getAudioFormatFromUrl(currentTrack.audioSrc);
  const isSupported = currentFormat ? formatSupport[currentFormat as keyof typeof formatSupport] : true;
  
  // For Tidal tracks, show expected format based on quality
  const expectedFormat = currentTrack.source === 'tidal' && currentQuality 
    ? getTidalFormatForQuality(currentQuality)
    : currentFormat;

  return (
    <div className={`audio-format-info ${className}`}>
      <div className="format-indicator">
        <span className={`format-badge ${isSupported ? 'supported' : 'unsupported'}`}>
          {expectedFormat?.toUpperCase() || 'UNKNOWN'}
        </span>
        {!isSupported && (
          <span className="warning-icon" title="Format may not be supported">
            ⚠️
          </span>
        )}
      </div>
      
      {currentTrack.source === 'tidal' && currentQuality && (
        <div className="quality-info">
          <span className="quality-badge">
            {currentQuality}
          </span>
        </div>
      )}
      
      {/* Show warning for FLAC in Chromium browsers */}
      {expectedFormat === 'flac' && browserInfo.isChromiumBased && !formatSupport.flac && (
        <div className="format-warning">
          <small>
            💡 FLAC not supported in this browser. Try switching to HIGH or LOW quality for AAC format.
          </small>
        </div>
      )}
    </div>
  );
};

export default AudioFormatInfo;
