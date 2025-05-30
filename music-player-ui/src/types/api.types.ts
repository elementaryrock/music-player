/**
 * JioSaavn API Types
 *
 * This file contains TypeScript interfaces for the JioSaavn API responses
 */

// Import the LRC generator
import { generateLrcUrl } from "../utils/lrcGenerator";

// Song interface
export interface SaavnSong {
  id: string;
  name: string;
  type: string;
  album: {
    id: string;
    name: string;
    url: string;
  };
  year: string;
  releaseDate: string;
  duration: string;
  label: string;
  primaryArtists: string;
  primaryArtistsId: string;
  featuredArtists: string;
  featuredArtistsId: string;
  explicitContent: number;
  playCount: string;
  language: string;
  hasLyrics: string;
  url: string;
  copyright: string;
  image: {
    quality: string;
    link: string;
  }[];
  downloadUrl: {
    quality: string;
    link: string;
  }[];
}

// Album interface
export interface SaavnAlbum {
  id: string;
  name: string;
  type: string;
  year: string;
  releaseDate: string;
  playCount: string;
  language: string;
  explicitContent: string;
  songCount: string;
  url: string;
  primaryArtistsId: string;
  primaryArtists: string;
  featuredArtists: string;
  artists: string[];
  image: {
    quality: string;
    link: string;
  }[];
  songs?: SaavnSong[];
}

// Artist interface
export interface SaavnArtist {
  id: string;
  name: string;
  url: string;
  image: {
    quality: string;
    link: string;
  }[];
  followerCount: string;
  fanCount: string;
  isVerified: boolean;
  dominantLanguage: string;
  dominantType: string;
  bio: string;
  dob: string;
  fb: string;
  twitter: string;
  wiki: string;
  availableLanguages: string[];
  isRadioPresent: boolean;
}

// Playlist interface
export interface SaavnPlaylist {
  id: string;
  name: string;
  followerCount: string;
  songCount: string;
  fanCount: string;
  username: string;
  firstname: string;
  lastname: string;
  shares: string;
  image: {
    quality: string;
    link: string;
  }[];
  url: string;
  songs?: SaavnSong[];
}

// Search results interface
export interface SaavnSearchResults {
  songs?: {
    results: SaavnSong[];
    total: number;
    start: number;
    count: number;
  };
  albums?: {
    results: SaavnAlbum[];
    total: number;
    start: number;
    count: number;
  };
  artists?: {
    results: SaavnArtist[];
    total: number;
    start: number;
    count: number;
  };
  playlists?: {
    results: SaavnPlaylist[];
    total: number;
    start: number;
    count: number;
  };
}

// Convert SaavnSong to our app's Track interface
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
  qualityUrls?: Record<string, string>; // Map of quality->URL from API
}

// Helper function to convert SaavnSong to Track
export const convertSaavnSongToTrack = (song: SaavnSong): Track => {
  const duration = parseInt(song.duration);

  // Generate an LRC URL for the song
  const lrcUrl = generateLrcUrl(
    song.name,
    song.primaryArtists,
    song.album.name,
    duration
  );

  return {
    id: song.id,
    title: song.name,
    artist: song.primaryArtists,
    audioSrc: song.downloadUrl[song.downloadUrl.length - 1]?.link || "", // Get highest quality
    albumArtUrl: song.image[song.image.length - 1]?.link || "", // Get highest quality
    lrcUrl,
    duration,
    album: song.album.name,
    year: song.year,
    source: "jiosaavn",
  };
};
