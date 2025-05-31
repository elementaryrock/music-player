/**
 * Proxy URL Utilities
 *
 * This module provides utilities to convert external URLs to use our Vite proxy
 * to avoid CORS issues with audio streaming and image resources.
 */

/**
 * Convert a Tidal audio streaming URL to use our proxy
 * @param originalUrl The original Tidal audio URL
 * @returns Proxied URL that goes through our Vite dev server
 */
export const proxyAudioUrl = (originalUrl: string): string => {
  // TEMPORARY: Don't proxy audio URLs due to authentication issues
  // The signed URLs from Tidal don't work through proxy due to domain/IP restrictions
  console.log("🔄 Audio URL (direct, not proxied):", originalUrl);
  return originalUrl;

  /* Original proxy logic - disabled due to 403 errors
  try {
    const url = new URL(originalUrl);

    // Handle Tidal audio streaming URLs
    if (url.hostname.includes('audio.tidal.com')) {
      // Convert: https://sp-pr-cf.audio.tidal.com/path/to/audio.flac
      // To: /api/audio/path/to/audio.flac
      return `/api/audio${url.pathname}${url.search}`;
    }

    // Handle other audio streaming domains if needed
    if (url.hostname.includes('tidal.com') && url.pathname.includes('audio')) {
      return `/api/audio${url.pathname}${url.search}`;
    }

    // If it's not a recognized audio URL, return as-is
    console.warn('Unknown audio URL format:', originalUrl);
    return originalUrl;
  } catch (error) {
    console.error('Failed to parse audio URL:', originalUrl, error);
    return originalUrl;
  }
  */
};

/**
 * Convert a Tidal image/resource URL to use our proxy
 * @param originalUrl The original Tidal resource URL
 * @returns Proxied URL that goes through our Vite dev server
 */
export const proxyImageUrl = (originalUrl: string): string => {
  try {
    const url = new URL(originalUrl);

    // Handle Tidal resources URLs
    if (url.hostname.includes("resources.tidal.com")) {
      // Convert: https://resources.tidal.com/images/640x640/640x640.jpg
      // To: /api/resources/images/640x640/640x640.jpg
      return `/api/resources${url.pathname}${url.search}`;
    }

    // If it's not a recognized resource URL, return as-is
    return originalUrl;
  } catch (error) {
    console.error("Failed to parse image URL:", originalUrl, error);
    return originalUrl;
  }
};

/**
 * Check if a URL needs to be proxied
 * @param url The URL to check
 * @returns True if the URL should be proxied
 */
export const shouldProxyUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);

    // Proxy Tidal audio and resource URLs
    return (
      urlObj.hostname.includes("audio.tidal.com") ||
      urlObj.hostname.includes("resources.tidal.com")
    );
  } catch {
    return false;
  }
};

/**
 * Automatically proxy a URL if needed
 * @param originalUrl The original URL
 * @returns Proxied URL if needed, otherwise original URL
 */
export const autoProxyUrl = (originalUrl: string): string => {
  if (!shouldProxyUrl(originalUrl)) {
    return originalUrl;
  }

  try {
    const url = new URL(originalUrl);

    if (url.hostname.includes("audio.tidal.com")) {
      return proxyAudioUrl(originalUrl);
    }

    if (url.hostname.includes("resources.tidal.com")) {
      return proxyImageUrl(originalUrl);
    }

    return originalUrl;
  } catch {
    return originalUrl;
  }
};

/**
 * Log URL conversion for debugging
 * @param originalUrl Original URL
 * @param proxiedUrl Proxied URL
 * @param type Type of URL (audio, image, etc.)
 */
export const logUrlConversion = (
  originalUrl: string,
  proxiedUrl: string,
  type: string
): void => {
  if (originalUrl !== proxiedUrl) {
    console.log(`🔄 ${type} URL proxied:`, {
      original: originalUrl,
      proxied: proxiedUrl,
    });
  }
};

/**
 * Create a proxied audio element with automatic URL conversion
 * @param originalSrc Original audio source URL
 * @returns Audio element with proxied URL
 */
export const createProxiedAudio = (originalSrc: string): HTMLAudioElement => {
  const audio = new Audio();
  const proxiedSrc = proxyAudioUrl(originalSrc);

  logUrlConversion(originalSrc, proxiedSrc, "Audio");

  audio.src = proxiedSrc;
  audio.crossOrigin = "anonymous"; // Enable CORS for proxied content

  return audio;
};

/**
 * Create a proxied image element with automatic URL conversion
 * @param originalSrc Original image source URL
 * @returns Image element with proxied URL
 */
export const createProxiedImage = (originalSrc: string): HTMLImageElement => {
  const img = new Image();
  const proxiedSrc = proxyImageUrl(originalSrc);

  logUrlConversion(originalSrc, proxiedSrc, "Image");

  img.src = proxiedSrc;
  img.crossOrigin = "anonymous"; // Enable CORS for proxied content

  return img;
};
