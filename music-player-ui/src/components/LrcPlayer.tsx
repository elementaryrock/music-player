import React, { useEffect, useState } from "react";
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

  if (loading) {
    return <div className="lyrics-loading">Loading lyrics...</div>;
  }

  if (error) {
    return <div className="lyrics-error">{error}</div>;
  }

  // Convert seconds to milliseconds for react-lrc
  const currentTimeMs = currentTime * 1000;

  return (
    <div className="lrc-player">
      <h3 className="lyrics-title">Lyrics</h3>
      <div className="lrc-container">
        <Lrc
          lrc={lrcContent}
          currentMillisecond={currentTimeMs}
          lineRenderer={({ active, line }) => (
            <div className={`lrc-line ${active ? "lrc-active-line" : ""}`}>
              {line.content}
            </div>
          )}
        />
      </div>
    </div>
  );
};
