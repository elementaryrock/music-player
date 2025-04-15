// Function to parse LRC file content to extract timestamps and lyrics
export interface ParsedLyric {
  time: number; // Time in seconds
  text: string; // The lyric text
}

export const parseLrc = (lrcContent: string): ParsedLyric[] => {
  // Split the content by line
  const lines = lrcContent.split("\n");
  const lyrics: ParsedLyric[] = [];

  // Regular expression to match time tags [mm:ss.xx]
  const timeRegex = /\[(\d+):(\d+)\.(\d+)\]/;

  // Process each line
  lines.forEach((line) => {
    // Skip metadata lines (usually start with [ar:], [al:], etc.)
    if (line.startsWith("[") && !timeRegex.test(line)) {
      return;
    }

    const match = line.match(timeRegex);
    if (match) {
      // Extract minutes, seconds, and milliseconds
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const hundredths = parseInt(match[3], 10);

      // Calculate total time in seconds
      const timeInSeconds = minutes * 60 + seconds + hundredths / 100;

      // Extract the text part (remove the time tag)
      const textContent = line.replace(timeRegex, "").trim();

      if (textContent) {
        lyrics.push({
          time: timeInSeconds,
          text: textContent,
        });
      }
    }
  });

  // Sort lyrics by time
  return lyrics.sort((a, b) => a.time - b.time);
};

export default parseLrc;
