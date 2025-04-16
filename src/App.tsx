import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import "./styles/search.css";
import "./styles/empty-states.css";
import "./styles/dynamic-background.css";
import NowPlayingDisplay from "./components/NowPlayingDisplay";
import PlaybackControls from "./components/PlaybackControls";
import TrackProgress from "./components/TrackProgress";
import Playlist from "./components/Playlist";
import { LrcPlayer } from "./components/LrcPlayer";
import SearchBar from "./components/SearchBar";
import { Track, convertSaavnSongToTrack } from "./types/api.types";
import { getSongSuggestions } from "./services/api";
import { loadSpecificSong, loadInitialSongs } from "./utils/initialSongLoader";

function App() {
  // State for playlist
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] =
    useState<boolean>(false);

  // State for player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showLyrics, setShowLyrics] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (audioRef.current && currentTrack) {
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((error) => console.error("Error playing audio:", error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]); // Run when isPlaying changes

  // Effect to handle track changes
  useEffect(() => {
    // Only reset and reload when the track itself changes, not when play/pause state changes
    if (audioRef.current && currentTrack) {
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

  // Effect to load initial songs on startup
  useEffect(() => {
    const loadInitialSong = async () => {
      if (!initialLoadComplete) {
        try {
          setIsLoading(true);
          setError(null);

          // Load "That's So True" by Gracie Abrams from JioSaavn
          const track = await loadSpecificSong(
            "That's So True",
            "Gracie Abrams"
          );

          if (track) {
            setPlaylist([track]);
            setCurrentTrack(track);
            setCurrentTrackIndex(0);
            setInitialLoadComplete(true);
          } else {
            // If the specific song can't be found, load initial songs
            const initialTracks = await loadInitialSongs();
            if (initialTracks.length > 0) {
              setPlaylist(initialTracks);
              setCurrentTrack(initialTracks[0]);
              setCurrentTrackIndex(0);
              setInitialLoadComplete(true);
            } else {
              setError(
                "Could not load initial songs. Please search for a song."
              );
            }
          }
        } catch (err) {
          console.error("Error loading initial song:", err);
          setError("Failed to load initial song. Please search for a song.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadInitialSong();
  }, [initialLoadComplete]);

  // Effect to load song suggestions when a track is played
  useEffect(() => {
    const loadSuggestions = async () => {
      if (
        currentTrack &&
        typeof currentTrack.id === "string" &&
        playlist.length < 5 &&
        initialLoadComplete
      ) {
        try {
          setIsLoading(true);
          const suggestions = await getSongSuggestions(currentTrack.id, 5);

          if (suggestions && suggestions.length > 0) {
            // Convert suggestions to Track format and add to playlist if not already there
            const newTracks = suggestions
              .map(convertSaavnSongToTrack)
              .filter((track) => !playlist.some((p) => p.id === track.id));

            if (newTracks.length > 0) {
              setPlaylist((prevPlaylist) => [...prevPlaylist, ...newTracks]);
            }
          }
        } catch (err) {
          console.error("Error loading suggestions:", err);
          setError("Failed to load song suggestions");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadSuggestions();
  }, [currentTrack, playlist.length]);

  const handlePlayPause = () => {
    if (currentTrack) {
      setIsPlaying(!isPlaying);
    }
  };

  // Function to handle track selection from playlist
  const handleTrackSelect = (trackId: number | string) => {
    const trackIndex = playlist.findIndex((track) => track.id === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
      setCurrentTrack(playlist[trackIndex]);
      setIsPlaying(true); // Auto-play when selecting a track
    }
  };

  // Function to play next track
  const handleNext = () => {
    if (playlist.length > 0 && currentTrackIndex < playlist.length - 1) {
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
    if (playlist.length > 0 && currentTrackIndex > 0) {
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

  // Function to add a track to the playlist
  const handleAddToPlaylist = (track: Track) => {
    // Check if track already exists in playlist
    if (!playlist.some((t) => t.id === track.id)) {
      const newPlaylist = [...playlist, track];
      setPlaylist(newPlaylist);

      // If this is the first track, set it as current
      if (playlist.length === 0) {
        setCurrentTrack(track);
        setCurrentTrackIndex(0);
      }
    }
  };

  // Set CSS variable for album art background
  useEffect(() => {
    if (currentTrack?.albumArtUrl) {
      document.documentElement.style.setProperty(
        "--album-art-url",
        `url(${currentTrack.albumArtUrl})`
      );
    }
  }, [currentTrack?.albumArtUrl]);

  return (
    <div className="App">
      {/* Blurred Background */}
      <div
        className={`app-background ${
          currentTrack?.albumArtUrl ? "with-image" : ""
        }`}
      ></div>

      {/* Overlay to darken background slightly for contrast */}
      <div className="background-overlay"></div>

      {/* Search Bar */}
      <SearchBar onAddToPlaylist={handleAddToPlaylist} />

      {/* Error message */}
      {error && (
        <div className="error-message">
          {error}
          <button
            onClick={() => setError(null)}
            className="error-close-button"
            aria-label="Close error message"
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {/* Hidden Audio Element */}
      {currentTrack && (
        <audio
          ref={audioRef}
          src={currentTrack.audioSrc}
          preload="metadata"
        ></audio>
      )}

      <div className="content-layout">
        {/* Left side: Music Player */}
        <div className="player-container">
          {currentTrack ? (
            <>
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
                onNext={playlist.length > 1 ? handleNext : undefined}
                onPrev={currentTrackIndex > 0 ? handlePrev : undefined}
              />
            </>
          ) : (
            <div className="empty-player-message">
              <h2>No track selected</h2>
              <p>Search for a song to start playing</p>
            </div>
          )}

          {/* Lyrics toggle button for mobile */}
          {currentTrack && (
            <button
              className="lyrics-toggle-button"
              onClick={toggleLyrics}
              type="button"
              aria-label={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
            >
              {showLyrics ? "Hide Lyrics" : "Show Lyrics"}
            </button>
          )}
        </div>

        {/* Right side: Lyrics Display (conditionally shown) */}
        {showLyrics && currentTrack && currentTrack.lrcUrl && (
          <div className="lyrics-panel">
            <LrcPlayer lrcUrl={currentTrack.lrcUrl} currentTime={currentTime} />
          </div>
        )}
      </div>

      {/* Playlist area - positioned below in mobile view */}
      <div className="playlist-container">
        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <span>Loading suggestions...</span>
          </div>
        )}
        <Playlist
          tracks={playlist}
          currentTrackId={currentTrack?.id || 0}
          onTrackSelect={handleTrackSelect}
        />
      </div>
    </div>
  );
}

export default App;
