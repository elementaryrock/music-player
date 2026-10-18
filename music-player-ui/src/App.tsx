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

type AppTrack = Track & {
  isPreview?: boolean;
  playbackKind?: "full" | "preview";
  previewUrl?: string;
};

const isPreviewTrack = (track: Track | null): boolean => {
  if (!track) return false;
  const appTrack = track as AppTrack;
  const resolution = track.streamResolution;
  return appTrack.isPreview === true ||
    appTrack.playbackKind === "preview" ||
    resolution?.isPreview === true ||
    resolution?.source === "itunes";
};

const qualityLabel = (track: Track | null): string => {
  if (!track) return "Standard";
  if (isPreviewTrack(track)) return "Preview";
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

const toTrack = (result: SearchResult): AppTrack => ({
  // Preserve any preview metadata added by the discovery/resolver contract.
  // Explicit fields below keep the existing Track shape canonical.
  ...result,
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
  previewUrl: result.previewUrl,
  isPreview: result.isPreview,
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
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const searchRequestRef = useRef(0);
  const resolutionAbortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const mediaGenerationRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const playAttemptGenerationRef = useRef<number | null>(null);
  const mediaTransitionRef = useRef(false);
  const activeAudioSourceRef = useRef<string | null>(null);

  const currentTrackIndex = useMemo(
    () => (currentTrack ? playlist.findIndex((track) => track.id === currentTrack.id) : -1),
    [currentTrack, playlist],
  );
  const isLiked = currentTrack ? favoriteIds.has(currentTrack.id) : false;
  const displayError = appError || searchError;

  const attemptPlayback = useCallback((generation: number) => {
    const audio = audioRef.current;
    if (
      !audio ||
      generation !== mediaGenerationRef.current ||
      !pendingPlayRef.current ||
      !currentTrack?.audioSrc
    ) {
      return;
    }

    // The readiness listeners call this function, so a second state effect can
    // safely ask for playback without issuing two concurrent play() requests.
    if (audio.readyState < 1 || playAttemptGenerationRef.current === generation) return;
    if (!audio.paused) {
      pendingPlayRef.current = false;
      return;
    }

    playAttemptGenerationRef.current = generation;
    let playPromise: Promise<void>;
    try {
      playPromise = audio.play();
    } catch (error) {
      playAttemptGenerationRef.current = null;
      const errorName = error instanceof Error ? error.name : undefined;
      if (generation !== mediaGenerationRef.current || !pendingPlayRef.current || errorName === "AbortError") return;
      pendingPlayRef.current = false;
      setIsPlaying(false);
      setPlaybackNotice(null);
      setAppError("Playback was blocked by the browser. Press play to try again.");
      return;
    }

    void playPromise.then(() => {
      if (generation !== mediaGenerationRef.current) return;
      pendingPlayRef.current = false;
      playAttemptGenerationRef.current = null;
    }).catch((error: unknown) => {
      playAttemptGenerationRef.current = null;
      const errorName = error instanceof Error ? error.name : undefined;
      // AbortError is expected while a source is being replaced or paused. A
      // real media-policy failure is surfaced after the source is ready.
      if (generation !== mediaGenerationRef.current || !pendingPlayRef.current || errorName === "AbortError") return;
      pendingPlayRef.current = false;
      setIsPlaying(false);
      setPlaybackNotice(null);
      setAppError("Playback was blocked by the browser. Press play to try again.");
    });
  }, [currentTrack?.audioSrc]);

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
    setPlaybackNotice(null);
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
    setPlaybackNotice(null);
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
        throw new Error("No verified Tidal or JioSaavn stream, or matching iTunes preview, was available.");
      }

      const resolvedPreview = resolved.isPreview || resolved.source === "itunes";
      const resolvedTrack: AppTrack = {
        ...metadataTrack,
        audioSrc: resolved.audioSrc,
        source: resolved.source,
        streamQuality: resolved.quality,
        streamMatchConfidence: resolved.matchConfidence,
        streamResolution: resolved,
        isPreview: resolvedPreview,
        playbackKind: resolvedPreview ? "preview" : "full",
      };
      commitTrack(resolvedTrack, true);
      if (resolvedPreview) {
        setPlaybackNotice("Preview only · playing a short iTunes preview because no verified full stream was available.");
      }
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
    const audio = audioRef.current;
    const activeSource = activeAudioSourceRef.current;
    if (!audio || !activeSource || !currentTrack?.audioSrc || activeSource !== currentTrack.audioSrc) return;

    // The browser emits MEDIA_ERR_ABORTED while load() replaces a source. It
    // is a normal transition and should not flash an actionable error.
    if (audio.error?.code === 1) return;

    mediaTransitionRef.current = false;
    pendingPlayRef.current = false;
    playAttemptGenerationRef.current = null;
    setIsPlaying(false);
    setPlaybackNotice(null);
    setAppError("Audio couldn't load. Check your connection or choose a local track from the queue.");
    retryRef.current = () => {
      const retryAudio = audioRef.current;
      if (!retryAudio) return;
      pendingPlayRef.current = true;
      setAppError(null);
      setIsPlaying(true);
      retryAudio.load();
    };
  }, [currentTrack?.audioSrc]);

  const handleAudioEnded = useCallback(() => {
    const nextTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex + 1] : undefined;
    if (nextTrack) {
      commitTrack(nextTrack, true);
    } else {
      setIsPlaying(false);
      setCurrentTime(duration);
    }
  }, [commitTrack, currentTrackIndex, duration, playlist]);

  const handleCloseImmersive = useCallback(() => {
    setShowImmersive(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    const source = currentTrack?.audioSrc?.trim() || "";
    if (!audio) return undefined;

    const generation = mediaGenerationRef.current + 1;
    mediaGenerationRef.current = generation;
    mediaTransitionRef.current = true;
    pendingPlayRef.current = Boolean(source && isPlaying);
    playAttemptGenerationRef.current = null;
    activeAudioSourceRef.current = source || null;

    // onPause is ignored for this synchronous transition so replacing a local
    // or remote source does not turn the requested next-track play into pause.
    audio.pause();
    setCurrentTime(0);
    setDuration(currentTrack?.duration ?? 0);

    if (!source) {
      audio.removeAttribute("src");
      audio.load();
      mediaTransitionRef.current = false;
      setIsPlaying(false);
      return undefined;
    }

    const onReady = () => {
      mediaTransitionRef.current = false;
      attemptPlayback(generation);
    };
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("canplay", onReady);
    audio.load();

    // A cached local asset may already have metadata by the time this effect
    // runs. The same guarded path handles it without an eager play() call.
    if (audio.readyState >= 1) onReady();

    return () => {
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("canplay", onReady);
    };
  // The source effect intentionally reloads only when the URL changes. The
  // play/pause effect below handles state changes without reloading media.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.audioSrc, attemptPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioSrc) return;

    if (!isPlaying) {
      pendingPlayRef.current = false;
      playAttemptGenerationRef.current = null;
      audio.pause();
      return;
    }

    pendingPlayRef.current = true;
    attemptPlayback(mediaGenerationRef.current);
  }, [attemptPlayback, currentTrack?.audioSrc, isPlaying]);

  useEffect(() => {
    if (!showImmersive || typeof document === "undefined") return undefined;

    const body = document.body;
    const documentElement = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleCloseImmersive();
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [handleCloseImmersive, showImmersive]);

  useEffect(() => () => {
    resolutionAbortRef.current?.abort();
    pendingPlayRef.current = false;
    playAttemptGenerationRef.current = null;
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
        onPause={() => {
          if (mediaTransitionRef.current || pendingPlayRef.current && (audioRef.current?.readyState ?? 0) < 1) return;
          pendingPlayRef.current = false;
          playAttemptGenerationRef.current = null;
          setIsPlaying(false);
        }}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
      />

      {playbackNotice && (
        <div className="app-notice" role="status" aria-live="polite">
          {playbackNotice}
        </div>
      )}

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
          onClose={handleCloseImmersive}
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
