/**
 * JioSaavn API Service
 *
 * This service provides methods to interact with the unofficial JioSaavn API
 * API Documentation: https://saavn.dev/
 */

// Base URL for the JioSaavn API
const API_BASE_URL = "https://saavn.dev/api";

/**
 * Search for songs, albums, artists, and playlists
 * @param query Search query
 * @returns Search results
 */
export const searchAll = async (query: string): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/search?query=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching:", error);
    throw error;
  }
};

/**
 * Search for songs
 * @param query Search query
 * @param page Page number (default: 0)
 * @param limit Number of results per page (default: 10)
 * @returns Song search results
 */
export const searchSongs = async (
  query: string,
  page: number = 0,
  limit: number = 10
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/search/songs?query=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching songs:", error);
    throw error;
  }
};

/**
 * Get song details by ID
 * @param id Song ID
 * @returns Song details
 */
export const getSongById = async (id: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}/songs/${id}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error getting song by ID:", error);
    throw error;
  }
};

/**
 * Get song details by link
 * @param link JioSaavn song link
 * @returns Song details
 */
export const getSongByLink = async (link: string): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/songs?link=${encodeURIComponent(link)}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error getting song by link:", error);
    throw error;
  }
};

/**
 * Get song suggestions based on a song ID
 * @param id Song ID
 * @param limit Number of suggestions to return (default: 10)
 * @returns Song suggestions
 */
export const getSongSuggestions = async (
  id: string,
  limit: number = 10
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/songs/${id}/suggestions?limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error getting song suggestions:", error);
    throw error;
  }
};

/**
 * Search for albums
 * @param query Search query
 * @param page Page number (default: 0)
 * @param limit Number of results per page (default: 10)
 * @returns Album search results
 */
export const searchAlbums = async (
  query: string,
  page: number = 0,
  limit: number = 10
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/search/albums?query=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching albums:", error);
    throw error;
  }
};

/**
 * Search for artists
 * @param query Search query
 * @param page Page number (default: 0)
 * @param limit Number of results per page (default: 10)
 * @returns Artist search results
 */
export const searchArtists = async (
  query: string,
  page: number = 0,
  limit: number = 10
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/search/artists?query=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching artists:", error);
    throw error;
  }
};

/**
 * Search for playlists
 * @param query Search query
 * @param page Page number (default: 0)
 * @param limit Number of results per page (default: 10)
 * @returns Playlist search results
 */
export const searchPlaylists = async (
  query: string,
  page: number = 0,
  limit: number = 10
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/search/playlists?query=${encodeURIComponent(
        query
      )}&page=${page}&limit=${limit}`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching playlists:", error);
    throw error;
  }
};
