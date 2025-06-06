import React, { useEffect, useState, useRef } from "react";
// Import the library with named exports instead of default export
import { Lrc } from "react-lrc";

interface LrcPlayerProps {
  lrcUrl: string;
  currentTime: number;
}

export const LrcPlayer: React.FC<LrcPlayerProps> = ({
  lrcUrl,
  currentTime,
}) => {
  const [lrcContent, setLrcContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);

  // References for auto-scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchLrc = async () => {
      try {
        setLoading(true);
        console.log("Fetching LRC file from:", lrcUrl);
        const response = await fetch(lrcUrl);
        if (!response.ok) {
          throw new Error(`Failed to load LRC file: ${response.status}`);
        }
        const text = await response.text();
        console.log("Successfully loaded LRC content");
        setLrcContent(text);
        setError(null);
      } catch (err) {
        console.error("Error loading LRC file:", err);
        setError("Failed to load lyrics");
      } finally {
        setLoading(false);
      }
    };

    fetchLrc();
  }, [lrcUrl]);

  // Effect for auto-scrolling when active line changes
  useEffect(() => {
    if (activeLineIndex >= 0 && containerRef.current && activeLineRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;

      // Calculate the position to center the active line
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;

      // Scroll to center the active line
      container.scrollTo({
        top: lineTop - containerHeight / 2 + lineHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeLineIndex]);

  // This function will be called by the Lrc component
  // We need to use useRef to avoid the setState during render error
  const activeLineIndexRef = useRef<number>(-1);

  const handleActiveLineChange = (index: number) => {
    // Store the value in a ref first
    activeLineIndexRef.current = index;

    // Then use setTimeout to update the state after render is complete
    setTimeout(() => {
      setActiveLineIndex(activeLineIndexRef.current);
    }, 0);
  };

  if (loading) {
    return (
      <div className="lrc-player">
        <h3 className="lyrics-title">Lyrics</h3>
        <div className="lyrics-loading">
          <p>Loading lyrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lrc-player">
        <h3 className="lyrics-title">Lyrics</h3>
        <div className="lyrics-error">
          <p>{error}</p>
          <p>Lyrics not available for this track.</p>
        </div>
      </div>
    );
  }

  // Convert seconds to milliseconds for react-lrc
  const currentTimeMs = currentTime * 1000;

  return (
    <div className="lrc-player">
      <h3 className="lyrics-title">Lyrics</h3>
      <div className="lrc-container" ref={containerRef}>
        <Lrc
          lrc={lrcContent}
          currentMillisecond={currentTimeMs}
          lineRenderer={({ active, line, index }) => {
            // Check if this is the active line and update our state
            if (active && activeLineIndexRef.current !== index) {
              // Call the handler directly instead of using onLineChange prop
              handleActiveLineChange(index);
            }

            return (
              <div
                ref={
                  active
                    ? (el) => {
                        activeLineRef.current = el;
                      }
                    : null
                }
                className={`lrc-line ${active ? "lrc-active-line" : ""}`}
              >
                {line.content}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};
