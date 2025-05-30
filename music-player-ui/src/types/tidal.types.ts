/**
 * Tidal API Types
 *
 * This file contains TypeScript interfaces for the Tidal API responses
 */

// Tidal API Base URL
export const TIDAL_API_BASE_URL = "https://tidal.401658.xyz";

// Tidal Quality Options
export type TidalQuality =
  | "LOW"
  | "HIGH"
  | "LOSSLESS"
  | "HI_RES"
  | "HI_RES_LOSSLESS";

// Tidal Search Response
export interface TidalSearchResponse {
  limit: number;
  offset: number;
  totalNumberOfItems: number;
  items: TidalTrack[];
}

// Tidal Track Interface (flexible to handle different response structures)
export interface TidalTrack {
  id: number;
  title: string;
  duration?: number;
  replayGain?: number;
  peak?: number;
  allowStreaming?: boolean;
  streamReady?: boolean;
  streamStartDate?: string;
  premiumStreamingOnly?: boolean;
  trackNumber?: number;
  volumeNumber?: number;
  version?: string;
  popularity?: number;
  copyright?: string;
  url?: string;
  isrc?: string;
  editable?: boolean;
  explicit?: boolean;
  audioQuality?: string;
  audioModes?: string[];
  artist?: TidalArtist;
  artists?: TidalArtist[];
  album?: TidalAlbum;
  mixes?: {
    TRACK_MIX?: string;
  };
}

// Tidal Artist Interface
export interface TidalArtist {
  id?: number;
  name: string;
  type?: string;
  picture?: string;
}

// Tidal Album Interface
export interface TidalAlbum {
  id?: number;
  title: string;
  cover?: string;
  videoCover?: string;
  releaseDate?: string;
  vibrantColor?: string;
}

// Tidal Song Response (from /song endpoint)
export interface TidalSongResponse {
  OriginalTrackUrl: string;
  "Song Info": TidalTrack;
  "Track Info": TidalTrackInfo;
}

// Tidal Track Response (from /track endpoint) - now includes OriginalTrackUrl merged from array
export interface TidalTrackResponse extends TidalTrack {
  OriginalTrackUrl: string;
}

// Tidal Track Info (streaming details)
export interface TidalTrackInfo {
  albumPeakAmplitude: number;
  albumReplayGain: number;
  assetPresentation: string;
  audioMode: string;
  audioQuality: string;
  bitDepth?: number;
  manifest: string;
  manifestMimeType: string;
  sampleRate?: number;
  trackId: number;
  trackPeakAmplitude: number;
  trackReplayGain: number;
}

// Tidal Cover Response
export interface TidalCoverResponse {
  "1280": string;
  "640": string;
  "80": string;
  id: number;
  name: string;
}

// Tidal Lyrics Response
export interface TidalLyricsResponse {
  isRightToLeft: boolean;
  lyrics: string;
  lyricsProvider: string;
  providerCommontrackId: string;
  providerLyricsId: string;
  subtitles: string;
  trackId: number;
}

// Tidal Album Response
export interface TidalAlbumResponse {
  adSupportedStreamReady: boolean;
  allowStreaming: boolean;
  artist: TidalArtist;
  artists: TidalArtist[];
  audioModes: string[];
  audioQuality: string;
  copyright: string;
  cover: string;
  djReady: boolean;
  duration: number;
  explicit: boolean;
  id: number;
  mediaMetadata?: {
    tags: string[];
  };
  numberOfTracks: number;
  numberOfVideos: number;
  numberOfVolumes: number;
  popularity: number;
  premiumStreamingOnly: boolean;
  releaseDate: string;
  stemReady: boolean;
  streamReady: boolean;
  streamStartDate: string;
  title: string;
  type: string;
  upc: string;
  url: string;
  version?: string;
  vibrantColor?: string;
  videoCover?: string;
}

// Tidal Playlist Response
export interface TidalPlaylistResponse {
  created: string;
  creator: TidalArtist;
  description: string;
  duration: number;
  image: string;
  lastItemAddedAt?: string;
  lastUpdated: string;
  numberOfTracks: number;
  numberOfVideos: number;
  popularity: number;
  promotedArtists: TidalArtist[];
  publicPlaylist: boolean;
  squareImage: string;
  title: string;
  type: string;
  url: string;
  uuid: string;
}

// Convert TidalTrack to our app's Track interface
export interface Track {
  id: number | string;
  title: string;
  artist: string;
  audioSrc: string;
  albumArtUrl?: string;
  lrcUrl?: string;
  duration?: number;
  album?: string;
  year?: string;
  source?: "local" | "jiosaavn" | "tidal";
  qualityUrls?: Record<string, string>;
}

// Utility function to convert Tidal track to app Track
export const convertTidalTrackToTrack = (
  tidalTrack: TidalTrack,
  audioSrc: string
): Track => {
  try {
    console.log("Converting track with structure:", tidalTrack);

    // Handle different artist structures
    let artistName = "Unknown Artist";
    if (tidalTrack.artist && tidalTrack.artist.name) {
      artistName = tidalTrack.artist.name;
    } else if (tidalTrack.artists && tidalTrack.artists.length > 0) {
      artistName = tidalTrack.artists[0].name;
    }

    // Handle album cover
    let albumArtUrl = "";
    if (tidalTrack.album && tidalTrack.album.cover) {
      try {
        albumArtUrl = `https://resources.tidal.com/images/${tidalTrack.album.cover.replace(
          /-/g,
          "/"
        )}/640x640.jpg`;
      } catch (coverError) {
        console.warn("Error processing album cover:", coverError);
        albumArtUrl = "";
      }
    }

    const track: Track = {
      id: tidalTrack.id || "unknown",
      title: tidalTrack.title || "Unknown Title",
      artist: artistName,
      audioSrc: audioSrc,
      albumArtUrl: albumArtUrl,
      duration: tidalTrack.duration || 0,
      album: tidalTrack.album?.title || "Unknown Album",
      year: tidalTrack.album?.releaseDate?.split("-")[0],
      source: "tidal",
    };

    console.log("Converted track result:", track);
    return track;
  } catch (error) {
    console.error("Error in convertTidalTrackToTrack:", error);
    console.error("Input tidalTrack:", tidalTrack);
    console.error("Input audioSrc:", audioSrc);
    throw error;
  }
};

// Utility function to get Tidal cover URL
export const getTidalCoverUrl = (
  coverId: string,
  size: "80" | "640" | "1280" = "640"
): string => {
  const formattedId = coverId.replace(/-/g, "/");
  return `https://resources.tidal.com/images/${formattedId}/${size}x${size}.jpg`;
};

// Quality mapping for Tidal
export const TIDAL_QUALITY_MAP: Record<string, TidalQuality> = {
  "96kbps": "LOW",
  "160kbps": "HIGH",
  "320kbps": "HIGH",
  LOSSLESS: "LOSSLESS",
  HI_RES: "HI_RES",
  HI_RES_LOSSLESS: "HI_RES_LOSSLESS",
};

// Reverse mapping for display
export const TIDAL_QUALITY_DISPLAY: Record<TidalQuality, string> = {
  LOW: "96kbps",
  HIGH: "320kbps",
  LOSSLESS: "FLAC",
  HI_RES: "Hi-Res FLAC",
  HI_RES_LOSSLESS: "Hi-Res Lossless",
};
