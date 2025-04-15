import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import NowPlayingDisplay from "./components/NowPlayingDisplay";
import PlaybackControls from "./components/PlaybackControls";
import TrackProgress from "./components/TrackProgress";
import VolumeControl from "./components/VolumeControl";
import Playlist from "./components/Playlist";
import { LrcPlayer } from "./components/LrcPlayer";

// Define a type for the track
interface Track {
  title: string;
  artist: string;
  audioSrc: string;
  albumArtUrl?: string; // Optional album art
  lrcUrl?: string; // URL to LRC file
}

function App() {
  const [currentTrack, setCurrentTrack] = useState<Track>({
    title: "That's So True",
    artist: "Gracie Abrams",
    audioSrc: "/song/song.mp3", // Using a sample MP3 for testing
    albumArtUrl: "/albumart/albumart_600.jpg", // Using local album art
    lrcUrl: "/lrc/lyrics.lrc", // LRC file path
  });

  // State for player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true); // State to toggle lyrics display
  const [isLiked, setIsLiked] = useState(false); // State for like functionality

  const audioRef = useRef<HTMLAudioElement>(null);

  // Effect to update time and duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateCurrentTime = () => setCurrentTime(audio.currentTime);
    const setAudioDuration = () => setDuration(audio.duration);
    const handleTrackEnd = () => setIsPlaying(false); // Stop playing when track ends

    audio.addEventListener("timeupdate", updateCurrentTime);
    audio.addEventListener("loadedmetadata", setAudioDuration);
    audio.addEventListener("ended", handleTrackEnd);

    // Cleanup listeners
    return () => {
      audio.removeEventListener("timeupdate", updateCurrentTime);
      audio.removeEventListener("loadedmetadata", setAudioDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, []); // Run only once on mount

  // Effect to handle play/pause based on state
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((error) => console.error("Error playing audio:", error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]); // Run when isPlaying changes

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = Number(event.target.value);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleLyrics = () => {
    setShowLyrics(!showLyrics);
  };

  // Style for the background div based on album art
  const backgroundStyle = {
    backgroundImage: `url(${currentTrack.albumArtUrl || ""})`,
  };

  return (
    <div className="App">
      {/* Blurred Background */}
      <div className="app-background" style={backgroundStyle}></div>

      {/* Overlay to darken background slightly for contrast */}
      <div className="background-overlay"></div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={currentTrack.audioSrc}
        preload="metadata"
      ></audio>

      <div className="content-layout">
        {/* Left side: Music Player */}
        <div className="player-container">
          <NowPlayingDisplay
            trackTitle={currentTrack.title}
            artistName={currentTrack.artist}
            albumArtUrl={currentTrack.albumArtUrl}
            initialLiked={isLiked}
            onLikeToggle={setIsLiked}
          />
          <TrackProgress
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
          />
          <PlaybackControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            // onNext={handleNext} // Add later
            // onPrev={handlePrev} // Add later
          />
          <VolumeControl />

          {/* Lyrics toggle button for mobile */}
          <button
            className="lyrics-toggle-button"
            onClick={toggleLyrics}
            type="button"
            aria-label={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
          >
            {showLyrics ? "Hide Lyrics" : "Show Lyrics"}
          </button>
        </div>

        {/* Right side: Lyrics Display (conditionally shown) */}
        {showLyrics && currentTrack.lrcUrl && (
          <div className="lyrics-panel">
            <LrcPlayer lrcUrl={currentTrack.lrcUrl} currentTime={currentTime} />
          </div>
        )}
      </div>

      {/* Playlist area - positioned below in mobile view */}
      <div className="playlist-container">
        <Playlist />
      </div>
    </div>
  );
}

export default App;
