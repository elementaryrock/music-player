import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Track } from "../../types/api.types";
import type { SearchResult } from "../../services/searchEngine";
import "./BrowseShell.css";

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
  onOpenQueue?: () => void;
  onNavigate?: (section: BrowseSection) => void;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
  profileName?: string;
}

type Tone = "coral" | "lavender" | "mint" | "blue" | "sunset" | "peach";
type ThemeMode = "light" | "dark";
type MediaItem = Track | SearchResult;

const THEME_STORAGE_KEY = "glass-player-theme";

/**
 * Curated metadata keeps the initial browse surface useful without pretending
 * that a recommendation already has a playable URL. Every click still enters
 * the same strict provider-resolution path as a normal search result.
 */
const POPULAR_RECOMMENDATIONS: SearchResult[] = [
  { id: "recommendation-blinding-lights", title: "Blinding Lights", artist: "The Weeknd", primaryArtist: "The Weeknd", album: "After Hours", source: "itunes", metadataSource: "itunes", rank: 0, popularity: 99, confidence: 1 },
  { id: "recommendation-as-it-was", title: "As It Was", artist: "Harry Styles", primaryArtist: "Harry Styles", album: "Harry's House", source: "itunes", metadataSource: "itunes", rank: 1, popularity: 97, confidence: 1 },
  { id: "recommendation-flowers", title: "Flowers", artist: "Miley Cyrus", primaryArtist: "Miley Cyrus", album: "Endless Summer Vacation", source: "itunes", metadataSource: "itunes", rank: 2, popularity: 96, confidence: 1 },
  { id: "recommendation-levitating", title: "Levitating", artist: "Dua Lipa", primaryArtist: "Dua Lipa", album: "Future Nostalgia", source: "itunes", metadataSource: "itunes", rank: 3, popularity: 96, confidence: 1 },
  { id: "recommendation-shape-of-you", title: "Shape of You", artist: "Ed Sheeran", primaryArtist: "Ed Sheeran", album: "÷ (Divide)", source: "itunes", metadataSource: "itunes", rank: 4, popularity: 98, confidence: 1 },
  { id: "recommendation-anti-hero", title: "Anti-Hero", artist: "Taylor Swift", primaryArtist: "Taylor Swift", album: "Midnights", source: "itunes", metadataSource: "itunes", rank: 5, popularity: 96, confidence: 1 },
  { id: "recommendation-cruel-summer", title: "Cruel Summer", artist: "Taylor Swift", primaryArtist: "Taylor Swift", album: "Lover", source: "itunes", metadataSource: "itunes", rank: 6, popularity: 97, confidence: 1 },
  { id: "recommendation-espresso", title: "Espresso", artist: "Sabrina Carpenter", primaryArtist: "Sabrina Carpenter", album: "Short n' Sweet", source: "itunes", metadataSource: "itunes", rank: 7, popularity: 95, confidence: 1 },
  { id: "recommendation-stay", title: "Stay", artist: "The Kid LAROI & Justin Bieber", primaryArtist: "The Kid LAROI", album: "F*CK LOVE 3: OVER YOU", source: "itunes", metadataSource: "itunes", rank: 8, popularity: 94, confidence: 1 },
  { id: "recommendation-watermelon-sugar", title: "Watermelon Sugar", artist: "Harry Styles", primaryArtist: "Harry Styles", album: "Fine Line", source: "itunes", metadataSource: "itunes", rank: 9, popularity: 94, confidence: 1 },
  { id: "recommendation-bad-guy", title: "Bad Guy", artist: "Billie Eilish", primaryArtist: "Billie Eilish", album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?", source: "itunes", metadataSource: "itunes", rank: 10, popularity: 97, confidence: 1 },
  { id: "recommendation-uptown-funk", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", primaryArtist: "Mark Ronson", album: "Uptown Special", source: "itunes", metadataSource: "itunes", rank: 11, popularity: 96, confidence: 1 },
  { id: "recommendation-cheap-thrills", title: "Cheap Thrills", artist: "Sia", primaryArtist: "Sia", album: "This Is Acting", source: "itunes", metadataSource: "itunes", rank: 12, popularity: 93, confidence: 1 },
  { id: "recommendation-dance-monkey", title: "Dance Monkey", artist: "Tones and I", primaryArtist: "Tones and I", album: "The Kids Are Coming", source: "itunes", metadataSource: "itunes", rank: 13, popularity: 94, confidence: 1 },
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

const getInitials = (value: string, fallback = "♪") => {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || fallback;
};

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
};

const isSearchResult = (item: MediaItem): item is SearchResult => "confidence" in item;

const getArtworkUrl = (item: MediaItem) => {
  if (isSearchResult(item)) return item.artworkUrl || item.imageUrl;
  return item.albumArtUrl;
};

const getAlbumLabel = (item: MediaItem) => item.album || "Single";

interface ArtworkProps {
  src?: string;
  title: string;
  tone?: Tone;
  className?: string;
  initials?: string;
}

function Artwork({ src, title, tone = "lavender", className = "", initials }: ArtworkProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(src));

  useEffect(() => {
    setImageAvailable(Boolean(src));
  }, [src]);

  return (
    <div className={`apple-artwork apple-artwork--${tone} ${className}`.trim()}>
      {src && imageAvailable ? (
        <img
          src={src}
          alt={`${title} artwork`}
          loading="lazy"
          onError={() => setImageAvailable(false)}
        />
      ) : (
        <span aria-hidden="true">{initials || getInitials(title)}</span>
      )}
    </div>
  );
}

type IconName =
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
  | "volume"
  | "volume-low"
  | "sun"
  | "moon"
  | "expand"
  | "chevron-right"
  | "plus"
  | "more";

interface IconProps {
  name: IconName;
  size?: number;
}

function Icon({ name, size = 18 }: IconProps) {
  let content: ReactNode;

  switch (name) {
    case "music":
      content = <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>;
      break;
    case "search":
      content = <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>;
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
      content = <path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />;
      break;
    case "heart-fill":
      content = <path fill="currentColor" stroke="none" d="M12 20.2S3.2 15.4 3.2 10.2A4.7 4.7 0 0 1 12 7.6a4.7 4.7 0 0 1 8.8 2.6c0 5.2-8.8 10-8.8 10Z" />;
      break;
    case "play":
      content = <path fill="currentColor" stroke="none" d="m8 5 11 7-11 7V5Z" />;
      break;
    case "pause":
      content = <><path fill="currentColor" stroke="none" d="M7 5h3v14H7z" /><path fill="currentColor" stroke="none" d="M14 5h3v14h-3z" /></>;
      break;
    case "previous":
      content = <><path d="M6 5v14" /><path fill="currentColor" stroke="none" d="m18 6-9 6 9 6V6Z" /></>;
      break;
    case "next":
      content = <><path d="M18 5v14" /><path fill="currentColor" stroke="none" d="m6 6 9 6-9 6V6Z" /></>;
      break;
    case "lyrics":
      content = <><path d="M5 5.5h14v13H5z" /><path d="M8 9h8M8 12h6M8 15h4" /></>;
      break;
    case "queue":
      content = <><path d="M4 6h10M4 11h10M4 16h6" /><path d="m17 14 4 2.5-4 2.5v-5Z" /></>;
      break;
    case "volume":
      content = <><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" /></>;
      break;
    case "volume-low":
      content = <><path d="M4 10v4h3l4 3V7l-4 3H4Z" /><path d="M15 9.5a3.5 3.5 0 0 1 0 5" /></>;
      break;
    case "sun":
      content = <><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4" /></>;
      break;
    case "moon":
      content = <path d="M20.3 15.2A8.5 8.5 0 0 1 8.8 3.7 8.5 8.5 0 1 0 20.3 15.2Z" />;
      break;
    case "expand":
      content = <><path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" /><path d="m4 4 5 5M20 4l-5 5M20 20l-5-5M4 20l5-5" /></>;
      break;
    case "chevron-right":
      content = <path d="m9 5 7 7-7 7" />;
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
      strokeWidth="1.8"
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
}: {
  activeSection: BrowseSection;
  onSelect: (section: BrowseSection) => void;
  mobile?: boolean;
}) {
  return (
    <nav className={mobile ? "apple-mobile-nav" : "apple-primary-nav"} aria-label="Main navigation">
      {navItems.map(({ label, icon }) => (
        <button
          key={label}
          type="button"
          className={`apple-nav-item ${activeSection === label ? "is-active" : ""}`}
          aria-current={activeSection === label ? "page" : undefined}
          onClick={() => onSelect(label)}
        >
          <Icon name={icon} size={mobile ? 20 : 18} />
          <span>{label}</span>
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
  onOpenQueue,
  onNavigate,
  onVolumeChange,
  volume,
  profileName = "Alex Morgan",
}: BrowseShellProps) {
  const [activeSection, setActiveSection] = useState<BrowseSection>("New");
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (volume !== undefined) setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [theme]);

  const selectSection = (section: BrowseSection) => {
    setActiveSection(section);
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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(searchQuery);
  };

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1;
  const safeCurrentTime = Math.min(Math.max(Number.isFinite(currentTime) ? currentTime : 0, 0), safeDuration);
  const displayVolume = Math.min(Math.max(volume ?? localVolume, 0), 1);

  return (
    <div className={`apple-browse-shell ${theme === "dark" ? "apple-browse-shell--dark" : ""}`} data-theme={theme}>
      <div className="apple-shell-layout">
        <aside className="apple-sidebar" aria-label="Glass Player sidebar">
          <div className="apple-brand-lockup">
            <span className="apple-brand-mark">
              <img src="/glass-player-logo.svg" alt="" aria-hidden="true" />
            </span>
            <span className="apple-brand-name">
              <strong>Glass</strong>
              <small>Player</small>
            </span>
          </div>

          <BrowseNav activeSection={activeSection} onSelect={selectSection} />

          <div className="apple-sidebar-section">
            <p className="apple-sidebar-label">Library</p>
            <button type="button" className="apple-sidebar-link"><Icon name="library" size={17} /><span>Recently Added</span></button>
            <button type="button" className="apple-sidebar-link"><Icon name="music" size={17} /><span>Artists</span></button>
            <button type="button" className="apple-sidebar-link"><Icon name="library" size={17} /><span>Albums</span></button>
            <button type="button" className="apple-sidebar-link"><Icon name="playlist" size={17} /><span>Songs</span></button>
          </div>

          <div className="apple-sidebar-section apple-playlist-section">
            <div className="apple-sidebar-label-row">
              <p className="apple-sidebar-label">Playlists</p>
              <button type="button" className="apple-icon-button apple-icon-button--tiny" aria-label="Create playlist" title="Create playlist">
                <Icon name="plus" size={14} />
              </button>
            </div>
            <button type="button" className="apple-sidebar-link"><span className="playlist-dot playlist-dot--sunset" /><span>Sunday Morning</span></button>
            <button type="button" className="apple-sidebar-link"><span className="playlist-dot playlist-dot--blue" /><span>Focus Flow</span></button>
            <button type="button" className="apple-sidebar-link"><span className="playlist-dot playlist-dot--mint" /><span>Favorites Mix</span></button>
            <button type="button" className="apple-sidebar-link"><span className="playlist-dot playlist-dot--lavender" /><span>Late Night</span></button>
          </div>

          <div className="apple-profile-card">
            <span className="apple-profile-avatar" aria-hidden="true">{getInitials(profileName, "AM")}</span>
            <span className="apple-profile-copy"><strong>{profileName}</strong><small>Personal account</small></span>
            <button type="button" className="apple-icon-button apple-icon-button--tiny" aria-label="Open account menu" title="Account menu">
              <Icon name="more" size={16} />
            </button>
          </div>
        </aside>

        <div className="apple-browse-page">
          <header className="apple-page-header">
            <div className="apple-page-heading">
                  <span className="apple-overline">
                    {activeSection === "New" ? "DISCOVER" : activeSection === "Search" ? "FIND MUSIC" : "MUSIC FOR YOU"}
                  </span>
                  <h1>{activeSection === "New" ? "New" : activeSection}</h1>
              <p>Find something beautiful to listen to.</p>
            </div>

            <div className="apple-header-tools">
              <button
                type="button"
                className="apple-theme-toggle"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                aria-pressed={theme === "dark"}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
                <span>{theme === "dark" ? "Light" : "Dark"}</span>
              </button>
              <form className="apple-search-form" onSubmit={handleSearchSubmit} role="search">
                <Icon name="search" size={18} />
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
                    ×
                  </button>
                )}
                <button type="submit" className="apple-search-submit" aria-label="Submit search">
                  <span>Search</span>
                </button>
              </form>
            </div>
          </header>

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
                  <h2 id="viral-heading">{isCuratedSection ? "Top Pop Picks" : "Favourite These Viral Hits"}</h2>
                </div>
                <div className="apple-section-heading-actions">
                  <span className="apple-section-note">{isCuratedSection ? "14 songs you already know by heart" : "The songs people are replaying"}</span>
                  <button type="button" className="apple-see-all">See All <Icon name="chevron-right" size={15} /></button>
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
                  <h2 id="week-heading">{isCuratedSection ? "Made for you" : "New This Week"}</h2>
                </div>
                <div className="apple-section-heading-actions">
                  <span className="apple-section-note">{isCuratedSection ? "More color for the queue" : "Fresh albums and singles"}</span>
                  <button type="button" className="apple-see-all">See All <Icon name="chevron-right" size={15} /></button>
                </div>
              </div>
              <div className="apple-album-grid">
                {albumItems.length ? albumItems.map((item, index) => (
                  <button key={`album-${String(item.id)}`} type="button" className="apple-album-card" onClick={() => selectMedia(item)}>
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
            <button type="button" className="apple-icon-button" aria-label="Previous track" onClick={onPrev}><Icon name="previous" size={18} /></button>
            <button type="button" className="apple-play-toggle" aria-label={isPlaying ? "Pause" : "Play"} aria-pressed={isPlaying} onClick={onPlayPause}><Icon name={isPlaying ? "pause" : "play"} size={17} /></button>
            <button type="button" className="apple-icon-button" aria-label="Next track" onClick={onNext}><Icon name="next" size={18} /></button>
          </div>

          <div className="apple-player-actions">
            <button type="button" className={`apple-icon-button ${showLyrics ? "is-active" : ""}`} aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"} aria-pressed={showLyrics} onClick={onToggleLyrics}><Icon name="lyrics" size={18} /></button>
            <button type="button" className="apple-icon-button" aria-label="Open queue" onClick={() => onOpenQueue?.()}><Icon name="queue" size={18} /></button>
            <div className="apple-volume-control">
              <button type="button" className={`apple-icon-button ${isVolumeOpen ? "is-active" : ""}`} aria-label="Adjust volume" aria-expanded={isVolumeOpen} onClick={() => setIsVolumeOpen((open) => !open)}><Icon name={displayVolume === 0 ? "volume-low" : "volume"} size={18} /></button>
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
            <button type="button" className="apple-icon-button" aria-label="Open immersive player" onClick={onOpenImmersive}><Icon name="expand" size={18} /></button>
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
