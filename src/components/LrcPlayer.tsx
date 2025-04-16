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
        const response = await fetch(lrcUrl);
        if (!response.ok) {
          throw new Error(`Failed to load LRC file: ${response.status}`);
        }
        const text = await response.text();
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
    return <div className="lyrics-loading">Loading lyrics...</div>;
  }

  if (error) {
    return <div className="lyrics-error">{error}</div>;
  }

  // Convert seconds to milliseconds for react-lrc
  const currentTimeMs = currentTime * 1000;

  return (
    <div className="lyrics-container" ref={containerRef}>
      {lrcContent ? (
        <Lrc
          lrc={lrcContent}
          currentTime={currentTimeMs}
          lineRenderer={({ active, line, index }) => (
            <div
              key={line.startMillisecond}
              className={`lyrics-line ${active ? "active" : ""}`}
              ref={active ? activeLineRef : null}
              onClick={() => {
                handleActiveLineChange(index);
              }}
            >
              {line.content}
            </div>
          )}
          onLineChange={handleActiveLineChange}
        />
      ) : (
        <div className="lyrics-empty">No lyrics available</div>
      )}
    </div>
  );
};
