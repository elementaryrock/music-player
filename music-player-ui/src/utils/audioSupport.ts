/**
 * Audio Format Support Detection and Fallback Utilities
 * 
 * This module provides utilities for detecting browser audio format support
 * and implementing fallback mechanisms for unsupported formats like FLAC.
 */

// Audio format support detection
export interface AudioFormatSupport {
  flac: boolean;
  mp3: boolean;
  aac: boolean;
  ogg: boolean;
  wav: boolean;
  webm: boolean;
}

// Cache for format support detection
let formatSupportCache: AudioFormatSupport | null = null;

/**
 * Detect browser audio format support
 * @returns Object with support status for each format
 */
export const detectAudioFormatSupport = (): AudioFormatSupport => {
  if (formatSupportCache) {
    return formatSupportCache;
  }

  const audio = document.createElement('audio');
  
  const support: AudioFormatSupport = {
    flac: false,
    mp3: false,
    aac: false,
    ogg: false,
    wav: false,
    webm: false,
  };

  // Test FLAC support
  support.flac = !!(audio.canPlayType && (
    audio.canPlayType('audio/flac').replace(/no/, '') ||
    audio.canPlayType('audio/x-flac').replace(/no/, '') ||
    audio.canPlayType('audio/flac; codecs="flac"').replace(/no/, '')
  ));

  // Test MP3 support
  support.mp3 = !!(audio.canPlayType && (
    audio.canPlayType('audio/mpeg').replace(/no/, '') ||
    audio.canPlayType('audio/mp3').replace(/no/, '')
  ));

  // Test AAC support
  support.aac = !!(audio.canPlayType && (
    audio.canPlayType('audio/aac').replace(/no/, '') ||
    audio.canPlayType('audio/mp4').replace(/no/, '') ||
    audio.canPlayType('audio/mp4; codecs="mp4a.40.2"').replace(/no/, '')
  ));

  // Test OGG support
  support.ogg = !!(audio.canPlayType && (
    audio.canPlayType('audio/ogg').replace(/no/, '') ||
    audio.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, '')
  ));

  // Test WAV support
  support.wav = !!(audio.canPlayType && (
    audio.canPlayType('audio/wav').replace(/no/, '') ||
    audio.canPlayType('audio/wave').replace(/no/, '')
  ));

  // Test WebM support
  support.webm = !!(audio.canPlayType && (
    audio.canPlayType('audio/webm').replace(/no/, '') ||
    audio.canPlayType('audio/webm; codecs="vorbis"').replace(/no/, '')
  ));

  formatSupportCache = support;
  console.log('Audio format support detected:', support);
  
  return support;
};

/**
 * Check if a specific audio format is supported
 * @param format Audio format to check
 * @returns True if supported, false otherwise
 */
export const isAudioFormatSupported = (format: keyof AudioFormatSupport): boolean => {
  const support = detectAudioFormatSupport();
  return support[format];
};

/**
 * Get the file extension from a URL
 * @param url Audio URL
 * @returns File extension or null
 */
export const getAudioFormatFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check for common audio extensions
    if (pathname.includes('.flac')) return 'flac';
    if (pathname.includes('.mp3')) return 'mp3';
    if (pathname.includes('.aac') || pathname.includes('.m4a')) return 'aac';
    if (pathname.includes('.ogg')) return 'ogg';
    if (pathname.includes('.wav')) return 'wav';
    if (pathname.includes('.webm')) return 'webm';
    if (pathname.includes('.mp4')) return 'aac'; // MP4 usually contains AAC
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Check if an audio URL is supported by the browser
 * @param url Audio URL to check
 * @returns True if supported, false otherwise
 */
export const isAudioUrlSupported = (url: string): boolean => {
  const format = getAudioFormatFromUrl(url);
  if (!format) return true; // Assume supported if format can't be determined
  
  return isAudioFormatSupported(format as keyof AudioFormatSupport);
};

/**
 * Get browser information for debugging
 * @returns Browser info object
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  const isChrome = /Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor);
  const isChromium = /Chromium/.test(userAgent);
  const isEdge = /Edg/.test(userAgent);
  const isFirefox = /Firefox/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  
  return {
    userAgent,
    isChrome,
    isChromium,
    isEdge,
    isFirefox,
    isSafari,
    isChromiumBased: isChrome || isChromium || isEdge,
  };
};

/**
 * Log audio support information for debugging
 */
export const logAudioSupportInfo = () => {
  const support = detectAudioFormatSupport();
  const browser = getBrowserInfo();
  
  console.group('🎵 Audio Support Information');
  console.log('Browser:', browser);
  console.log('Format Support:', support);
  
  if (!support.flac && browser.isChromiumBased) {
    console.warn('⚠️ FLAC not natively supported in this Chromium-based browser');
    console.log('💡 Consider implementing a fallback mechanism or transcoding service');
  }
  
  console.groupEnd();
};

/**
 * Create an enhanced audio element with format support checking
 * @param src Audio source URL
 * @param onUnsupportedFormat Callback for unsupported formats
 * @returns Audio element
 */
export const createEnhancedAudioElement = (
  src: string,
  onUnsupportedFormat?: (format: string, url: string) => void
): HTMLAudioElement => {
  const audio = new Audio();
  
  // Check format support before setting source
  const format = getAudioFormatFromUrl(src);
  if (format && !isAudioFormatSupported(format as keyof AudioFormatSupport)) {
    console.warn(`⚠️ Audio format '${format}' may not be supported in this browser`);
    if (onUnsupportedFormat) {
      onUnsupportedFormat(format, src);
    }
  }
  
  audio.src = src;
  return audio;
};

/**
 * Tidal quality to format mapping
 */
export const TIDAL_QUALITY_FORMATS: Record<string, string> = {
  'LOW': 'aac',           // 96 kbps AAC
  'HIGH': 'aac',          // 320 kbps AAC
  'LOSSLESS': 'flac',     // 16-bit/44.1kHz FLAC
  'HI_RES': 'flac',       // 24-bit/96kHz FLAC
  'HI_RES_LOSSLESS': 'flac', // 24-bit/192kHz FLAC
};

/**
 * Get the expected audio format for a Tidal quality
 * @param quality Tidal quality string
 * @returns Expected audio format
 */
export const getTidalFormatForQuality = (quality: string): string => {
  return TIDAL_QUALITY_FORMATS[quality] || 'flac';
};

/**
 * Check if a Tidal quality is supported in the current browser
 * @param quality Tidal quality string
 * @returns True if supported, false otherwise
 */
export const isTidalQualitySupported = (quality: string): boolean => {
  const format = getTidalFormatForQuality(quality);
  return isAudioFormatSupported(format as keyof AudioFormatSupport);
};

/**
 * Get the best supported Tidal quality for the current browser
 * @param availableQualities Array of available qualities
 * @returns Best supported quality
 */
export const getBestSupportedTidalQuality = (availableQualities: string[]): string => {
  const support = detectAudioFormatSupport();
  
  // If FLAC is supported, return the highest quality
  if (support.flac) {
    const flacQualities = ['HI_RES_LOSSLESS', 'HI_RES', 'LOSSLESS'];
    for (const quality of flacQualities) {
      if (availableQualities.includes(quality)) {
        return quality;
      }
    }
  }
  
  // If FLAC is not supported, prefer AAC qualities
  const aacQualities = ['HIGH', 'LOW'];
  for (const quality of aacQualities) {
    if (availableQualities.includes(quality)) {
      return quality;
    }
  }
  
  // Fallback to first available quality
  return availableQualities[0] || 'HIGH';
};
