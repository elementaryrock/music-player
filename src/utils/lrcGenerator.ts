/**
 * Utility function to generate a simple LRC file from song information
 * This is used when the API doesn't provide lyrics
 */

/**
 * Generate a simple LRC file with song information
 * @param title Song title
 * @param artist Song artist
 * @param album Song album
 * @param duration Song duration in seconds
 * @returns LRC content as a string
 */
export const generateSimpleLrc = (
  title: string,
  artist: string,
  album?: string,
  duration?: number
): string => {
  const lrcLines: string[] = [];
  
  // Add metadata
  lrcLines.push(`[ti:${title}]`);
  lrcLines.push(`[ar:${artist}]`);
  if (album) {
    lrcLines.push(`[al:${album}]`);
  }
  
  // Add a simple message at the beginning
  lrcLines.push('[00:00.00]Lyrics not available');
  lrcLines.push(`[00:02.00]Playing: ${title}`);
  lrcLines.push(`[00:04.00]By: ${artist}`);
  
  if (album) {
    lrcLines.push(`[00:06.00]Album: ${album}`);
  }
  
  // Add a message at the middle if duration is available
  if (duration && duration > 30) {
    const middleTime = Math.floor(duration / 2);
    const minutes = Math.floor(middleTime / 60);
    const seconds = middleTime % 60;
    const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.00]`;
    
    lrcLines.push(`${timeStr}Enjoying the music...`);
  }
  
  return lrcLines.join('\n');
};

/**
 * Create a Blob URL for an LRC file
 * @param lrcContent LRC content as a string
 * @returns Blob URL that can be used as a source for the LRC player
 */
export const createLrcBlobUrl = (lrcContent: string): string => {
  const blob = new Blob([lrcContent], { type: 'text/plain' });
  return URL.createObjectURL(blob);
};

/**
 * Generate an LRC file and return its Blob URL
 * @param title Song title
 * @param artist Song artist
 * @param album Song album
 * @param duration Song duration in seconds
 * @returns Blob URL for the generated LRC file
 */
export const generateLrcUrl = (
  title: string,
  artist: string,
  album?: string,
  duration?: number
): string => {
  const lrcContent = generateSimpleLrc(title, artist, album, duration);
  return createLrcBlobUrl(lrcContent);
};
