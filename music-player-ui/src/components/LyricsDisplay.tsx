import React, { useEffect, useRef } from "react";

// Define the structure for a lyric line
interface LyricLine {
  text: string;
  timeStart: number; // in seconds
  timeEnd?: number; // optional end time
}

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  currentTime: number;
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lyrics,
  currentTime,
}) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Find the active lyric based on currentTime
  const activeLyricIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    return (
      currentTime >= line.timeStart &&
      (!nextLine || currentTime < nextLine.timeStart)
    );
  });

  // Effect to scroll to the active lyric
  useEffect(() => {
    if (
      activeLyricIndex >= 0 &&
      lyricsContainerRef.current &&
      activeLineRef.current
    ) {
      const container = lyricsContainerRef.current;
      const element = activeLineRef.current;

      // Calculate position to center the active lyric in the container
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      // Smooth scroll to center the active lyric
      container.scrollTo({
        top: elementTop - containerHeight / 2 + elementHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeLyricIndex]);

  return (
    <div className="lyrics-display">
      <h3 className="lyrics-title">Lyrics</h3>
      <div className="lyrics-container" ref={lyricsContainerRef}>
        {lyrics.map((line, index) => (
          <div
            key={index}
            ref={index === activeLyricIndex ? activeLineRef : null}
            className={`lyric-line ${
              index === activeLyricIndex ? "active" : ""
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>{" "}
    </div>
  );
};
