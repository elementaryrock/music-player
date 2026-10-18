import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import "./App.css";
import "./background.css";
import BrowseShell from "./components/apple/BrowseShell";
import { ImmersivePlayer } from "./components/apple/ImmersivePlayer";
import { LyricsDrawer } from "./components/apple/LyricsDrawer";
import { searchGlobalTracks, type SearchResult } from "./services/metadataDiscovery";
import { resolveTrackStream } from "./services/resolveTrackStream";
import type { Track } from "./types/api.types";

const LOCAL_PLAYLIST: Track[] = [
  {
    id: "local-thats-so-true",
    title: "That's So True",
    artist: "Gracie Abrams",
    audioSrc: "/song/song.mp3",
    albumArtUrl: "/albumart/albumart_600.jpg",
    lrcUrl: "/lrc/lyrics.lrc",
    album: "The Secret of Us",
    source: "local",
    streamQuality: "standard",
  },
  {
    id: "local-golden-hour",
    title: "Golden Hour",
    artist: "JVKE",
    audioSrc: "/song/song2.mp3",
    albumArtUrl: "/albumart/albumart2.jpg",
    lrcUrl: "/lrc/lyrics2.lrc",
    album: "this is what ____ feels like",
    source: "local",
    streamQuality: "standard",
  },
];

const qualityLabel = (track: Track | null): string => {
  if (!track) return "Standard";
  if (track.streamResolution?.qualityLabel) return track.streamResolution.qualityLabel;

  switch (track.streamQuality) {
    case "hi-res":
      return "Hi-Res";
    case "lossless":
      return "Lossless";
    case "high":
      return "High Quality";
    default:
      return "Standard";
  }
};

const sourceLabel = (track: Track | null): string => {
  if (!track) return "Local";
  const source = track.streamResolution?.source ?? track.source;
  switch (source) {
    case "tidal":
      return "Tidal";
    case "jiosaavn":
      return "JioSaavn";
    case "itunes":
      return "iTunes";
    default:
      return "Local";
  }
};

const toTrack = (result: SearchResult): Track => ({
  id: result.id,
  title: result.title,
  artist: result.artist,
  primaryArtist: result.primaryArtist || result.artist,
  audioSrc: result.audioUrl || "",
  albumArtUrl: result.artworkUrl || result.imageUrl,
  album: result.album,
  duration: result.duration,
  source: result.source,
  metadataSource: result.metadataSource || result.source,
  explicit: result.explicit,
  popularity: result.popularity,
  rank: result.rank,
  isrc: result.isrc,
  providerMetadata: result.providerMetadata,
  audioCandidates: result.audioCandidates,
  streamQuality: result.quality,
  streamMatchConfidence: result.streamMatchConfidence,
});

function App() {
  const [playlist, setPlaylist] = useState<Track[]>(() => LOCAL_PLAYLIST);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => LOCAL_PLAYLIST[0] ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(LOCAL_PLAYLIST[0]?.duration ?? 0);
  const [volume, setVolume] = useState(0.72);
  const [favoriteIds, setFavoriteIds] = useState<Set<string | number>>(() => new Set());
  const [showLyrics, setShowLyrics] = useState(false);
  const [showImmersive, setShowImmersive] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const searchRequestRef = useRef(0);
  const resolutionAbortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const currentTrackIndex = useMemo(
    () => (currentTrack ? playlist.findIndex((track) => track.id === currentTrack.id) : -1),
    [currentTrack, playlist],
  );
  const isLiked = currentTrack ? favoriteIds.has(currentTrack.id) : false;
  const displayError = appError || searchError;

  const commitTrack = useCallback((track: Track, shouldPlay = true) => {
    setPlaylist((currentPlaylist) => {
      const existingIndex = currentPlaylist.findIndex((item) => item.id === track.id);
      if (existingIndex === -1) return [...currentPlaylist, track];

      const nextPlaylist = [...currentPlaylist];
      nextPlaylist[existingIndex] = track;
      return nextPlaylist;
    });
    setCurrentTrack(track);
    setIsPlaying(shouldPlay);
    setCurrentTime(0);
    setAppError(null);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setIsSearching(true);
    setSearchError(null);
    setAppError(null);
    retryRef.current = () => {
      void handleSearch(trimmedQuery);
    };

    try {
      // Metadata discovery stays global by default. JioSaavn is intentionally
      // excluded here and is only consulted by strict stream resolution.
      const results = await searchGlobalTracks(trimmedQuery, {
        sources: ["tidal", "itunes"],
        maxResults: 20,
      });
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("No global metadata matched that search. Try again or refine the query.");
      }
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      const message = error instanceof Error ? error.message : "Search failed";
      setSearchResults([]);
      setSearchError(`We couldn't search right now. ${message}`);
    } finally {
      if (requestId === searchRequestRef.current) setIsSearching(false);
    }
  }, []);

  const handleResultSelect = useCallback(async (result: SearchResult) => {
    resolutionAbortRef.current?.abort();
    const controller = new AbortController();
    resolutionAbortRef.current = controller;
    setIsResolving(true);
    setAppError(null);
    setSearchError(null);
    retryRef.current = () => {
      void handleResultSelect(result);
    };

    try {
      const metadataTrack = toTrack(result);
      const resolved = await resolveTrackStream(metadataTrack, {
        signal: controller.signal,
        timeoutMs: 8000,
      });

      if (controller.signal.aborted) return;
      if (!resolved) {
        throw new Error("No verified Tidal or JioSaavn stream matched this recording.");
      }

      commitTrack(
        {
          ...metadataTrack,
          audioSrc: resolved.audioSrc,
          source: resolved.source,
          streamQuality: resolved.quality,
          streamMatchConfidence: resolved.matchConfidence,
          streamResolution: resolved,
        },
        true,
      );
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Unable to play this result";
      setAppError(`This song couldn't be played safely. ${message}`);
    } finally {
      if (resolutionAbortRef.current === controller) {
        resolutionAbortRef.current = null;
        setIsResolving(false);
      }
    }
  }, [commitTrack]);

  const handleSelectTrack = useCallback((track: Track) => {
    resolutionAbortRef.current?.abort();
    setIsResolving(false);
    commitTrack(track, true);
  }, [commitTrack]);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return;
    setAppError(null);
    setIsPlaying((playing) => !playing);
  }, [currentTrack]);

  const handleNext = useCallback(() => {
    const nextTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex + 1] : undefined;
    if (nextTrack) commitTrack(nextTrack, true);
  }, [commitTrack, currentTrackIndex, playlist]);

  const handlePrevious = useCallback(() => {
    if (currentTime > 3) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const previousTrack = currentTrackIndex > 0 ? playlist[currentTrackIndex - 1] : undefined;
    if (previousTrack) commitTrack(previousTrack, true);
  }, [commitTrack, currentTime, currentTrackIndex, playlist]);

  const handleSeekTo = useCallback((time: number) => {
    const nextTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, []);

  const handleSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    handleSeekTo(Number(event.target.value));
  }, [handleSeekTo]);

  const handleToggleLike = useCallback((nextLiked?: boolean) => {
    if (!currentTrack) return;
    setFavoriteIds((favorites) => {
      const nextFavorites = new Set(favorites);
      const shouldLike = nextLiked ?? !nextFavorites.has(currentTrack.id);
      if (shouldLike) nextFavorites.add(currentTrack.id);
      else nextFavorites.delete(currentTrack.id);
      return nextFavorites;
    });
  }, [currentTrack]);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false);
    setAppError("Audio couldn't load. Check your connection or choose a local track from the queue.");
    retryRef.current = () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.load();
      setIsPlaying(true);
    };
  }, []);

  const handleAudioEnded = useCallback(() => {
    const nextTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex + 1] : undefined;
    if (nextTrack) {
      commitTrack(nextTrack, true);
    } else {
      setIsPlaying(false);
      setCurrentTime(duration);
    }
  }, [commitTrack, currentTrackIndex, duration, playlist]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.pause();
    audio.load();
    setCurrentTime(0);
    setDuration(currentTrack.duration ?? 0);
    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
        setAppError("Playback was blocked by the browser. Press play to try again.");
      });
    }
  // The dependency is intentionally the stream URL: play/pause changes must
  // not reload the media element.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
        setAppError("Playback was blocked by the browser. Press play to try again.");
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => () => {
    resolutionAbortRef.current?.abort();
  }, []);

  return (
    <div className="App">
      <BrowseShell
        currentTrack={currentTrack}
        playlist={playlist}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching || isResolving}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isLiked={isLiked}
        showLyrics={showLyrics}
        onSearchQueryChange={(query) => {
          setSearchQuery(query);
          if (!query.trim()) {
            setSearchResults([]);
            setSearchError(null);
          }
        }}
        onSearch={handleSearch}
        onSelectResult={(result) => void handleResultSelect(result)}
        onSelectTrack={handleSelectTrack}
        onPlayPause={handlePlayPause}
        onPrev={handlePrevious}
        onNext={handleNext}
        onSeek={handleSeekTo}
        onToggleLyrics={() => setShowLyrics((visible) => !visible)}
        onOpenImmersive={() => setShowImmersive(true)}
        onToggleLike={() => handleToggleLike()}
        onOpenQueue={() => setShowQueue((visible) => !visible)}
        onVolumeChange={setVolume}
        volume={volume}
        profileName="Music listener"
      />

      {currentTrack && (
        <div className="app-stream-badge" aria-live="polite">
          <span className={`app-quality-badge app-quality-badge--${qualityLabel(currentTrack).toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {qualityLabel(currentTrack)}
          </span>
          <span className="app-source-badge">{sourceLabel(currentTrack)}</span>
          {isResolving && <span className="app-resolving-badge">Verifying stream…</span>}
        </div>
      )}

      <audio
        ref={audioRef}
        className="app-audio"
        src={currentTrack?.audioSrc || undefined}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
      />

      {displayError && (
        <div className="app-error" role="alert">
          <span>{displayError}</span>
          <div className="app-error-actions">
            {retryRef.current && <button type="button" onClick={() => retryRef.current?.()}>Retry</button>}
            <button type="button" aria-label="Dismiss error" onClick={() => { setAppError(null); setSearchError(null); }}>Dismiss</button>
          </div>
        </div>
      )}

      {showQueue && (
        <aside className="app-queue" aria-label="Up next queue">
          <div className="app-queue-header">
            <div><span className="app-overline">UP NEXT</span><h2>Queue</h2></div>
            <button type="button" aria-label="Close queue" onClick={() => setShowQueue(false)}>×</button>
          </div>
          <ol className="app-queue-list">
            {playlist.map((track) => (
              <li key={track.id} className={track.id === currentTrack?.id ? "is-current" : ""}>
                <button type="button" onClick={() => { handleSelectTrack(track); setShowQueue(false); }}>
                  <span>{track.title}</span><small>{track.artist}</small>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      )}

      {currentTrack && (
        <LyricsDrawer
          open={showLyrics}
          onClose={() => setShowLyrics(false)}
          track={currentTrack}
          currentTime={currentTime}
          onSeekTo={handleSeekTo}
        />
      )}

      {currentTrack && showImmersive && (
        <ImmersivePlayer
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isLiked={isLiked}
          onClose={() => setShowImmersive(false)}
          onPlayPause={handlePlayPause}
          onPrev={handlePrevious}
          onNext={handleNext}
          onSeek={handleSeek}
          onSeekTo={handleSeekTo}
          onToggleLike={handleToggleLike}
          volume={volume}
          onVolumeChange={setVolume}
        />
      )}
    </div>
  );
}

export default App;
