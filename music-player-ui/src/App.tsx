import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import NowPlayingDisplay from "./components/NowPlayingDisplay";
import PlaybackControls from "./components/PlaybackControls";
import TrackProgress from "./components/TrackProgress";
import Playlist from "./components/Playlist";
import { LrcPlayer } from "./components/LrcPlayer";

// Define a type for the track
interface Track {
  id: number;
  title: string;
  artist: string;
  audioSrc: string;
  albumArtUrl?: string; // Optional album art
  lrcUrl?: string; // URL to LRC file
}

function App() {
  // Define playlist with useMemo to avoid re-creating it on every render
  const playlist = React.useMemo<Track[]>(
    () => [
      {
        id: 1,
        title: "That's So True",
        artist: "Gracie Abrams",
        audioSrc: "/song/song.mp3",
        albumArtUrl: "/albumart/albumart_600.jpg",
        lrcUrl: "/lrc/lyrics.lrc",
      },
      {
        id: 2,
        title: "Golden Hour",
        artist: "JVKE",
        audioSrc: "/song/song2.mp3",
        albumArtUrl: "/albumart/albumart2.jpg",
        lrcUrl: "/lrc/lyrics2.lrc",
      },
    ],
    []
  );

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<Track>(playlist[0]);

  // State for player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true); // State to toggle lyrics display
  const [isLiked, setIsLiked] = useState(false); // State for like functionality

  const audioRef = useRef<HTMLAudioElement>(null);
  // Use a ref to track the current track to avoid dependency issues
  const previousTrackRef = useRef<string>("");

  // Effect to update time and duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateCurrentTime = () => setCurrentTime(audio.currentTime);
    const setAudioDuration = () => setDuration(audio.duration);
    const handleTrackEnd = () => {
      // Play the next track when current track ends
      if (currentTrackIndex < playlist.length - 1) {
        const nextIndex = currentTrackIndex + 1;
        setCurrentTrackIndex(nextIndex);
        setCurrentTrack(playlist[nextIndex]);
        setIsPlaying(true); // Auto-play the next track
      } else {
        setIsPlaying(false); // Stop playing if it's the last track
      }
    };

    audio.addEventListener("timeupdate", updateCurrentTime);
    audio.addEventListener("loadedmetadata", setAudioDuration);
    audio.addEventListener("ended", handleTrackEnd);

    // Cleanup listeners
    return () => {
      audio.removeEventListener("timeupdate", updateCurrentTime);
      audio.removeEventListener("loadedmetadata", setAudioDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [currentTrackIndex, playlist]); // Run when track index changes

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

  // Effect to handle track changes
  useEffect(() => {
    // Only reset and reload when the track itself changes, not when play/pause state changes
    if (audioRef.current) {
      // Check if the track has actually changed by comparing audio sources
      const currentTrackSrc = currentTrack.audioSrc;
      if (previousTrackRef.current !== currentTrackSrc) {
        // Track has changed, reset time and reload
        previousTrackRef.current = currentTrackSrc;
        setCurrentTime(0);
        audioRef.current.load();

        // Auto-play if isPlaying is true
        if (isPlaying) {
          audioRef.current
            .play()
            .catch((error) => console.error("Error playing new track:", error));
        }
      }
    }
  }, [currentTrack, isPlaying]); // Include both dependencies but handle logic inside

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Function to handle track selection from playlist
  const handleTrackSelect = (trackId: number) => {
    const trackIndex = playlist.findIndex((track) => track.id === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
      setCurrentTrack(playlist[trackIndex]);
      setIsPlaying(true); // Auto-play when selecting a track
    }
  };

  // Function to play next track
  const handleNext = () => {
    if (currentTrackIndex < playlist.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      setCurrentTrackIndex(nextIndex);
      setCurrentTrack(playlist[nextIndex]);
      if (isPlaying) {
        // If already playing, continue playing the next track
        setIsPlaying(true);
      }
    }
  };

  // Function to play previous track
  const handlePrev = () => {
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      setCurrentTrackIndex(prevIndex);
      setCurrentTrack(playlist[prevIndex]);
      if (isPlaying) {
        // If already playing, continue playing the previous track
        setIsPlaying(true);
      }
    }
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
            onNext={handleNext}
            onPrev={handlePrev}
          />

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
        <Playlist
          tracks={playlist}
          currentTrackId={currentTrack.id}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </div>
  );
}

export default App;
