import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react";
import "./App.css";
import BrowseShell, { POPULAR_RECOMMENDATIONS } from "./components/apple/BrowseShell";
import { ImmersivePlayer } from "./components/apple/ImmersivePlayer";
import { LyricsDrawer } from "./components/apple/LyricsDrawer";
import { normalizeSearchText, searchGlobalTracks, type SearchResult } from "./services/metadataDiscovery";
import { parsePlaylistImport, type ImportedPlaylistEntry } from "./services/playlistImport";
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
  importedMetadata?: boolean;
  importedSource?: string;
  importedPlaylistName?: string;
};

const PREVIEW_FALLBACK_DURATION_SECONDS = 30;
const AUTOPLAY_SUGGESTIONS_STORAGE_KEY = "glass-player-autoplay-suggestions:v1";
const IMPORTED_PLAYLIST_STORAGE_KEY = "glass-player-imported-playlist:v1";

const readAutoplaySuggestionsPreference = (): boolean => {
  if (typeof window === "undefined") return true;

  try {
    const storedValue = window.localStorage.getItem(AUTOPLAY_SUGGESTIONS_STORAGE_KEY);
    if (storedValue === "true") return true;
    if (storedValue === "false") return false;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return true;
};

const normalizedTrackMetadata = (track: Pick<Track, "title" | "artist">) => ({
  title: normalizeSearchText(track.title),
  artist: normalizeSearchText(track.artist),
});

const sharesTrackMetadata = (
  left: Pick<Track, "title" | "artist">,
  right: Pick<Track, "title" | "artist">,
): boolean => {
  const leftMetadata = normalizedTrackMetadata(left);
  const rightMetadata = normalizedTrackMetadata(right);

  return Boolean(
    (leftMetadata.title && leftMetadata.title === rightMetadata.title) ||
    (leftMetadata.artist && leftMetadata.artist === rightMetadata.artist),
  );
};

const trackMetadataKey = (track: Pick<Track, "title" | "artist">): string => {
  const metadata = normalizedTrackMetadata(track);
  return `${metadata.title}\u0000${metadata.artist}`;
};

const isImportedMetadataTrack = (track: Track | null): track is AppTrack =>
  Boolean(track && (track as AppTrack).importedMetadata === true);

const createImportedTrack = (entry: ImportedPlaylistEntry, index: number): AppTrack => {
  const identity = normalizeSearchText(`${entry.title}-${entry.artist}-${entry.album || ""}`)
    .replace(/\s+/g, "-") || `entry-${index + 1}`;

  return {
    id: `imported-${entry.source}-${identity}-${entry.sourceIndex ?? index}`,
    title: entry.title,
    artist: entry.artist,
    album: entry.album,
    duration: entry.duration,
    isrc: entry.isrc,
    audioSrc: "",
    source: undefined,
    metadataSource: undefined,
    importedMetadata: true,
    importedSource: entry.source,
    importedPlaylistName: entry.playlistName,
  };
};

const importedTrackToEntry = (track: AppTrack, index: number): ImportedPlaylistEntry => ({
  source: (track.importedSource as ImportedPlaylistEntry["source"]) || "unknown",
  playlistName: track.importedPlaylistName || "Imported Playlist",
  title: track.title,
  artist: track.artist,
  album: track.album,
  duration: track.duration,
  isrc: track.isrc,
  sourceIndex: index,
});

const readImportedTracks = (): AppTrack[] => {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(IMPORTED_PLAYLIST_STORAGE_KEY);
    if (!stored) return [];
    const entries = JSON.parse(stored) as ImportedPlaylistEntry[];
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => entry && typeof entry.title === "string" && typeof entry.artist === "string")
      .map((entry, index) => createImportedTrack(entry, index));
  } catch {
    return [];
  }
};

const importedTrackToSearchResult = (track: AppTrack): SearchResult => ({
  id: String(track.id),
  title: track.title,
  artist: track.artist,
  primaryArtist: track.primaryArtist || track.artist,
  album: track.album,
  duration: track.duration,
  source: "itunes",
  metadataSource: "itunes",
  artworkUrl: track.albumArtUrl,
  imageUrl: track.albumArtUrl,
  isrc: track.isrc,
  rank: 0,
  confidence: 1,
  originalData: {
    imported: true,
    source: track.importedSource,
    playlistName: track.importedPlaylistName,
  },
});

export interface PlaylistImportSummary {
  playlistName: string;
  source: string;
  importedCount: number;
  skippedCount: number;
  warnings: string[];
  error?: string;
}

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

type PlaybackState = "local" | "full" | "preview" | "unverified";

const playbackState = (track: Track | null): PlaybackState => {
  if (!track) return "local";
  if (isPreviewTrack(track)) return "preview";

  const source = track.streamResolution?.source ?? track.source;
  if (source === "local") return "local";
  return track.streamResolution && (source === "tidal" || source === "jiosaavn")
    ? "full"
    : "unverified";
};

const playbackStateLabel = (track: Track | null): string => {
  switch (playbackState(track)) {
    case "preview":
      return `Preview · ${sourceLabel(track)}`;
    case "full":
      return `Full · ${sourceLabel(track)}`;
    case "unverified":
      return `Unverified · ${sourceLabel(track)}`;
    default:
      return "Local file";
  }
};

/**
 * A provider's metadata duration describes the recording, not an iTunes
 * sample. Do not use it as the progress-bar duration until the audio element
 * reports its real duration; the explicit fallback is the known Apple sample
 * limit rather than the several-minute metadata value.
 */
const initialPlaybackDuration = (track: Track | null): number => {
  if (!track) return 0;
  if (isPreviewTrack(track)) return PREVIEW_FALLBACK_DURATION_SECONDS;

  return typeof track.duration === "number" && Number.isFinite(track.duration)
    ? Math.max(0, track.duration)
    : 0;
};

const mediaPlaybackDuration = (track: Track | null, mediaDuration: number): number => {
  if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) {
    return initialPlaybackDuration(track);
  }

  return isPreviewTrack(track)
    ? Math.min(mediaDuration, PREVIEW_FALLBACK_DURATION_SECONDS)
    : mediaDuration;
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
  importedMetadata: result.originalData?.imported === true,
  importedSource: typeof result.originalData?.source === "string" ? result.originalData.source : undefined,
  importedPlaylistName: typeof result.originalData?.playlistName === "string" ? result.originalData.playlistName : undefined,
});

function App() {
  const [playlist, setPlaylist] = useState<Track[]>(() => [...LOCAL_PLAYLIST, ...readImportedTracks()]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => LOCAL_PLAYLIST[0] ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(LOCAL_PLAYLIST[0]?.duration ?? 0);
  const [volume, setVolume] = useState(0.72);
  const [favoriteIds, setFavoriteIds] = useState<Set<string | number>>(() => new Set());
  const [showLyrics, setShowLyrics] = useState(false);
  const [showImmersive, setShowImmersive] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [autoplaySuggestions, setAutoplaySuggestions] = useState(readAutoplaySuggestionsPreference);
  const [importSummary, setImportSummary] = useState<PlaylistImportSummary | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [pendingResolution, setPendingResolution] = useState<{
    title: string;
    artist: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const searchRequestRef = useRef(0);
  const resolutionAbortRef = useRef<AbortController | null>(null);
  const resolutionRequestRef = useRef(0);
  const retryRef = useRef<(() => void) | null>(null);
  const mediaGenerationRef = useRef(0);
  const pendingPlayRef = useRef(false);
  const playAttemptGenerationRef = useRef<number | null>(null);
  const mediaTransitionRef = useRef(false);
  const activeAudioSourceRef = useRef<string | null>(null);
  const suggestionCursorRef = useRef(0);
  const lastSuggestionKeyRef = useRef<string | null>(null);

  const currentTrackIndex = useMemo(
    () => (currentTrack ? playlist.findIndex((track) => track.id === currentTrack.id) : -1),
    [currentTrack, playlist],
  );
  const suggestionCandidates = useMemo(
    () => POPULAR_RECOMMENDATIONS.filter((suggestion) => {
      if (currentTrack && sharesTrackMetadata(suggestion, currentTrack)) return false;
      return !playlist.some((track) => sharesTrackMetadata(suggestion, track));
    }),
    [currentTrack, playlist],
  );
  const importedPlaylistNames = useMemo(
    () => [...new Set(
      playlist
        .filter(isImportedMetadataTrack)
        .map((track) => track.importedPlaylistName)
        .filter((name): name is string => Boolean(name)),
    )],
    [playlist],
  );
  const isLiked = currentTrack ? favoriteIds.has(currentTrack.id) : false;
  const displayError = appError || searchError;

  const pickSuggestion = useCallback(() => {
    const candidates = suggestionCandidates.filter(
      (suggestion) => trackMetadataKey(suggestion) !== lastSuggestionKeyRef.current,
    );
    if (candidates.length === 0) return undefined;

    const suggestion = candidates[suggestionCursorRef.current % candidates.length];
    suggestionCursorRef.current += 1;
    lastSuggestionKeyRef.current = trackMetadataKey(suggestion);
    return suggestion;
  }, [suggestionCandidates]);

  const invalidatePendingResolution = useCallback(() => {
    resolutionRequestRef.current += 1;
    resolutionAbortRef.current?.abort();
    resolutionAbortRef.current = null;
    setIsResolving(false);
    setPendingResolution(null);
  }, []);

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
    // Queue navigation, local tracks, and a successful resolver commit all
    // invalidate any older request. This closes the gap where an abort-aware
    // provider still resolves after the user has already selected something
    // else.
    invalidatePendingResolution();
    retryRef.current = null;
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
    setDuration(initialPlaybackDuration(track));
    setAppError(null);
    setPlaybackNotice(null);
  }, [invalidatePendingResolution]);

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
      // Metadata discovery starts with the reliable global indexes. JioSaavn is
      // queried only when those indexes return nothing, then strict resolution
      // validates the selected recording before playback.
      let results = await searchGlobalTracks(trimmedQuery, {
        sources: ["tidal", "itunes"],
        maxResults: 20,
      });
      if (requestId !== searchRequestRef.current) return;

      // Tidal is optional and iTunes does not cover every regional or
      // independent release. If the global indexes have no result, make one
      // explicit JioSaavn metadata fallback request instead of reporting a
      // false search failure. Playback still performs strict identity checks,
      // so a Jio cover cannot be substituted for the selected recording.
      if (results.length === 0) {
        results = await searchGlobalTracks(trimmedQuery, {
          sources: ["jiosaavn"],
          maxResults: 20,
          forceRefresh: true,
        });
      }
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
    const requestId = resolutionRequestRef.current + 1;
    resolutionRequestRef.current = requestId;
    resolutionAbortRef.current?.abort();
    const controller = new AbortController();
    resolutionAbortRef.current = controller;
    setIsResolving(true);
    setPendingResolution({ title: result.title, artist: result.artist });
    // Do not let the previously selected track keep playing while the new
    // selection is being verified. It must not look like the new result was
    // silently mapped to the old audio source.
    setIsPlaying(false);
    setAppError(null);
    setPlaybackNotice(null);
    setSearchError(null);
    retryRef.current = () => {
      if (requestId === resolutionRequestRef.current) void handleResultSelect(result);
    };

    const isCurrentResolution = () =>
      requestId === resolutionRequestRef.current && !controller.signal.aborted;

    try {
      const metadataTrack = toTrack(result);
      const resolved = await resolveTrackStream(metadataTrack, {
        signal: controller.signal,
        timeoutMs: 8000,
      });

      if (!isCurrentResolution()) return;
      if (!resolved) {
        throw new Error(
          "No verified Tidal or JioSaavn full stream matched this recording, and no matching iTunes preview was available.",
        );
      }

      const resolvedPreview = resolved.isPreview || resolved.source === "itunes";
      const verifiedPreview = resolved.source === "itunes" && resolved.isPreview === true;
      const verifiedFull =
        (resolved.source === "tidal" || resolved.source === "jiosaavn") && resolved.isPreview === false;
      if ((resolvedPreview && !verifiedPreview) || (!resolvedPreview && !verifiedFull)) {
        throw new Error("The provider returned an unverified playback URL, so playback was not started.");
      }

      if (!isCurrentResolution()) return;
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
        setPlaybackNotice(
          `Preview only · iTunes sample (up to ${PREVIEW_FALLBACK_DURATION_SECONDS}s). No verified full stream from Tidal or JioSaavn was available for this recording.`,
        );
      }
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      if (!isCurrentResolution()) return;
      const message = error instanceof Error ? error.message : "Unable to play this result";
      setIsPlaying(false);
      setPlaybackNotice(null);
      setAppError(`This song couldn't be played safely. ${message}`);
    } finally {
      if (requestId === resolutionRequestRef.current && resolutionAbortRef.current === controller) {
        resolutionAbortRef.current = null;
        setIsResolving(false);
        setPendingResolution(null);
      }
    }
  }, [commitTrack]);

  const handleSuggestionPlayback = useCallback(() => {
    const suggestion = pickSuggestion();
    if (!suggestion) {
      retryRef.current = null;
      setIsPlaying(false);
      setPlaybackNotice(null);
      setAppError("No different suggestions are available right now. Search for another song to keep listening.");
      return;
    }

    void handleResultSelect(suggestion);
  }, [handleResultSelect, pickSuggestion]);

  const handleSelectTrack = useCallback((track: Track) => {
    if (isImportedMetadataTrack(track)) {
      void handleResultSelect(importedTrackToSearchResult(track));
      return;
    }
    commitTrack(track, true);
  }, [commitTrack, handleResultSelect]);

  const handleImportPlaylist = useCallback((input: string, fileName?: string) => {
    const parsed = parsePlaylistImport(input, { fileName });
    const existingKeys = new Set(playlist.map((track) => trackMetadataKey(track)));
    const entriesToAdd = parsed.entries.filter((entry) => {
      const key = trackMetadataKey(entry);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const importedTracks = entriesToAdd.map((entry, index) => createImportedTrack(entry, index));

    if (importedTracks.length > 0) {
      setPlaylist((currentPlaylist) => [...currentPlaylist, ...importedTracks]);
    }

    setImportSummary({
      playlistName: parsed.playlistName,
      source: parsed.source,
      importedCount: importedTracks.length,
      skippedCount: parsed.skippedCount + (parsed.entries.length - entriesToAdd.length),
      warnings: parsed.warnings.slice(0, 3),
      error: parsed.error,
    });
  }, [playlist]);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack || isResolving) return;
    setAppError(null);
    setIsPlaying((playing) => !playing);
  }, [currentTrack, isResolving]);

  const handleNext = useCallback(() => {
    const nextTrack = currentTrackIndex >= 0 ? playlist[currentTrackIndex + 1] : undefined;
    if (nextTrack) handleSelectTrack(nextTrack);
  }, [currentTrackIndex, handleSelectTrack, playlist]);

  const handlePrevious = useCallback(() => {
    if (currentTime > 3) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const previousTrack = currentTrackIndex > 0 ? playlist[currentTrackIndex - 1] : undefined;
    if (previousTrack) handleSelectTrack(previousTrack);
  }, [currentTime, currentTrackIndex, handleSelectTrack, playlist]);

  const handleSeekTo = useCallback((time: number) => {
    const maxDuration = isPreviewTrack(currentTrack)
      ? PREVIEW_FALLBACK_DURATION_SECONDS
      : duration > 0
        ? duration
        : Number.POSITIVE_INFINITY;
    const nextTime = Number.isFinite(time) ? Math.min(maxDuration, Math.max(0, time)) : 0;
    const audio = audioRef.current;
    if (audio) audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [currentTrack, duration]);

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
      handleSelectTrack(nextTrack);
    } else if (autoplaySuggestions) {
      setCurrentTime(duration);
      handleSuggestionPlayback();
    } else {
      setIsPlaying(false);
      setCurrentTime(duration);
    }
  }, [autoplaySuggestions, currentTrackIndex, duration, handleSelectTrack, handleSuggestionPlayback, playlist]);

  const handleCloseImmersive = useCallback(() => {
    setShowImmersive(false);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTOPLAY_SUGGESTIONS_STORAGE_KEY, String(autoplaySuggestions));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [autoplaySuggestions]);

  useEffect(() => {
    try {
      const importedEntries = playlist
        .filter(isImportedMetadataTrack)
        .map((track, index) => importedTrackToEntry(track, index));
      window.localStorage.setItem(IMPORTED_PLAYLIST_STORAGE_KEY, JSON.stringify(importedEntries));
    } catch {
      // Imported metadata is a convenience cache; playback does not depend on it.
    }
  }, [playlist]);

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
    setDuration(initialPlaybackDuration(currentTrack));

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

  const handleAudioDuration = useCallback((event: SyntheticEvent<HTMLAudioElement>) => {
    const source = currentTrack?.audioSrc?.trim() || "";
    if (!source || activeAudioSourceRef.current !== source) return;

    setDuration(mediaPlaybackDuration(currentTrack, event.currentTarget.duration));
  }, [currentTrack]);

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
        isResolving={isResolving}
        importSummary={importSummary}
        importedPlaylistNames={importedPlaylistNames}
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
        onShuffleSuggestions={handleSuggestionPlayback}
        onImportPlaylist={handleImportPlaylist}
        onOpenQueue={() => setShowQueue((visible) => !visible)}
        onVolumeChange={setVolume}
        volume={volume}
        profileName="Music listener"
      />

      {currentTrack && (
        <div className="app-stream-badge" aria-live="polite">
          {isResolving && pendingResolution ? (
            <span className="app-playback-state app-playback-state--resolving">
              Verifying full stream · {pendingResolution.title}
            </span>
          ) : (
            <span className={`app-playback-state app-playback-state--${playbackState(currentTrack)}`}>
              {playbackStateLabel(currentTrack)}
            </span>
          )}
          <span className={`app-quality-badge app-quality-badge--${qualityLabel(currentTrack).toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            {qualityLabel(currentTrack)}
          </span>
        </div>
      )}

      <audio
        ref={audioRef}
        className="app-audio"
        src={currentTrack?.audioSrc || undefined}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(
          isPreviewTrack(currentTrack)
            ? Math.min(event.currentTarget.currentTime, PREVIEW_FALLBACK_DURATION_SECONDS)
            : event.currentTarget.currentTime,
        )}
        onLoadedMetadata={handleAudioDuration}
        onDurationChange={handleAudioDuration}
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
          <div className="app-queue-controls">
            <label className="app-queue-autoplay">
              <span className="app-queue-autoplay-copy">
                <strong>Autoplay suggestions</strong>
                <small>Keep listening after your queue ends.</small>
              </span>
              <input
                type="checkbox"
                checked={autoplaySuggestions}
                onChange={(event) => setAutoplaySuggestions(event.target.checked)}
                aria-label="Autoplay suggestions"
              />
            </label>
            <p className="app-queue-suggestion-note">
              {suggestionCandidates.length > 0
                ? `${suggestionCandidates.length} different suggestion${suggestionCandidates.length === 1 ? "" : "s"} ready.`
                : "No different suggestions match this queue yet."}
            </p>
          </div>
          <ol className="app-queue-list">
            {playlist.length > 0 ? playlist.map((track) => (
              <li key={track.id} className={track.id === currentTrack?.id ? "is-current" : ""}>
                <button type="button" onClick={() => { handleSelectTrack(track); setShowQueue(false); }}>
                  <span>{track.title}</span><small>{track.artist}</small>
                </button>
              </li>
            )) : (
              <li className="app-queue-empty">
                <span>Your queue is empty.</span>
                <small>Choose a song to start building it.</small>
              </li>
            )}
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
