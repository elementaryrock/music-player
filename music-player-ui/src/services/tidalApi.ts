/**
 * Tidal API Service
 *
 * This file contains functions to interact with the Tidal API
 */

import {
  TIDAL_API_BASE_URL,
  TidalQuality,
  TidalSearchResponse,
  TidalTrack,
  TidalSongResponse,
  TidalTrackResponse,
  TidalCoverResponse,
  TidalLyricsResponse,
  TidalAlbumResponse,
  TidalPlaylistResponse,
  convertTidalTrackToTrack,
  Track,
} from "../types/tidal.types";

// Fallback endpoints in case the main one fails (using Vite proxy)
const TIDAL_FALLBACK_ENDPOINTS = ["/api/tidal", "/api/tidal-backup"];

let currentEndpointIndex = 0;
let currentApiBaseUrl = TIDAL_FALLBACK_ENDPOINTS[currentEndpointIndex];

/**
 * Switch to the next available Tidal API endpoint
 */
const switchToNextTidalEndpoint = () => {
  currentEndpointIndex =
    (currentEndpointIndex + 1) % TIDAL_FALLBACK_ENDPOINTS.length;
  currentApiBaseUrl = TIDAL_FALLBACK_ENDPOINTS[currentEndpointIndex];
  console.log(`Switched to Tidal API endpoint: ${currentApiBaseUrl}`);
};

/**
 * Search for songs on Tidal
 * @param query Search query
 * @param limit Number of results to return (default: 10)
 * @param offset Offset for pagination (default: 0)
 * @returns Promise with search results
 */
export const searchTidalSongs = async (
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<TidalSearchResponse | null> => {
  let attemptsLeft = TIDAL_FALLBACK_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(`Searching Tidal for: ${query} using ${currentApiBaseUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${currentApiBaseUrl}/search/?s=${encodeURIComponent(
          query
        )}&limit=${limit}&offset=${offset}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Tidal API error: ${response.status} from ${currentApiBaseUrl}`
        );
        throw new Error(`Tidal API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `Tidal search results received from ${currentApiBaseUrl}:`,
        data
      );

      return data;
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
        console.error(
          `Tidal API request timed out for query: ${query} using ${currentApiBaseUrl}`
        );
      } else {
        console.error(
          `Error searching Tidal for query: ${query} using ${currentApiBaseUrl}`,
          error
        );
      }

      if (attemptsLeft > 0) {
        switchToNextTidalEndpoint();
        console.log(
          `Retrying with next Tidal API endpoint: ${currentApiBaseUrl}`
        );
      } else {
        console.error("All Tidal API endpoints failed");
        throw new Error("All Tidal API endpoints failed");
      }
    }
  }

  return null;
};

/**
 * Get a song's streaming URL and details from Tidal
 * @param query Song query (title and artist)
 * @param quality Audio quality
 * @returns Promise with song data
 */
export const getTidalSong = async (
  query: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<TidalSongResponse | null> => {
  let attemptsLeft = TIDAL_FALLBACK_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Getting Tidal song: ${query} with quality ${quality} using ${currentApiBaseUrl}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(
        `${currentApiBaseUrl}/song/?q=${encodeURIComponent(
          query
        )}&quality=${quality}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Tidal API error: ${response.status} from ${currentApiBaseUrl}`
        );
        throw new Error(`Tidal API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Tidal song data received from ${currentApiBaseUrl}:`, data);

      return data;
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
        console.error(
          `Tidal API request timed out for song: ${query} using ${currentApiBaseUrl}`
        );
      } else {
        console.error(
          `Error getting Tidal song: ${query} using ${currentApiBaseUrl}`,
          error
        );
      }

      if (attemptsLeft > 0) {
        switchToNextTidalEndpoint();
        console.log(
          `Retrying with next Tidal API endpoint: ${currentApiBaseUrl}`
        );
      } else {
        console.error("All Tidal API endpoints failed");
        throw new Error("All Tidal API endpoints failed");
      }
    }
  }

  return null;
};

/**
 * Get track details by ID from Tidal
 * @param trackId Track ID
 * @param quality Audio quality
 * @returns Promise with track data
 */
export const getTidalTrackById = async (
  trackId: number,
  quality: TidalQuality = "LOSSLESS"
): Promise<TidalTrackResponse | null> => {
  let attemptsLeft = TIDAL_FALLBACK_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Getting Tidal track by ID: ${trackId} with quality ${quality} using ${currentApiBaseUrl}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(
        `${currentApiBaseUrl}/track/?id=${trackId}&quality=${quality}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(
          `Tidal API error: ${response.status} from ${currentApiBaseUrl}`
        );
        throw new Error(`Tidal API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Tidal track data received from ${currentApiBaseUrl}:`, data);

      // The API returns an array with track info and OriginalTrackUrl
      if (Array.isArray(data) && data.length >= 3) {
        // Find the object with OriginalTrackUrl
        const urlObject = data.find((item) => item.OriginalTrackUrl);
        if (urlObject) {
          console.log(`Found OriginalTrackUrl: ${urlObject.OriginalTrackUrl}`);
          const mergedData = {
            ...data[0], // Track metadata
            OriginalTrackUrl: urlObject.OriginalTrackUrl,
          };
          console.log(`Merged track data:`, mergedData);
          return mergedData;
        }
      }

      return data;
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
        console.error(
          `Tidal API request timed out for track ID: ${trackId} using ${currentApiBaseUrl}`
        );
      } else {
        console.error(
          `Error getting Tidal track by ID: ${trackId} using ${currentApiBaseUrl}`,
          error
        );
      }

      if (attemptsLeft > 0) {
        switchToNextTidalEndpoint();
        console.log(
          `Retrying with next Tidal API endpoint: ${currentApiBaseUrl}`
        );
      } else {
        console.error("All Tidal API endpoints failed");
        throw new Error("All Tidal API endpoints failed");
      }
    }
  }

  return null;
};

/**
 * Get cover art for a song from Tidal
 * @param query Song query or track ID
 * @returns Promise with cover URLs
 */
export const getTidalCover = async (
  query: string | number
): Promise<TidalCoverResponse[] | null> => {
  try {
    console.log(`Getting Tidal cover for: ${query} using ${currentApiBaseUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const queryParam =
      typeof query === "number"
        ? `id=${query}`
        : `q=${encodeURIComponent(query.toString())}`;
    const response = await fetch(`${currentApiBaseUrl}/cover/?${queryParam}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Tidal cover API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`Tidal cover data received:`, data);

    return data;
  } catch (error) {
    console.error(`Error getting Tidal cover for: ${query}`, error);
    return null;
  }
};

/**
 * Get lyrics for a track from Tidal
 * @param trackId Track ID
 * @returns Promise with lyrics data
 */
export const getTidalLyrics = async (
  trackId: number
): Promise<TidalLyricsResponse | null> => {
  try {
    console.log(
      `Getting Tidal lyrics for track ID: ${trackId} using ${currentApiBaseUrl}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${currentApiBaseUrl}/lyrics/?id=${trackId}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Tidal lyrics API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`Tidal lyrics data received:`, data);

    // The API returns an array, so get the first item
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`Error getting Tidal lyrics for track ID: ${trackId}`, error);
    return null;
  }
};

/**
 * Load a specific song from Tidal using the proper search -> track flow
 * @param title Song title
 * @param artist Song artist
 * @param quality Audio quality
 * @returns Promise with Track data or null
 */
export const loadTidalSong = async (
  title: string,
  artist: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<Track | null> => {
  try {
    const query = `${title} ${artist}`;
    console.log(`Loading Tidal song: ${query}`);

    // First, search for the song to get the track ID
    const searchResults = await searchTidalSongs(query, 5, 0);

    if (
      !searchResults ||
      !searchResults.items ||
      searchResults.items.length === 0
    ) {
      console.log(`No Tidal search results found for: ${query}`);
      return null;
    }

    // Find the best match from search results
    const bestMatch = searchResults.items[0]; // Take the first result for now
    console.log(`Found Tidal track ID: ${bestMatch.id} for query: ${query}`);

    // Now get the track details with streaming URL using the track ID
    const trackData = await getTidalTrackById(bestMatch.id, quality);

    if (!trackData || !trackData.OriginalTrackUrl) {
      console.log(`No Tidal track data found for ID: ${bestMatch.id}`);
      return null;
    }

    console.log("Converting Tidal track with data:", {
      bestMatch,
      trackData,
      OriginalTrackUrl: trackData.OriginalTrackUrl,
    });

    let track: Track;
    try {
      track = convertTidalTrackToTrack(bestMatch, trackData.OriginalTrackUrl);
      console.log("Successfully converted Tidal track:", track);
    } catch (conversionError) {
      console.error("Error converting Tidal track:", conversionError);
      console.log("bestMatch structure:", bestMatch);
      throw conversionError;
    }

    // Try to get lyrics if available
    try {
      const lyricsData = await getTidalLyrics(bestMatch.id);
      if (lyricsData && lyricsData.subtitles) {
        // Convert Tidal subtitles format to LRC format
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      }
    } catch (error) {
      console.warn(`Could not get lyrics for Tidal track: ${query}`, error);
    }

    console.log(`Successfully loaded Tidal song: ${query}`, track);
    return track;
  } catch (error) {
    console.error(`Error loading Tidal song: ${title} by ${artist}`, error);
    return null;
  }
};

/**
 * Load a Tidal track directly by ID and convert it to our Track format
 * @param trackId Tidal track ID
 * @param quality Audio quality
 * @param searchTrack Optional search track data for metadata
 * @returns Promise with Track data or null
 */
export const loadTidalTrackById = async (
  trackId: number,
  quality: TidalQuality = "LOSSLESS",
  searchTrack?: TidalTrack
): Promise<Track | null> => {
  try {
    console.log(`Loading Tidal track by ID: ${trackId}`);

    // Get the track details with streaming URL using the track ID
    const trackData = await getTidalTrackById(trackId, quality);

    if (!trackData || !trackData.OriginalTrackUrl) {
      console.log(`No Tidal track data found for ID: ${trackId}`);
      return null;
    }

    // If we have search track data, use it for metadata, otherwise use basic info from track response
    let track: Track;

    if (searchTrack) {
      // Use the search track data for rich metadata
      track = convertTidalTrackToTrack(searchTrack, trackData.OriginalTrackUrl);
    } else {
      // Create basic track from track response
      track = {
        id: trackData.id,
        title: trackData.title,
        artist: "Unknown Artist", // Track response doesn't include artist info
        audioSrc: trackData.OriginalTrackUrl,
        albumArtUrl: "", // Track response doesn't include album art
        duration: trackData.duration,
        source: "tidal",
      };
    }

    // Try to get lyrics if available
    try {
      const lyricsData = await getTidalLyrics(trackId);
      if (lyricsData && lyricsData.subtitles) {
        // Convert Tidal subtitles format to LRC format
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      }
    } catch (error) {
      console.warn(
        `Could not get lyrics for Tidal track ID: ${trackId}`,
        error
      );
    }

    console.log(`Successfully loaded Tidal track by ID: ${trackId}`, track);
    return track;
  } catch (error) {
    console.error(`Error loading Tidal track by ID: ${trackId}`, error);
    return null;
  }
};
