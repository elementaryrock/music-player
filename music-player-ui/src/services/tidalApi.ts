/**
 * Tidal API Service
 *
 * This file contains functions to interact with the Tidal API
 */

import {
  TidalQuality,
  TidalSearchResponse,
  TidalTrack,
  TidalSongResponse,
  TidalTrackResponse,
  TidalCoverResponse,
  TidalLyricsResponse,
  convertTidalTrackToTrack,
  Track,
} from "../types/tidal.types";

// Use Vite proxy endpoints to avoid CORS issues
// These proxy to the actual Tidal API endpoints
// Primary endpoint: /api/tidal -> https://tidal.401658.xyz
// Fallback endpoint: /api/tidal-backup -> https://hifi-04ed2aaea09a.herokuapp.com
const TIDAL_FALLBACK_ENDPOINTS = ["/api/tidal", "/api/tidal-backup"];

let currentEndpointIndex = 0;
let currentApiBaseUrl = TIDAL_FALLBACK_ENDPOINTS[currentEndpointIndex];

/**
 * Test function to verify the Tidal API proxy is working
 * @returns Promise with test result
 */
export const testTidalApiConnection = async (): Promise<boolean> => {
  try {
    console.log("Testing Tidal API connection...");
    const response = await fetch(
      `${currentApiBaseUrl}/song/?q=test&quality=LOSSLESS`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      `Test response status: ${response.status} ${response.statusText}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log("Tidal API connection test successful:", data);
      return true;
    } else {
      console.warn(
        "Tidal API connection test failed:",
        response.status,
        response.statusText
      );
      return false;
    }
  } catch (error) {
    console.error("Tidal API connection test error:", error);
    return false;
  }
};

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

      // Use the correct search endpoint with 's' parameter for song search
      // According to the API docs: https://tidal.401658.xyz/tdoc#tag/default/GET/search/
      const searchParams = new URLSearchParams({
        s: query,
        limit: limit.toString(),
        offset: offset.toString(),
      });
      const response = await fetch(
        `${currentApiBaseUrl}/search/?${searchParams.toString()}`,
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
 * Get a song's streaming URL and details from Tidal using the /song/ endpoint
 * This is the primary method that directly returns the OriginalTrackUrl
 * @param query Song query (track name only, artist name should be avoided)
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

      // According to the API docs: https://tidal.401658.xyz/tdoc#tag/default/GET/song/
      // The song endpoint requires q and quality parameters and directly returns OriginalTrackUrl
      const url = `${currentApiBaseUrl}/song/?q=${encodeURIComponent(
        query
      )}&quality=${quality}`;

      console.log(`Making request to: ${url}`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      console.log(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          `Tidal API error: ${response.status} ${response.statusText} from ${currentApiBaseUrl}`
        );
        console.warn(`Error response body:`, errorText);
        throw new Error(
          `Tidal API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`Tidal song data received from ${currentApiBaseUrl}:`, data);

      // Check if response is an array (which it seems to be based on console output)
      if (Array.isArray(data) && data.length > 0) {
        return data[0]; // Return the first track from the array
      } else if (data && typeof data === "object") {
        return data;
      } else {
        console.log("Unexpected data structure:", data);
        return data;
      }
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
 * @param country Optional country code (default: "US")
 * @returns Promise with track data
 */
export const getTidalTrackById = async (
  trackId: number,
  quality: TidalQuality = "LOSSLESS",
  country: string = "US"
): Promise<TidalTrackResponse | null> => {
  let attemptsLeft = TIDAL_FALLBACK_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Getting Tidal track by ID: ${trackId} with quality ${quality} using ${currentApiBaseUrl}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      // According to the API docs: https://tidal.401658.xyz/tdoc#tag/default/GET/track/
      // The track endpoint requires id, quality, and optionally country
      const response = await fetch(
        `${currentApiBaseUrl}/track/?id=${trackId}&quality=${quality}&country=${country}`,
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

      // The API returns an array with track info and streaming URL
      if (Array.isArray(data) && data.length >= 2) {
        // Based on the console output, the structure is:
        // [0]: Basic track info (id, title, duration, etc.)
        // [1]: More track info (trackId, assetPresentation, audioMode, etc.)
        // [2]: Streaming URL info (OriginalTrackUrl)

        console.log(
          "Array contents:",
          data.map((item, index) => ({
            index,
            keys: Object.keys(item || {}),
            hasOriginalTrackUrl: !!(item && item.OriginalTrackUrl),
          }))
        );

        // Find the object with OriginalTrackUrl
        const urlObject = data.find((item) => item && item.OriginalTrackUrl);

        if (urlObject && urlObject.OriginalTrackUrl) {
          console.log(`Found OriginalTrackUrl: ${urlObject.OriginalTrackUrl}`);
          const trackInfoObject = data[0]; // First object contains basic track info
          const mergedData = {
            ...trackInfoObject, // Track metadata
            OriginalTrackUrl: urlObject.OriginalTrackUrl,
          };
          console.log(`Merged track data:`, mergedData);
          return mergedData;
        } else {
          console.log("No OriginalTrackUrl found in any array item");
          console.log("Array items:", data);
        }
      } else {
        console.log(
          "Unexpected data structure - not an array or insufficient length:",
          data
        );
      }

      // If we can't parse the expected structure, return the raw data
      // This is a fallback in case the API response format changes
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
 * Search for a track and get streaming URL using search + track ID approach
 * This is the improved approach: search first, then get track by ID
 * @param query Search query
 * @param quality Audio quality
 * @returns Promise with Track data or null
 */
export const searchTidalSongDirect = async (
  query: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<Track | null> => {
  const callId = Math.random().toString(36).substring(2, 9);
  try {
    const trackName = query.trim();

    console.log(`[${callId}] Searching Tidal track: "${trackName}"`);

    // Step 1: Search for the track to get track ID and metadata
    const searchResults = await searchTidalSongs(trackName, 1, 0);

    if (
      !searchResults ||
      !searchResults.items ||
      searchResults.items.length === 0
    ) {
      console.log(`[${callId}] No Tidal search results found for: ${query}`);
      return null;
    }

    const firstResult = searchResults.items[0];
    console.log(
      `[${callId}] Found track ID: ${firstResult.id} - "${firstResult.title}"`
    );

    // Step 2: Get track details with streaming URL using track ID
    const trackData = await getTidalTrackById(firstResult.id, quality);

    if (!trackData || !trackData.OriginalTrackUrl) {
      console.log(
        `[${callId}] No streaming URL found for track ID: ${firstResult.id}`
      );
      return null;
    }

    // Step 3: Convert to our Track format using search metadata + streaming URL
    const track = convertTidalTrackToTrack(
      firstResult,
      trackData.OriginalTrackUrl
    );

    // Step 4: Try to get lyrics if available
    try {
      const lyricsData = await getTidalLyrics(firstResult.id);
      if (lyricsData && lyricsData.subtitles) {
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      }
    } catch (error) {
      console.warn(
        `[${callId}] Could not get lyrics for track ID: ${firstResult.id}`,
        error
      );
    }

    console.log(`[${callId}] Successfully found Tidal track: ${query}`, track);
    return track;
  } catch (error) {
    console.error(`[${callId}] Error searching Tidal track: ${query}`, error);
    return null;
  }
};

/**
 * Search and get songs from Tidal using search + track ID approach
 * This function searches for songs and returns them ready to play
 * @param query Search query
 * @param quality Audio quality
 * @param limit Number of results to return (default: 10)
 * @returns Promise with array of Track data
 */
export const searchAndGetTidalSongs = async (
  query: string,
  quality: TidalQuality = "LOSSLESS",
  limit: number = 10
): Promise<Track[]> => {
  try {
    console.log(`Searching and getting Tidal songs: ${query}`);

    // Step 1: Search to get track IDs and metadata
    const searchResults = await searchTidalSongs(query, limit, 0);

    if (
      !searchResults ||
      !searchResults.items ||
      searchResults.items.length === 0
    ) {
      console.log(`No Tidal search results found for: ${query}`);
      return [];
    }

    const tracks: Track[] = [];

    // Step 2: For each search result, get the streaming URL using track ID
    for (const searchTrack of searchResults.items.slice(0, limit)) {
      try {
        // Get track details with streaming URL using track ID
        const trackData = await getTidalTrackById(searchTrack.id, quality);

        if (trackData && trackData.OriginalTrackUrl) {
          // Convert using search metadata + streaming URL
          const track = convertTidalTrackToTrack(
            searchTrack,
            trackData.OriginalTrackUrl
          );
          tracks.push(track);
        } else {
          console.warn(
            `No streaming URL found for track ID: ${searchTrack.id} - ${searchTrack.title}`
          );
        }
      } catch (error) {
        console.warn(
          `Failed to get track data for ID: ${searchTrack.id} - ${searchTrack.title}`,
          error
        );
        // Continue with next track instead of failing completely
      }
    }

    console.log(`Successfully loaded ${tracks.length} Tidal songs from search`);
    return tracks;
  } catch (error) {
    console.error(`Error searching and getting Tidal songs: ${query}`, error);
    return [];
  }
};

/**
 * Load a specific song from Tidal using search + track ID approach
 * @param title Song title
 * @param artist Song artist (used for better search matching)
 * @param quality Audio quality
 * @returns Promise with Track data or null
 */
export const loadTidalSong = async (
  title: string,
  artist: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<Track | null> => {
  const callId = Math.random().toString(36).substring(2, 9);
  try {
    // Create a search query with both title and artist for better matching
    const query = `${title} ${artist}`.trim();
    console.log(
      `[${callId}] Loading Tidal song: "${title}" by "${artist}" (search query: "${query}")`
    );

    // Step 1: Search for the track to get track ID and metadata
    const searchResults = await searchTidalSongs(query, 5, 0); // Get top 5 results for better matching

    if (
      !searchResults ||
      !searchResults.items ||
      searchResults.items.length === 0
    ) {
      console.log(`[${callId}] No Tidal search results found for: ${query}`);
      return null;
    }

    // Step 2: Find the best match (exact title match preferred)
    let bestMatch = searchResults.items[0]; // Default to first result

    // Try to find exact title match
    const exactMatch = searchResults.items.find(
      (item) => item.title.toLowerCase() === title.toLowerCase()
    );
    if (exactMatch) {
      bestMatch = exactMatch;
      console.log(`[${callId}] Found exact title match: "${bestMatch.title}"`);
    } else {
      console.log(`[${callId}] Using first result: "${bestMatch.title}"`);
    }

    // Step 3: Get track details with streaming URL using track ID
    const trackData = await getTidalTrackById(bestMatch.id, quality);

    if (!trackData || !trackData.OriginalTrackUrl) {
      console.log(
        `[${callId}] No streaming URL found for track ID: ${bestMatch.id}`
      );
      return null;
    }

    // Step 4: Convert to our Track format using search metadata + streaming URL
    let track: Track;
    try {
      track = convertTidalTrackToTrack(bestMatch, trackData.OriginalTrackUrl);
    } catch (conversionError) {
      console.error(
        `[${callId}] Error converting Tidal track:`,
        conversionError
      );
      console.log(`[${callId}] bestMatch structure:`, bestMatch);
      throw conversionError;
    }

    // Step 5: Try to get lyrics if available
    try {
      const lyricsData = await getTidalLyrics(bestMatch.id);
      if (lyricsData && lyricsData.subtitles) {
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      }
    } catch (error) {
      console.warn(
        `[${callId}] Could not get lyrics for track ID: ${bestMatch.id}`,
        error
      );
    }

    // Step 6: Try to get cover art if not already available
    if (!track.albumArtUrl) {
      try {
        const coverData = await getTidalCover(bestMatch.id);
        if (coverData && coverData.length > 0 && coverData[0]["640"]) {
          track.albumArtUrl = coverData[0]["640"];
        }
      } catch (error) {
        console.warn(
          `[${callId}] Could not get cover art for track ID: ${bestMatch.id}`,
          error
        );
      }
    }

    console.log(`[${callId}] Successfully loaded Tidal song: ${query}`, track);
    return track;
  } catch (error) {
    console.error(
      `[${callId}] Error loading Tidal song: ${title} by ${artist}`,
      error
    );
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
    // According to the API docs: https://tidal.401658.xyz/tdoc#tag/default/GET/track/
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
    // According to the API docs: https://tidal.401658.xyz/tdoc#tag/default/GET/lyrics/
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

    // Try to get cover art if not already available
    if (!track.albumArtUrl) {
      try {
        const coverData = await getTidalCover(trackId);
        if (coverData && coverData.length > 0 && coverData[0]["640"]) {
          track.albumArtUrl = coverData[0]["640"];
        }
      } catch (error) {
        console.warn(
          `Could not get cover art for Tidal track ID: ${trackId}`,
          error
        );
      }
    }

    console.log(`Successfully loaded Tidal track by ID: ${trackId}`, track);
    return track;
  } catch (error) {
    console.error(`Error loading Tidal track by ID: ${trackId}`, error);
    return null;
  }
};

/**
 * Test function for debugging - can be called from browser console
 * Tests the new search + track ID approach
 * @param query Song query to test
 * @returns Promise with test results
 */
export const testTidalSong = async (query: string = "That's So True") => {
  console.log(`🧪 Testing Tidal song with new approach: "${query}"`);

  try {
    // Test the new search + track ID approach
    const track = await searchTidalSongDirect(query, "LOSSLESS");

    if (track) {
      console.log("✅ Success! Converted track:", track);
      return { success: true, track };
    } else {
      console.log("❌ No track returned");
      return { success: false };
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
    return { success: false, error };
  }
};

// Make test function available globally for debugging
if (typeof window !== "undefined") {
  (window as any).testTidalSong = testTidalSong;
}
