/**
 * Audio Fallback Service
 * 
 * Provides fallback mechanisms for unsupported audio formats,
 * particularly FLAC in Chromium browsers.
 */

import { 
  isAudioFormatSupported, 
  getAudioFormatFromUrl, 
  getBrowserInfo,
  getTidalFormatForQuality,
  getBestSupportedTidalQuality
} from '../utils/audioSupport';
import { TidalQuality } from '../types/tidal.types';

// Fallback strategies
export type FallbackStrategy = 'quality-downgrade' | 'proxy-transcode' | 'web-audio-api' | 'none';

export interface FallbackOptions {
  strategy: FallbackStrategy;
  targetFormat?: 'mp3' | 'aac' | 'ogg';
  targetBitrate?: number;
  enableLogging?: boolean;
}

export interface FallbackResult {
  success: boolean;
  originalUrl: string;
  fallbackUrl?: string;
  strategy: FallbackStrategy;
  format?: string;
  message?: string;
}

/**
 * Default fallback options
 */
const DEFAULT_FALLBACK_OPTIONS: FallbackOptions = {
  strategy: 'quality-downgrade',
  targetFormat: 'aac',
  targetBitrate: 320,
  enableLogging: true,
};

/**
 * Check if an audio URL needs a fallback
 * @param url Audio URL to check
 * @returns True if fallback is needed
 */
export const needsFallback = (url: string): boolean => {
  const format = getAudioFormatFromUrl(url);
  if (!format) return false;
  
  return !isAudioFormatSupported(format as any);
};

/**
 * Get fallback URL for Tidal tracks with unsupported formats
 * @param originalUrl Original Tidal URL
 * @param currentQuality Current quality setting
 * @param availableQualities Available quality options
 * @param options Fallback options
 * @returns Fallback result
 */
export const getTidalFallback = async (
  originalUrl: string,
  currentQuality: string,
  availableQualities: string[],
  options: Partial<FallbackOptions> = {}
): Promise<FallbackResult> => {
  const opts = { ...DEFAULT_FALLBACK_OPTIONS, ...options };
  
  if (opts.enableLogging) {
    console.log('🔄 Attempting Tidal audio fallback:', {
      originalUrl,
      currentQuality,
      availableQualities,
      strategy: opts.strategy
    });
  }

  // Strategy 1: Quality downgrade to supported format
  if (opts.strategy === 'quality-downgrade') {
    const bestSupportedQuality = getBestSupportedTidalQuality(availableQualities);
    
    if (bestSupportedQuality !== currentQuality) {
      if (opts.enableLogging) {
        console.log(`📉 Downgrading quality from ${currentQuality} to ${bestSupportedQuality}`);
      }
      
      // Note: In a real implementation, you would need to call the Tidal API again
      // with the new quality to get the appropriate URL
      return {
        success: true,
        originalUrl,
        strategy: 'quality-downgrade',
        format: getTidalFormatForQuality(bestSupportedQuality),
        message: `Quality downgraded to ${bestSupportedQuality} for browser compatibility`
      };
    }
  }

  // Strategy 2: Proxy transcoding (would require a backend service)
  if (opts.strategy === 'proxy-transcode') {
    // This would require a backend transcoding service
    const transcodingServiceUrl = process.env.REACT_APP_TRANSCODING_SERVICE_URL;
    
    if (transcodingServiceUrl) {
      const transcodedUrl = `${transcodingServiceUrl}/transcode?url=${encodeURIComponent(originalUrl)}&format=${opts.targetFormat}&bitrate=${opts.targetBitrate}`;
      
      if (opts.enableLogging) {
        console.log('🔄 Using transcoding service:', transcodedUrl);
      }
      
      return {
        success: true,
        originalUrl,
        fallbackUrl: transcodedUrl,
        strategy: 'proxy-transcode',
        format: opts.targetFormat,
        message: `Transcoded to ${opts.targetFormat} via proxy service`
      };
    }
  }

  // Strategy 3: Web Audio API (experimental - for future implementation)
  if (opts.strategy === 'web-audio-api') {
    // This would involve using Web Audio API to decode and re-encode
    // Currently not implemented as it's complex and has limitations
    if (opts.enableLogging) {
      console.warn('⚠️ Web Audio API fallback not yet implemented');
    }
  }

  // No fallback available
  return {
    success: false,
    originalUrl,
    strategy: opts.strategy,
    message: 'No suitable fallback available'
  };
};

/**
 * Enhanced audio element with automatic fallback handling
 */
export class FallbackAudioElement {
  private audio: HTMLAudioElement;
  private originalSrc: string = '';
  private fallbackOptions: FallbackOptions;
  private onFallbackUsed?: (result: FallbackResult) => void;

  constructor(options: Partial<FallbackOptions> = {}) {
    this.audio = new Audio();
    this.fallbackOptions = { ...DEFAULT_FALLBACK_OPTIONS, ...options };
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Handle audio errors and attempt fallback
    this.audio.addEventListener('error', async (event) => {
      const error = this.audio.error;
      if (error && this.originalSrc) {
        console.error('🚫 Audio playback error:', error);
        
        if (needsFallback(this.originalSrc)) {
          console.log('🔄 Attempting fallback for unsupported format...');
          await this.attemptFallback();
        }
      }
    });

    // Log successful playback
    this.audio.addEventListener('canplay', () => {
      if (this.fallbackOptions.enableLogging) {
        console.log('✅ Audio ready to play:', this.audio.src);
      }
    });
  }

  private async attemptFallback() {
    // This is a simplified fallback - in practice, you'd need more context
    // about the audio source (Tidal, JioSaavn, etc.) to implement proper fallbacks
    
    if (this.fallbackOptions.enableLogging) {
      console.warn('⚠️ Fallback mechanism triggered but not fully implemented');
      console.log('💡 Consider using a lower quality or different audio source');
    }

    // Notify callback if provided
    if (this.onFallbackUsed) {
      this.onFallbackUsed({
        success: false,
        originalUrl: this.originalSrc,
        strategy: this.fallbackOptions.strategy,
        message: 'Fallback triggered but not implemented'
      });
    }
  }

  // Public methods that mirror HTMLAudioElement
  set src(value: string) {
    this.originalSrc = value;
    
    // Check if format is supported before setting
    if (needsFallback(value)) {
      if (this.fallbackOptions.enableLogging) {
        console.warn('⚠️ Setting potentially unsupported audio format:', value);
      }
    }
    
    this.audio.src = value;
  }

  get src(): string {
    return this.audio.src;
  }

  // Delegate other properties and methods to the underlying audio element
  get currentTime(): number { return this.audio.currentTime; }
  set currentTime(value: number) { this.audio.currentTime = value; }

  get duration(): number { return this.audio.duration; }
  get paused(): boolean { return this.audio.paused; }
  get ended(): boolean { return this.audio.ended; }
  get volume(): number { return this.audio.volume; }
  set volume(value: number) { this.audio.volume = value; }

  play(): Promise<void> { return this.audio.play(); }
  pause(): void { this.audio.pause(); }
  load(): void { this.audio.load(); }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.audio.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.audio.removeEventListener(type, listener);
  }

  // Custom methods
  setFallbackCallback(callback: (result: FallbackResult) => void): void {
    this.onFallbackUsed = callback;
  }

  getUnderlyingElement(): HTMLAudioElement {
    return this.audio;
  }
}

/**
 * Show user-friendly message about audio format compatibility
 * @param format Audio format that's not supported
 * @param quality Current quality setting
 */
export const showFormatCompatibilityMessage = (format: string, quality?: string): void => {
  const browser = getBrowserInfo();
  
  let message = '';
  let suggestion = '';

  if (format === 'flac' && browser.isChromiumBased) {
    message = 'FLAC audio format is not natively supported in this browser.';
    suggestion = 'Try switching to a lower quality (HIGH or LOW) for AAC format, or use Firefox for native FLAC support.';
  } else {
    message = `Audio format '${format}' may not be supported in this browser.`;
    suggestion = 'Try switching to a different quality or audio source.';
  }

  console.warn(`⚠️ ${message} ${suggestion}`);
  
  // You could also show a toast notification or modal here
  // For now, we'll just log to console
};

/**
 * Get recommended quality settings for the current browser
 * @param availableQualities Available quality options
 * @returns Recommended quality with explanation
 */
export const getRecommendedQuality = (availableQualities: string[]): { quality: string; reason: string } => {
  const browser = getBrowserInfo();
  const bestSupported = getBestSupportedTidalQuality(availableQualities);
  
  let reason = '';
  
  if (browser.isChromiumBased && !isAudioFormatSupported('flac')) {
    reason = 'FLAC not supported in Chromium browsers - using AAC format';
  } else if (browser.isFirefox) {
    reason = 'Firefox supports FLAC - using highest quality';
  } else {
    reason = 'Using best supported quality for your browser';
  }

  return {
    quality: bestSupported,
    reason
  };
};
