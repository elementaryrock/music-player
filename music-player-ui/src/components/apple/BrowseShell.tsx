import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { Track } from "../../types/api.types";
import { normalizeSearchText, type SearchResult } from "../../services/searchEngine";
import { Artwork, type Tone } from "./Artwork";
import { AlbumDetailPage, type AlbumPageStatus } from "./AlbumDetailPage";
import { SeeAllPage, type SeeAllVariant } from "./SeeAllPage";
import {
  dedupeByAlbum,
  getAlbumLabel,
  getAlbumTitle,
  getArtworkUrl,
  isSearchResult,
  type MediaItem,
} from "./mediaItems";
import {
  lookupAlbum,
  type AlbumDetail,
  type AlbumTrack,
} from "../../services/albumLookup";
import "./BrowseShell.css";
import "./sidebar-apple.css";

export type BrowseSection = "Search" | "Home" | "New" | "Radio";

export interface BrowseShellProps {
  currentTrack: Track | null;
  playlist: Track[];
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  showLyrics: boolean;
  isResolving: boolean;
  importSummary?: {
    playlistName: string;
    source: string;
    importedCount: number;
    skippedCount: number;
    warnings: string[];
    error?: string;
  } | null;
  importedPlaylistNames?: string[];
  onSearchQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onSelectTrack: (track: Track) => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onToggleLyrics: () => void;
  onOpenImmersive: () => void;
  onToggleLike: () => void;
  onShuffleSuggestions: () => void;
  onImportPlaylist?: (input: string, fileName?: string) => void;
  onOpenQueue?: () => void;
  onNavigate?: (section: BrowseSection) => void;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
  profileName?: string;
}

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "glass-player-theme";

/**
 * Curated metadata keeps the initial browse surface useful without pretending
 * that a recommendation already has a playable URL. Every click still enters
 * the same strict provider-resolution path as a normal search result.
 */
// Shared with the app-level autoplay picker; the list remains part of this curated browse surface.
// eslint-disable-next-line react-refresh/only-export-components
export const POPULAR_RECOMMENDATIONS: SearchResult[] = [
  { id: "recommendation-blinding-lights", title: "Blinding Lights", artist: "The Weeknd", primaryArtist: "The Weeknd", album: "After Hours", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/6fbce6c4-c38c-72d8-4fd0-66cfff32f679/20UMGIM12176.rgb.jpg/1000x1000.jpg", duration: 200, source: "itunes", metadataSource: "itunes", rank: 0, popularity: 99, confidence: 1 },
  { id: "recommendation-as-it-was", title: "As It Was", artist: "Harry Styles", primaryArtist: "Harry Styles", album: "Harry's House", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2a/19/fb/2a19fb85-2f70-9e44-f2a9-82abe679b88e/886449990061.jpg/1000x1000.jpg", duration: 167, source: "itunes", metadataSource: "itunes", rank: 1, popularity: 97, confidence: 1 },
  { id: "recommendation-flowers", title: "Flowers", artist: "Miley Cyrus", primaryArtist: "Miley Cyrus", album: "Endless Summer Vacation", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8c/67/ff/8c67ff91-31c3-3fef-1884-ce3ec89f3af4/196589946874.jpg/1000x1000.jpg", duration: 201, source: "itunes", metadataSource: "itunes", rank: 2, popularity: 96, confidence: 1 },
  { id: "recommendation-levitating", title: "Levitating", artist: "Dua Lipa", primaryArtist: "Dua Lipa", album: "Future Nostalgia", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/6c/11/d6/6c11d681-aa3a-d59e-4c2e-f77e181026ab/190295092665.jpg/1000x1000.jpg", duration: 204, source: "itunes", metadataSource: "itunes", rank: 3, popularity: 96, confidence: 1 },
  { id: "recommendation-shape-of-you", title: "Shape of You", artist: "Ed Sheeran", primaryArtist: "Ed Sheeran", album: "÷ (Divide)", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/15/e6/e8/15e6e8a4-4190-6a8b-86c3-ab4a51b88288/190295851286.jpg/1000x1000.jpg", duration: 234, source: "itunes", metadataSource: "itunes", rank: 4, popularity: 98, confidence: 1 },
  { id: "recommendation-anti-hero", title: "Anti-Hero", artist: "Taylor Swift", primaryArtist: "Taylor Swift", album: "Midnights", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/3d/01/f2/3d01f2e5-5a08-835f-3d30-d031720b2b80/22UM1IM07364.rgb.jpg/1000x1000.jpg", duration: 201, source: "itunes", metadataSource: "itunes", rank: 5, popularity: 96, confidence: 1 },
  { id: "recommendation-cruel-summer", title: "Cruel Summer", artist: "Taylor Swift", primaryArtist: "Taylor Swift", album: "Lover", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/49/3d/ab/493dab54-f920-9043-6181-80993b8116c9/19UMGIM53909.rgb.jpg/1000x1000.jpg", duration: 178, source: "itunes", metadataSource: "itunes", rank: 6, popularity: 97, confidence: 1 },
  { id: "recommendation-espresso", title: "Espresso", artist: "Sabrina Carpenter", primaryArtist: "Sabrina Carpenter", album: "Short n' Sweet", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a1/1c/ca/a11ccab6-7d4c-e041-d028-998bcebeb709/24UMGIM61704.rgb.jpg/1000x1000.jpg", duration: 175, source: "itunes", metadataSource: "itunes", rank: 7, popularity: 95, confidence: 1 },
  { id: "recommendation-stay", title: "Stay", artist: "The Kid LAROI & Justin Bieber", primaryArtist: "The Kid LAROI", album: "F*CK LOVE 3: OVER YOU", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/3a/22/a83a22f7-af18-7ef6-a7de-74816c532a44/886449475421.jpg/1000x1000.jpg", duration: 142, source: "itunes", metadataSource: "itunes", rank: 8, popularity: 94, confidence: 1 },
  { id: "recommendation-watermelon-sugar", title: "Watermelon Sugar", artist: "Harry Styles", primaryArtist: "Harry Styles", album: "Fine Line", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/2b/c4/c9/2bc4c9d4-3bc6-ab13-3f71-df0b89b173de/886448022213.jpg/1000x1000.jpg", duration: 174, source: "itunes", metadataSource: "itunes", rank: 9, popularity: 94, confidence: 1 },
  { id: "recommendation-bad-guy", title: "Bad Guy", artist: "Billie Eilish", primaryArtist: "Billie Eilish", album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/1000x1000.jpg", duration: 194, source: "itunes", metadataSource: "itunes", rank: 10, popularity: 97, confidence: 1 },
  { id: "recommendation-uptown-funk", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", primaryArtist: "Mark Ronson", album: "Uptown Special", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/7e/30/c5/7e30c572-aa47-5f7b-c6fd-42d50cd2c56d/886444959797.jpg/1000x1000.jpg", duration: 270, source: "itunes", metadataSource: "itunes", rank: 11, popularity: 96, confidence: 1 },
  { id: "recommendation-cheap-thrills", title: "Cheap Thrills", artist: "Sia", primaryArtist: "Sia", album: "This Is Acting", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bc/13/27/bc13275c-8b26-802d-771b-d15ae00fb530/mzm.hvpwjsvi.jpg/1000x1000.jpg", duration: 212, source: "itunes", metadataSource: "itunes", rank: 12, popularity: 93, confidence: 1 },
  { id: "recommendation-dance-monkey", title: "Dance Monkey", artist: "Tones and I", primaryArtist: "Tones and I", album: "The Kids Are Coming", artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/87/ed/42/87ed4279-d8d7-840f-90b5-2bffe34699ef/075679839237.jpg/1000x1000.jpg", duration: 209, source: "itunes", metadataSource: "itunes", rank: 13, popularity: 94, confidence: 1 },
];

interface HeroCardData {
  id: string;
  eyebrow: string;
  title: string;
  artist: string;
  description: string;
  tone: Tone;
  artworkUrl?: string;
  item?: MediaItem;
}

interface PlaceholderMedia {
  id: string;
  title: string;
  artist: string;
  album?: string;
  tone: Tone;
  initials?: string;
}

const FALLBACK_HEROES: HeroCardData[] = [
  {
    id: "fallback-hero-1",
    eyebrow: "NEW MUSIC",
    title: "Fresh sounds for your next chapter",
    artist: "Apple Music editorial",
    description: "A bright mix of new releases, breakout voices, and songs worth keeping close.",
    tone: "coral",
  },
  {
    id: "fallback-hero-2",
    eyebrow: "LISTEN NOW",
    title: "The weekend starts here",
    artist: "Easygoing favorites",
    description: "Turn the volume up on the songs that make every room feel lighter.",
    tone: "lavender",
  },
  {
    id: "fallback-hero-3",
    eyebrow: "EDITOR'S PICK",
    title: "A little more color",
    artist: "The New in Music",
    description: "Curated discoveries for a beautifully unpredictable day.",
    tone: "mint",
  },
];

const FALLBACK_VIRAL: PlaceholderMedia[] = [
  { id: "fallback-viral-1", title: "Golden Hour", artist: "Kacey Moon", album: "Soft Focus", tone: "coral" },
  { id: "fallback-viral-2", title: "Late Night Talking", artist: "Milo Park", album: "Afterglow", tone: "blue" },
  { id: "fallback-viral-3", title: "Bloom", artist: "Lena Vale", album: "Open Windows", tone: "mint" },
  { id: "fallback-viral-4", title: "Parallel Lines", artist: "The Coast Club", album: "Side A", tone: "lavender" },
  { id: "fallback-viral-5", title: "Sun Comes Up", artist: "Arlo June", album: "Daylight", tone: "sunset" },
  { id: "fallback-viral-6", title: "Blue on Blue", artist: "Nora Wells", album: "Small Hours", tone: "peach" },
];

const FALLBACK_ALBUMS: PlaceholderMedia[] = [
  { id: "fallback-album-1", title: "Soft Focus", artist: "Kacey Moon", tone: "coral", initials: "SF" },
  { id: "fallback-album-2", title: "Afterglow", artist: "Milo Park", tone: "blue", initials: "AG" },
  { id: "fallback-album-3", title: "Open Windows", artist: "Lena Vale", tone: "mint", initials: "OW" },
  { id: "fallback-album-4", title: "Side A", artist: "The Coast Club", tone: "lavender", initials: "SA" },
  { id: "fallback-album-5", title: "Daylight", artist: "Arlo June", tone: "sunset", initials: "D" },
];

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

/** The album an album card points at, resolved from the clicked item. */
interface AlbumSelection {
  title: string;
  artist: string;
  artworkUrl?: string;
  collectionId?: string;
}

/** Read a provider collection id out of the raw metadata attached to an item. */
const readCollectionId = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as { collectionId?: unknown }).collectionId;
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

const getAlbumSelection = (item: MediaItem): AlbumSelection | null => {
  // A release without an album name is treated as a single: the catalog
  // lookup still finds the album that holds the recording.
  const title = (item.album || item.title || "").trim();
  if (!title) return null;

  const collectionId = isSearchResult(item)
    ? readCollectionId(item.originalData)
    : readCollectionId(item.providerMetadata?.raw);

  return {
    title,
    artist: item.artist,
    artworkUrl: getArtworkUrl(item),
    collectionId,
  };
};

/** The user's own tracks that belong to the requested album. */
const getLocalAlbumTracks = (
  selection: AlbumSelection,
  playlist: Track[]
): AlbumTrack[] => {
  const normalizedAlbum = normalizeSearchText(selection.title);
  if (!normalizedAlbum) return [];

  const normalizedArtist = normalizeSearchText(selection.artist);

  return playlist
    .filter((track) => {
      if (normalizeSearchText(track.album) !== normalizedAlbum) return false;
      if (!normalizedArtist) return true;
      const artist = normalizeSearchText(track.artist);
      return !artist || artist === normalizedArtist;
    })
    .map((track) => ({
      id: String(track.id),
      title: track.title,
      artist: track.artist,
      album: track.album ?? selection.title,
      duration: track.duration,
      artworkUrl: track.albumArtUrl,
      source: "local" as const,
    }));
};

/**
 * Album tracks keep the provider metadata that the album page resolved, so a
 * click still travels through the app's strict stream resolution instead of
 * trusting a URL that came back with the album listing.
 */
const albumTrackToSearchResult = (track: AlbumTrack): SearchResult => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  primaryArtist: track.artist,
  album: track.album,
  duration: track.duration,
  source: "itunes",
  metadataSource: "itunes",
  artworkUrl: track.artworkUrl,
  imageUrl: track.artworkUrl,
  previewUrl: track.previewUrl,
  isPreview: Boolean(track.previewUrl),
  explicit: track.explicit,
  isrc: track.isrc,
  rank: track.trackNumber,
  confidence: 1,
  audioCandidates: track.previewUrl
    ? [
        {
          source: "itunes",
          url: track.previewUrl,
          quality: "standard",
          isPreview: true,
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          isrc: track.isrc,
        },
      ]
    : undefined,
});

type IconName =
  | "glass"
  | "music"
  | "search"
  | "home"
  | "sparkles"
  | "radio"
  | "library"
  | "playlist"
  | "heart"
  | "heart-fill"
  | "play"
  | "pause"
  | "previous"
  | "next"
  | "lyrics"
  | "queue"
  | "shuffle"
  | "volume"
  | "volume-low"
  | "sun"
  | "moon"
  | "expand"
  | "chevron-right"
  | "sidebar-collapse"
  | "sidebar-expand"
  | "close"
  | "import"
  | "plus"
  | "more";

interface IconProps {
  name: IconName;
  size?: number;
}

function Icon({ name, size = 18 }: IconProps) {
  let content: ReactNode;

  switch (name) {
    case "glass":
      // Reuse the geometry of /glass-player-logo.svg without its color/glow layers.
      content = <g transform="scale(0.046875)"><path d="M365 119C316 77 250 62 188 80 99 106 45 188 55 279c10 91 83 160 175 166 94 6 176-50 204-137 6-19 8-39 6-59H270" strokeWidth="78" /><path d="M213 178 327 256 213 334Z" fill="currentColor" stroke="none" /></g>;
      break;
    case "music":
      content = <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>;
      break;
    case "search":
      content = (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" strokeWidth="2.4" />
          <circle cx="11" cy="11" r="2.6" fill="currentColor" stroke="none" opacity=".18" />
        </>
      );
      break;
    case "home":
      content = <><path d="m3 10 9-7 9 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.5 20v-6h5v6" /></>;
      break;
    case "sparkles":
      content = <><path d="m12 3-1.15 4.35L7 8.5l3.85 1.15L12 14l1.15-4.35L17 8.5l-3.85-1.15L12 3Z" /><path d="m19 13-.58 2.2L16.25 16l2.17.8L19 19l.58-2.2 2.17-.8-2.17-.8L19 13Z" /><path d="m5 14-.58 2.2-2.17.8 2.17.8L5 20l.58-2.2 2.17-.8-2.17-.8L5 14Z" /></>;
      break;
    case "radio":
      content = <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.25" /><path d="m18.2 5.8-12.4 12.4" /></>;
      break;
    case "library":
      content = <><rect x="4" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="16" rx="1" /><path d="m18 5 2 14" /></>;
      break;
    case "playlist":
      content = <><path d="M4 6h11M4 12h11M4 18h7" /><path d="m18 14 3 2-3 2v-4Z" /></>;
      break;
    case "heart":
      content = <path d="M12 20.4S3.6 15.6 3.6 9.9c0-2.9 2.3-5.1 5.1-5.1 1.4 0 2.6.6 3.3 1.6.7-1 1.9-1.6 3.3-1.6 2.8 0 5.1 2.2 5.1 5.1 0 5.7-8.4 10.5-8.4 10.5Z" />;
      break;
    case "heart-fill":
      content = (
        <>
          <path fill="currentColor" stroke="none" d="M12 20.4S3.6 15.6 3.6 9.9c0-2.9 2.3-5.1 5.1-5.1 1.4 0 2.6.6 3.3 1.6.7-1 1.9-1.6 3.3-1.6 2.8 0 5.1 2.2 5.1 5.1 0 5.7-8.4 10.5-8.4 10.5Z" />
          <path fill="#fff" fillOpacity=".55" stroke="none" d="M8.6 8.2c-.5.3-.9.9-.9 1.6 0 .4.3.7.6.5.9-.6 1.9-1.1 2.9-1.3.4-.1.5-.6.1-.8-.9-.5-1.9-.5-2.7 0Z" />
        </>
      );
      break;
    case "play":
      content = <path fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" d="M9.1 5.9c0-.9 1-1.5 1.8-1L19.2 11c.8.5.8 1.6 0 2.1l-8.3 6.1c-.8.5-1.8-.1-1.8-1V5.9Z" />;
      break;
    case "pause":
      content = (
        <>
          <rect x="7" y="5" width="3.6" height="14" rx="1.8" fill="currentColor" stroke="none" />
          <rect x="13.4" y="5" width="3.6" height="14" rx="1.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "previous":
      content = (
        <>
          <rect x="4.4" y="5" width="3" height="14" rx="1.5" fill="currentColor" stroke="none" />
          <path fill="currentColor" stroke="none" strokeLinejoin="round" d="M19.4 6.7 11.7 11c-.7.4-.7 1.5 0 1.9l7.7 4.4c.8.5 1.9-.1 1.9-1.1V7.8c0-1-1.1-1.6-1.9-1.1Z" />
        </>
      );
      break;
    case "next":
      content = (
        <>
          <rect x="16.6" y="5" width="3" height="14" rx="1.5" fill="currentColor" stroke="none" />
          <path fill="currentColor" stroke="none" strokeLinejoin="round" d="M4.6 6.7l7.7 4.3c.7.4.7 1.5 0 1.9l-7.7 4.4c-.8.5-1.9-.1-1.9-1.1V7.8c0-1 1.1-1.6 1.9-1.1Z" />
        </>
      );
      break;
    case "lyrics":
      content = (
        <>
          <rect x="4.5" y="3.5" width="15" height="17" rx="4.2" />
          <path d="M8.4 9.2h7.2M8.4 12.2h7.2" />
          <path d="M8.4 15.2h3.4" />
          <path fill="currentColor" stroke="none" d="M15.4 14.2c.5 0 .9.7.9 1.2s-.3 1.2-.9 1.2c-.3 0-.6-.2-.8-.4l-.1 1.5-2.5.6.2-1 2.3-.5v-.4c-.3-.2-.5-.6-.5-1 0-.5.4-1.2.9-1.2l.5.8-.5.4.5-.4Z" opacity=".92" />
        </>
      );
      break;
    case "queue":
      content = (
        <>
          <path d="M4 6.6h8.5M4 11h8.5M4 15.4h5" />
          <circle cx="16.6" cy="15.6" r="4.4" fill="currentColor" fillOpacity=".14" />
          <circle cx="16.6" cy="15.6" r="4.4" />
          <path fill="currentColor" stroke="none" d="m15.5 13.6 3.2 2-3.2 2v-4Z" />
        </>
      );
      break;
    case "shuffle":
      content = (
        <>
          <circle cx="4.1" cy="7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4.1" cy="17" r="1.5" fill="currentColor" stroke="none" />
          <path d="M6.4 7h2.2c3.9 0 3.3 8.4 7.9 8.4" />
          <path d="m14.2 13.2 2.4 2.2-2.4 2.2" />
          <path d="M6.4 17h2.2c1.4 0 2-.7 2.9-2l2-2.9c.9-1.3 1.5-2.1 2.9-2.1h1.7" />
          <path d="m14.2 6.4 2.4 2.2-2.4 2.3" />
          <path fill="currentColor" stroke="none" d="M19.6 3.2c.3 0 .6.4.6.8l-.1 1.1 1.1-.1c.4 0 .8.3.8.6s-.4.6-.8.6l-1.1-.1.1 1.1c0 .4-.3.8-.6.8s-.6-.4-.6-.8l.1-1.1-1.1.1c-.4 0-.8-.3-.8-.6s.4-.6.8-.6l1.1.1-.1-1.1c0-.4.2-.8.6-.8Z" opacity=".9" />
        </>
      );
      break;
    case "volume":
      content = (
        <>
          <path fill="currentColor" fillOpacity=".16" strokeWidth="1.9" d="M4.5 9.7c0-.7.6-1.3 1.3-1.3h2.3l4-3.4c.7-.6 1.8-.1 1.8.8v12.4c0 .9-1.1 1.4-1.8.8l-4-3.4H5.8c-.7 0-1.3-.6-1.3-1.3V9.7Z" />
          <path d="M15.4 9.3a4 4 0 0 1 0 5.4M17.9 6.8a7.4 7.4 0 0 1 0 10.4" />
        </>
      );
      break;
    case "volume-low":
      content = (
        <>
          <path fill="currentColor" fillOpacity=".16" strokeWidth="1.9" d="M4.5 9.7c0-.7.6-1.3 1.3-1.3h2.3l4-3.4c.7-.6 1.8-.1 1.8.8v12.4c0 .9-1.1 1.4-1.8.8l-4-3.4H5.8c-.7 0-1.3-.6-1.3-1.3V9.7Z" />
          <path d="M15.4 9.3a4 4 0 0 1 0 5.4" />
        </>
      );
      break;
    case "sun":
      content = <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" /></>;
      break;
    case "moon":
      content = <path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" />;
      break;
    case "expand":
      content = (
        <>
          <path d="M9.2 4.5H6.8a2.6 2.6 0 0 0-2.6 2.6v2.4" />
          <path d="M14.8 4.5h2.4a2.6 2.6 0 0 1 2.6 2.6v2.4" />
          <path d="M19.8 14.5v2.4a2.6 2.6 0 0 1-2.6 2.6h-2.4" />
          <path d="M9.2 19.5H6.8a2.6 2.6 0 0 1-2.6-2.6v-2.4" />
          <path d="m9.7 14.3 4.6-4.6" />
          <path d="M10.2 9.2h4.3v4.3" />
          <path d="M13.8 14.8h-4.3V10.5" opacity=".35" />
        </>
      );
      break;
    case "chevron-right":
      content = <path d="m9 5 7 7-7 7" />;
      break;
    case "sidebar-collapse":
      content = <><path d="M4.5 5v14M20 12H9" /><path d="m13 8-4 4 4 4" /></>;
      break;
    case "sidebar-expand":
      content = <><path d="M19.5 5v14M4 12h11" /><path d="m11 8 4 4-4 4" /></>;
      break;
    case "close":
      content = <path d="m6 6 12 12M18 6 6 18" />;
      break;
    case "import":
      content = <><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></>;
      break;
    case "plus":
      content = <><path d="M12 5v14M5 12h14" /></>;
      break;
    case "more":
      content = <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>;
      break;
    default:
      content = null;
  }

  return (
    <svg
      aria-hidden="true"
      className="apple-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {content}
    </svg>
  );
}

const navItems: Array<{ label: BrowseSection; icon: IconName }> = [
  { label: "Search", icon: "search" },
  { label: "Home", icon: "home" },
  { label: "New", icon: "sparkles" },
  { label: "Radio", icon: "radio" },
];

function BrowseNav({
  activeSection,
  onSelect,
  mobile = false,
  collapsed = false,
}: {
  activeSection: BrowseSection;
  onSelect: (section: BrowseSection) => void;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  return (
    <nav className={mobile ? "apple-mobile-nav" : "apple-primary-nav"} aria-label="Main navigation">
      {navItems.map(({ label, icon }) => (
        <button
          key={label}
          type="button"
          className={`apple-nav-item ${activeSection === label ? "is-active" : ""}`}
          aria-current={activeSection === label ? "page" : undefined}
          aria-label={collapsed && !mobile ? label : undefined}
          title={collapsed && !mobile ? label : undefined}
          onClick={() => onSelect(label)}
        >
          <Icon name={icon} size={mobile ? 20 : 17} />
          <span className="apple-nav-text">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function BrowseShell({
  currentTrack,
  playlist,
  searchQuery,
  searchResults,
  isSearching,
  isPlaying,
  currentTime,
  duration,
  isLiked,
  showLyrics,
  isResolving,
  importSummary,
  importedPlaylistNames = [],
  onSearchQueryChange,
  onSearch,
  onSelectResult,
  onSelectTrack,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onToggleLyrics,
  onOpenImmersive,
  onToggleLike,
  onShuffleSuggestions,
  onImportPlaylist,
  onOpenQueue,
  onNavigate,
  onVolumeChange,
  volume,
}: BrowseShellProps) {
  const [activeSection, setActiveSection] = useState<BrowseSection>("New");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCollectionExpanded, setIsCollectionExpanded] = useState(false);
  const [isDiscoveryVisible, setIsDiscoveryVisible] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume ?? 0.72);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumSelection | null>(null);
  const [albumDetail, setAlbumDetail] = useState<AlbumDetail | null>(null);
  const [albumTracks, setAlbumTracks] = useState<AlbumTrack[]>([]);
  const [albumStatus, setAlbumStatus] = useState<AlbumPageStatus>("loading");
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [seeAll, setSeeAll] = useState<{
    variant: SeeAllVariant;
    title: string;
    note?: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  // The album lookup must not restart every time the queue changes, so the
  // latest queue is read through a ref instead of an effect dependency.
  const playlistRef = useRef(playlist);
  // Where the browse surface was scrolled before a detail view opened.
  const browseScrollRef = useRef(0);
  // Set when a detail view closes and the browse scroll should come back.
  const pendingScrollRestoreRef = useRef(false);

  /** A detail view opens at the top and remembers the browse scroll offset. */
  const rememberBrowseScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    browseScrollRef.current = window.scrollY;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const restoreBrowseScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: browseScrollRef.current, behavior: "auto" });
  }, []);

  const closeAlbum = useCallback((restoreScroll = false) => {
    setSelectedAlbum(null);
    setAlbumDetail(null);
    setAlbumTracks([]);
    setAlbumStatus("loading");
    setAlbumError(null);
    if (restoreScroll) pendingScrollRestoreRef.current = true;
  }, []);

  const closeSeeAll = useCallback((restoreScroll = false) => {
    setSeeAll(null);
    if (restoreScroll) pendingScrollRestoreRef.current = true;
  }, []);

  /** Leave whichever detail view is open and return to the browse surface. */
  const closeDetailViews = () => {
    closeAlbum();
    closeSeeAll();
  };

  useEffect(() => {
    if (volume !== undefined) setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [theme]);

  // Load the album's full track list whenever a different album is opened.
  // The lookup is provider-only: it never decides playback, it only supplies
  // the metadata that the app's normal resolution path then verifies.
  useEffect(() => {
    if (!selectedAlbum) return undefined;

    const controller = new AbortController();
    let cancelled = false;

    void lookupAlbum(
      {
        title: selectedAlbum.title,
        artist: selectedAlbum.artist,
        collectionId: selectedAlbum.collectionId,
      },
      { signal: controller.signal },
    )
      .then((detail) => {
        if (cancelled) return;

        if (detail && detail.tracks.length > 0) {
          setAlbumDetail(detail);
          setAlbumTracks(detail.tracks);
          setAlbumStatus("ready");
          return;
        }

        // The catalog does not know this release. Fall back to the tracks the
        // user's own library already holds for the same album.
        const localTracks = getLocalAlbumTracks(selectedAlbum, playlistRef.current);
        if (localTracks.length > 0) {
          setAlbumDetail((current) => ({
            id: current?.id ?? selectedAlbum.title,
            title: selectedAlbum.title,
            artist: selectedAlbum.artist,
            artworkUrl: current?.artworkUrl ?? selectedAlbum.artworkUrl,
            tracks: localTracks,
          }));
          setAlbumTracks(localTracks);
          setAlbumStatus("ready");
          return;
        }

        setAlbumStatus("error");
        setAlbumError("We couldn't find a track list for this album.");
      })
      .catch(() => {
        if (cancelled) return;
        setAlbumStatus("error");
        setAlbumError("We couldn't load this album right now.");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedAlbum]);

  // Restore the browse scroll only once the browse content is back in the
  // DOM. While the shorter detail page is still mounted the browser clamps
  // the scroll to that page's range, so the offset would be lost.
  useEffect(() => {
    if (selectedAlbum || seeAll) return;
    if (!pendingScrollRestoreRef.current) return;
    pendingScrollRestoreRef.current = false;
    restoreBrowseScroll();
  });

  // Escape returns to the browse surface, matching the immersive player's
  // dismiss behaviour.
  useEffect(() => {
    if ((!selectedAlbum && !seeAll) || typeof window === "undefined") return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAlbum(true);
      closeSeeAll(true);
    };
    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeAlbum, closeSeeAll, seeAll, selectedAlbum]);

  const selectSection = (section: BrowseSection) => {
    setActiveSection(section);
    closeDetailViews();
    onNavigate?.(section);
    if (section === "Search") {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  };

  const selectMedia = (item: MediaItem) => {
    if (isSearchResult(item)) {
      onSelectResult(item);
    } else {
      onSelectTrack(item);
    }
  };

  const openAlbum = (item: MediaItem) => {
    const selection = getAlbumSelection(item);
    if (!selection) return;

    closeSeeAll();
    rememberBrowseScroll();
    setSelectedAlbum(selection);
    setAlbumDetail({
      id: selection.collectionId ? `itunes-collection-${selection.collectionId}` : selection.title,
      title: selection.title,
      artist: selection.artist,
      artworkUrl: selection.artworkUrl,
      tracks: [],
    });
    setAlbumTracks([]);
    setAlbumStatus("loading");
    setAlbumError(null);
  };

  /** Open the full listing behind a shelf's "See All" button. */
  const openSeeAll = (
    variant: SeeAllVariant,
    title: string,
    note?: string
  ) => {
    closeAlbum();
    rememberBrowseScroll();
    setSeeAll({ variant, title, note });
  };

  /** Songs play straight away; albums open the album page. */
  const handleSeeAllSelect = (item: MediaItem) => {
    if (seeAll?.variant === "albums") {
      openAlbum(item);
      return;
    }
    selectMedia(item);
  };

  const handleAlbumTrackSelect = (track: AlbumTrack) => {
    if (track.source === "local") {
      const localTrack = playlist.find((item) => String(item.id) === track.id);
      if (localTrack) {
        onSelectTrack(localTrack);
        return;
      }
    }

    onSelectResult(albumTrackToSearchResult(track));
  };

  const dismissDiscovery = () => {
    setIsDiscoveryVisible(false);
    sidebarRef.current?.querySelector<HTMLButtonElement>(".apple-primary-nav [aria-current='page']")?.focus();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportText(await file.text());
      setImportFileName(file.name);
      setImportError(null);
    } catch {
      setImportError("We couldn't read that file. Try pasting the exported playlist text instead.");
    } finally {
      event.target.value = "";
    }
  };

  const handleImportSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importText.trim()) {
      setImportError("Choose a playlist file or paste playlist JSON, CSV, or M3U text first.");
      return;
    }

    onImportPlaylist?.(importText, importFileName || undefined);
    setIsImportOpen(false);
    setImportText("");
    setImportFileName("");
    setImportError(null);
  };

  const isCuratedSection = !searchQuery.trim() && (activeSection === "Home" || activeSection === "New");

  const heroCards: HeroCardData[] = isCuratedSection
    ? POPULAR_RECOMMENDATIONS.slice(0, 3).map((recommendation, index) => ({
        id: recommendation.id,
        eyebrow: index === 0 ? "TOP POP PICK" : "MADE FOR YOU",
        title: recommendation.title,
        artist: recommendation.artist,
        description: recommendation.album ? `${recommendation.album} · a familiar favorite, ready to rediscover.` : "A familiar favorite, ready to rediscover.",
        tone: (["coral", "lavender", "mint"] as Tone[])[index % 3],
        item: recommendation,
      }))
    : playlist.length
    ? playlist.slice(0, 3).map((track, index) => ({
        id: `playlist-hero-${String(track.id)}`,
        eyebrow: index === 0 ? "YOUR MUSIC" : "UP NEXT",
        title: track.title,
        artist: track.artist,
        description: track.album ? `${track.album} · ready when you are.` : "A favorite from your library.",
        tone: (["coral", "lavender", "mint"] as Tone[])[index % 3],
        artworkUrl: track.albumArtUrl,
        item: track,
      }))
    : searchResults.length
      ? searchResults.slice(0, 3).map((result, index) => ({
          id: `search-hero-${result.id}`,
          eyebrow: index === 0 ? "SEARCHED FOR YOU" : "DISCOVERY",
          title: result.title,
          artist: result.artist,
          description: result.album ? `${result.album} · from your latest search.` : "A fresh result worth a listen.",
          tone: (["coral", "lavender", "mint"] as Tone[])[index % 3],
          artworkUrl: result.artworkUrl || result.imageUrl,
          item: result,
        }))
      : FALLBACK_HEROES;

  const mediaItems: MediaItem[] = isCuratedSection
    ? POPULAR_RECOMMENDATIONS
    : playlist.length
    ? playlist.slice(0, 6)
    : searchResults.slice(0, 6);

  const albumItems: MediaItem[] = isCuratedSection
    ? POPULAR_RECOMMENDATIONS.slice(4, 9)
    : playlist.length
    ? playlist.slice(0, 5)
    : searchResults.slice(0, 5);

  // The complete collection behind each shelf. "See All" shows all of it.
  const allMediaItems: MediaItem[] = isCuratedSection
    ? POPULAR_RECOMMENDATIONS
    : playlist.length
    ? playlist
    : searchResults;

  const allAlbumItems: MediaItem[] = dedupeByAlbum(allMediaItems);

  const viralTitle = isCuratedSection ? "Top Pop Picks" : "Favourite These Viral Hits";
  const viralNote = isCuratedSection
    ? "14 songs you already know by heart"
    : "The songs people are replaying";
  const albumsTitle = isCuratedSection ? "Made for you" : "New This Week";
  const albumsNote = isCuratedSection
    ? "More color for the queue"
    : "Fresh albums and singles";

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    closeDetailViews();
    onSearch(searchQuery);
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const safeCurrentTime = Math.min(Math.max(Number.isFinite(currentTime) ? currentTime : 0, 0), safeDuration);
  const displayVolume = Math.min(Math.max(volume ?? localVolume, 0), 1);

  return (
    <div className={`apple-browse-shell ${theme === "dark" ? "apple-browse-shell--dark" : ""}`} data-theme={theme}>
      <div className={`apple-shell-layout ${isSidebarCollapsed ? "apple-shell-layout--collapsed" : ""}`.trim()}>
        <aside
          ref={sidebarRef}
          className={`apple-sidebar ${isSidebarCollapsed ? "apple-sidebar--collapsed" : ""}`.trim()}
          aria-label="Glass Player sidebar"
        >
          <header className="apple-sidebar-header">
            <div className="apple-brand-lockup" role="img" aria-label="Glass Player">
              <span className="apple-brand-mark"><Icon name="glass" size={24} /></span>
              <span className="apple-brand-name" aria-hidden="true">Glass <small>Player</small></span>
            </div>
            <button
              type="button"
              className="apple-sidebar-icon-button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isSidebarCollapsed}
              aria-controls="apple-sidebar-content"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            >
              <Icon name={isSidebarCollapsed ? "sidebar-expand" : "sidebar-collapse"} size={16} />
            </button>
          </header>

          <div className="apple-sidebar-scroll" id="apple-sidebar-content">
            <BrowseNav activeSection={activeSection} onSelect={selectSection} collapsed={isSidebarCollapsed} />

            <section className="apple-sidebar-collection" aria-label="Collection">
              <button
                type="button"
                className="apple-sidebar-link apple-collection-toggle"
                aria-expanded={!isSidebarCollapsed && isCollectionExpanded}
                aria-controls="apple-collection-links"
                aria-label={isSidebarCollapsed ? "Open collection" : undefined}
                title={isSidebarCollapsed ? "Open collection" : undefined}
                onClick={() => {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                    setIsCollectionExpanded(true);
                  } else {
                    setIsCollectionExpanded((expanded) => !expanded);
                  }
                }}
              >
                <Icon name="library" size={17} />
                <span className="apple-nav-text">Collection</span>
                <span className="apple-collection-chevron"><Icon name="chevron-right" size={12} /></span>
              </button>
              <div className="apple-collection-links" id="apple-collection-links" hidden={isSidebarCollapsed || !isCollectionExpanded}>
                <button type="button" className="apple-sidebar-link"><Icon name="library" size={15} /><span>Recently Added</span></button>
                <button type="button" className="apple-sidebar-link"><Icon name="music" size={15} /><span>Artists</span></button>
                <button type="button" className="apple-sidebar-link"><Icon name="library" size={15} /><span>Albums</span></button>
                <button type="button" className="apple-sidebar-link"><Icon name="playlist" size={15} /><span>Songs</span></button>
              </div>
            </section>

            {!isSidebarCollapsed && (
              <section className="apple-playlist-section" aria-labelledby="apple-playlists-heading">
                <div className="apple-sidebar-label-row">
                  <h2 className="apple-sidebar-label" id="apple-playlists-heading">Playlists</h2>
                  <div className="apple-sidebar-label-actions">
                    <button type="button" className="apple-sidebar-icon-button" aria-label="Import playlist" title="Import playlist" onClick={() => setIsImportOpen(true)}>
                      <Icon name="import" size={14} />
                    </button>
                    <button type="button" className="apple-sidebar-icon-button" aria-label="Create playlist" title="Create playlist">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
                {["Sunday Morning", "Focus Flow", "Favorites Mix", "Late Night"].map((name, index) => (
                  <button key={name} type="button" className="apple-sidebar-link apple-playlist-link">
                    <span className="apple-playlist-art" data-tone={index % 4} aria-hidden="true"><Icon name="playlist" size={13} /></span>
                    <span>{name}</span>
                  </button>
                ))}
                {importedPlaylistNames.map((name, index) => (
                  <button key={name} type="button" className="apple-sidebar-link apple-playlist-link apple-sidebar-link--imported" title={`Open imported playlist ${name}`} onClick={() => onOpenQueue?.()}>
                    <span className="apple-playlist-art" data-tone={(index + 4) % 6} aria-hidden="true"><Icon name="playlist" size={13} /></span>
                    <span>{name}</span>
                  </button>
                ))}
                {importSummary && (
                  <p className={`apple-import-summary ${importSummary.error ? "is-error" : ""}`} role="status">
                    {importSummary.error || `Imported ${importSummary.importedCount} track${importSummary.importedCount === 1 ? "" : "s"} from ${importSummary.playlistName}.`}
                  </p>
                )}
              </section>
            )}

            {!isSidebarCollapsed && isDiscoveryVisible && (
              <section className="apple-sidebar-discovery" aria-labelledby="apple-discovery-heading">
                <button
                  type="button"
                  className="apple-sidebar-icon-button apple-discovery-dismiss"
                  aria-label="Dismiss music discovery"
                  title="Dismiss music discovery"
                  onClick={dismissDiscovery}
                >
                  <Icon name="close" size={13} />
                </button>
                <h2 id="apple-discovery-heading">Find your next favorite</h2>
                <p>Discover artists, albums, and songs you'll love.</p>
                <button type="button" className="apple-discovery-explore" onClick={() => selectSection("Home")}>Explore music</button>
              </section>
            )}
          </div>
        </aside>

        <div className="apple-browse-page">
          <header className="apple-page-header">
            {selectedAlbum || seeAll ? null : (
              <div className="apple-page-heading">
                  <span className="apple-overline">
                    {activeSection === "New" ? "DISCOVER" : activeSection === "Search" ? "FIND MUSIC" : "MUSIC FOR YOU"}
                  </span>
                  <h1>{activeSection === "New" ? "New" : activeSection}</h1>
              <p>Find something beautiful to listen to.</p>
              </div>
            )}

            <div className="apple-header-tools">
              <button
                type="button"
                className={`apple-theme-toggle ${theme === "dark" ? "is-dark" : "is-light"}`}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-pressed={theme === "dark"}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              >
                <span className="apple-theme-track" aria-hidden="true">
                  <span className="apple-theme-thumb">
                    <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
                  </span>
                </span>
                <span className="apple-theme-label">{theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              <form className="apple-search-form" onSubmit={handleSearchSubmit} role="search">
                <span className="apple-search-icon" aria-hidden="true">
                  <Icon name="search" size={18} />
                </span>
                <input
                  type="search"
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  placeholder="Search songs, artists, albums"
                  aria-label="Search songs, artists, albums"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="apple-search-clear"
                    aria-label="Clear search"
                    onClick={() => onSearchQueryChange("")}
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
                <button type="submit" className="apple-search-submit" aria-label="Submit search">
                  <Icon name="search" size={14} />
                  <span>Search</span>
                </button>
              </form>
            </div>
          </header>

          {isImportOpen && (
            <section className="apple-import-panel" aria-labelledby="apple-import-heading">
              <div className="apple-import-panel-heading">
                <div>
                  <span className="apple-overline">LOCAL IMPORT</span>
                  <h2 id="apple-import-heading">Bring in a playlist</h2>
                  <p>Use a Spotify, YouTube Music, Apple Music, iTunes, CSV, JSON, or M3U export. Tracks are matched safely when you play them.</p>
                </div>
                <button type="button" className="apple-icon-button" aria-label="Close playlist import" onClick={() => setIsImportOpen(false)}><Icon name="close" size={18} /></button>
              </div>
              <form className="apple-import-form" onSubmit={handleImportSubmit}>
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={'Paste playlist JSON, CSV, or M3U text here…'}
                  aria-label="Playlist export text"
                  rows={5}
                />
                <div className="apple-import-actions">
                  <input ref={importFileInputRef} type="file" accept=".json,.csv,.m3u,.m3u8,text/csv,application/json,audio/x-mpegurl" onChange={handleImportFile} hidden />
                  <button type="button" className="apple-import-secondary" onClick={() => importFileInputRef.current?.click()}>Choose export file</button>
                  {importFileName && <span className="apple-import-file-name" title={importFileName}>{importFileName}</span>}
                  <span className="apple-import-actions-spacer" />
                  <button type="button" className="apple-import-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
                  <button type="submit" className="apple-import-submit">Import playlist</button>
                </div>
                {importError && <p className="apple-import-error" role="alert">{importError}</p>}
              </form>
            </section>
          )}

          {searchQuery.trim() && (
            <section className="apple-search-panel" aria-live="polite" aria-label="Search results">
              <div className="apple-section-heading apple-section-heading--compact">
                <div>
                  <span className="apple-overline">RESULTS</span>
                  <h2>{isSearching ? "Looking around…" : `For “${searchQuery.trim()}”`}</h2>
                </div>
                {!isSearching && searchResults.length > 0 && <span className="apple-result-count">{searchResults.length} found</span>}
              </div>
              {isSearching ? (
                <div className="apple-search-empty"><span className="apple-loading-dot" />Searching your music</div>
              ) : searchResults.length ? (
                <ul className="apple-search-result-list">
                  {searchResults.slice(0, 7).map((result) => (
                    <li key={result.id}>
                      <button type="button" className="apple-search-result" onClick={() => onSelectResult(result)}>
                        <Artwork src={result.artworkUrl || result.imageUrl} title={result.title} tone="lavender" className="apple-artwork--search" />
                        <span className="apple-search-result-copy"><strong>{result.title}</strong><small>{result.artist}{result.album ? ` · ${result.album}` : ""}</small></span>
                        <span className="apple-search-result-play"><Icon name="play" size={15} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="apple-search-empty apple-search-empty--still"><Icon name="search" size={22} /><span>No matches yet. Try an artist, song, or album.</span></div>
              )}
            </section>
          )}

          {selectedAlbum ? (
            <main className="apple-browse-main">
              <AlbumDetailPage
                album={albumDetail}
                tracks={albumTracks}
                status={albumStatus}
                error={albumError}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onBack={() => closeAlbum(true)}
                onSelectTrack={handleAlbumTrackSelect}
              />
            </main>
          ) : seeAll ? (
            <main className="apple-browse-main">
              <SeeAllPage
                variant={seeAll.variant}
                title={seeAll.title}
                note={seeAll.note}
                items={seeAll.variant === "albums" ? allAlbumItems : allMediaItems}
                onBack={() => closeSeeAll(true)}
                onSelectItem={handleSeeAllSelect}
              />
            </main>
          ) : (
          <main className="apple-browse-main">
            <section className="apple-hero-grid" aria-label="Featured music">
              {heroCards.map((hero, index) => (
                <article key={hero.id} className={`apple-hero-card apple-hero-card--${hero.tone} ${index === 0 ? "apple-hero-card--feature" : ""}`}>
                  <div className="apple-hero-orb" aria-hidden="true" />
                  <Artwork src={hero.artworkUrl} title={hero.title} tone={hero.tone} className="apple-artwork--hero" />
                  <div className="apple-hero-content">
                    <span className="apple-overline">{hero.eyebrow}</span>
                    <h2>{hero.title}</h2>
                    <p>{hero.description}</p>
                    <span className="apple-hero-artist">{hero.artist}</span>
                  </div>
                  <button
                    type="button"
                    className="apple-round-play"
                    aria-label={hero.item ? `Play ${hero.title} by ${hero.artist}` : `${hero.title} preview`}
                    onClick={() => hero.item && selectMedia(hero.item)}
                    disabled={!hero.item}
                  >
                    <Icon name="play" size={17} />
                  </button>
                </article>
              ))}
            </section>

            <section className="apple-content-section" aria-labelledby="viral-heading">
              <div className="apple-section-heading">
                <div>
                  <span className="apple-overline">CURATED FOR YOU</span>
                  <h2 id="viral-heading">{viralTitle}</h2>
                </div>
                <div className="apple-section-heading-actions">
                  <span className="apple-section-note">{viralNote}</span>
                  <button
                    type="button"
                    className="apple-see-all"
                    aria-label={`See all ${viralTitle.toLowerCase()}`}
                    onClick={() => openSeeAll("songs", viralTitle, viralNote)}
                  >
                    See All <Icon name="chevron-right" size={15} />
                  </button>
                </div>
              </div>
              <div className="apple-viral-grid">
                {mediaItems.length ? mediaItems.map((item, index) => (
                  <button key={String(item.id)} type="button" className={`apple-viral-row ${isCuratedSection ? "apple-viral-row--recommendation" : ""}`} onClick={() => selectMedia(item)}>
                    <span className="apple-track-number">{String(index + 1).padStart(2, "0")}</span>
                    <Artwork src={getArtworkUrl(item)} title={item.title} tone={(["coral", "blue", "mint", "lavender", "sunset", "peach"] as Tone[])[index % 6]} className="apple-artwork--row" />
                    <span className="apple-track-copy"><strong>{item.title}</strong><small>{item.artist}</small></span>
                    <span className="apple-track-album">{getAlbumLabel(item)}</span>
                    <span className="apple-track-action"><Icon name="play" size={14} /></span>
                  </button>
                )) : FALLBACK_VIRAL.map((item, index) => (
                  <div key={item.id} className="apple-viral-row apple-viral-row--placeholder" aria-label={`${item.title} by ${item.artist}`}>
                    <span className="apple-track-number">{String(index + 1).padStart(2, "0")}</span>
                    <Artwork title={item.title} tone={item.tone} initials={item.initials} className="apple-artwork--row" />
                    <span className="apple-track-copy"><strong>{item.title}</strong><small>{item.artist}</small></span>
                    <span className="apple-track-album">{item.album}</span>
                    <span className="apple-track-action apple-track-action--muted"><Icon name="more" size={16} /></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="apple-content-section" aria-labelledby="week-heading">
              <div className="apple-section-heading">
                <div>
                  <span className="apple-overline">JUST DROPPED</span>
                  <h2 id="week-heading">{albumsTitle}</h2>
                </div>
                <div className="apple-section-heading-actions">
                  <span className="apple-section-note">{albumsNote}</span>
                  <button
                    type="button"
                    className="apple-see-all"
                    aria-label={`See all ${albumsTitle.toLowerCase()}`}
                    onClick={() => openSeeAll("albums", albumsTitle, albumsNote)}
                  >
                    See All <Icon name="chevron-right" size={15} />
                  </button>
                </div>
              </div>
              <div className="apple-album-grid">
                {albumItems.length ? albumItems.map((item, index) => (
                  <button key={`album-${String(item.id)}`} type="button" className="apple-album-card" onClick={() => openAlbum(item)}>
                    <Artwork src={getArtworkUrl(item)} title={item.album || item.title} tone={(["coral", "blue", "mint", "lavender", "sunset"] as Tone[])[index % 5]} className="apple-artwork--album" />
                    <span className="apple-album-copy"><strong>{item.album || item.title}</strong><small>{item.artist}</small></span>
                  </button>
                )) : FALLBACK_ALBUMS.map((item) => (
                  <div key={item.id} className="apple-album-card apple-album-card--placeholder">
                    <Artwork title={item.title} tone={item.tone} initials={item.initials} className="apple-artwork--album" />
                    <span className="apple-album-copy"><strong>{item.title}</strong><small>{item.artist}</small></span>
                  </div>
                ))}
              </div>
            </section>
          </main>
          )}
        </div>
      </div>

      <BrowseNav activeSection={activeSection} onSelect={selectSection} mobile />

      <section className="apple-player" aria-label="Now playing">
        <div className="apple-player-layout">
          <div className="apple-player-track">
            <Artwork
              src={currentTrack?.albumArtUrl}
              title={currentTrack?.title || "Nothing playing"}
              tone="coral"
              className="apple-artwork--player"
            />
            <div className="apple-player-track-copy">
              <strong title={currentTrack?.title}>{currentTrack?.title || "Nothing playing"}</strong>
              <span title={currentTrack?.artist}>{currentTrack?.artist || "Pick a song to begin"}</span>
            </div>
            <button type="button" className={`apple-icon-button apple-like-button ${isLiked ? "is-liked" : ""}`} aria-label={isLiked ? "Remove from favorites" : "Add to favorites"} aria-pressed={isLiked} onClick={onToggleLike}>
              <Icon name={isLiked ? "heart-fill" : "heart"} size={18} />
            </button>
          </div>

          <div className="apple-player-controls">
            <button type="button" className="apple-icon-button apple-skip-button" aria-label="Previous track" onClick={onPrev}><Icon name="previous" size={19} /></button>
            <button type="button" className="apple-play-toggle" aria-label={isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={onPlayPause}><Icon name={isPlaying ? "pause" : "play"} size={18} /></button>
            <button type="button" className="apple-icon-button apple-skip-button" aria-label="Next track" onClick={onNext}><Icon name="next" size={19} /></button>
          </div>

          <div className="apple-player-actions">
            <button
              type="button"
              className="apple-icon-button apple-shuffle-button"
              aria-label="Shuffle suggestions"
              aria-busy={isResolving}
              title="Shuffle suggestions"
              disabled={!currentTrack}
              onClick={onShuffleSuggestions}
            >
              <Icon name="shuffle" size={19} />
            </button>
            <button type="button" className={`apple-icon-button ${showLyrics ? "is-active" : ""}`} aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"} aria-pressed={showLyrics} onClick={onToggleLyrics}><Icon name="lyrics" size={19} /></button>
            <button type="button" className="apple-icon-button" aria-label="Open queue" onClick={() => onOpenQueue?.()}><Icon name="queue" size={19} /></button>
            <div className="apple-volume-control">
              <button type="button" className={`apple-icon-button ${isVolumeOpen ? "is-active" : ""}`} aria-label="Adjust volume" aria-expanded={isVolumeOpen} onClick={() => setIsVolumeOpen((open) => !open)}><Icon name={displayVolume === 0 ? "volume-low" : "volume"} size={19} /></button>
              {isVolumeOpen && (
                <div className="apple-volume-popover">
                  <label htmlFor="apple-volume-range">Volume</label>
                  <input
                    id="apple-volume-range"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={displayVolume}
                    aria-label="Volume"
                    onChange={(event) => {
                      const nextVolume = Number(event.target.value);
                      setLocalVolume(nextVolume);
                      onVolumeChange?.(nextVolume);
                    }}
                  />
                </div>
              )}
            </div>
            <button type="button" className="apple-icon-button" aria-label="Open immersive player" onClick={onOpenImmersive}><Icon name="expand" size={19} /></button>
          </div>
        </div>
        <div className="apple-player-progress">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={safeDuration}
            step="0.1"
            value={safeCurrentTime}
            onChange={(event) => onSeek(Number(event.target.value))}
            aria-label="Track progress"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          />
          <span>{formatTime(duration)}</span>
        </div>
      </section>
    </div>
  );
}

export default BrowseShell;
