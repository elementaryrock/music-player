/**
 * JioSaavn API Service
 *
 * This service provides methods to interact with the unofficial JioSaavn API
 * API Documentation: https://saavn.dev/
 */

// Base URL for the JioSaavn API
// Try multiple API endpoints in case one is down
const API_ENDPOINTS = [
  "https://saavn.dev/api",
  "https://jiosaavn-api.vercel.app/api",
  "https://jiosaavn-api-v3.vercel.app/api",
];

// Start with the first endpoint
let currentEndpointIndex = 0;
let API_BASE_URL = API_ENDPOINTS[currentEndpointIndex];

// Function to switch to the next API endpoint
const switchToNextEndpoint = () => {
  currentEndpointIndex = (currentEndpointIndex + 1) % API_ENDPOINTS.length;
  API_BASE_URL = API_ENDPOINTS[currentEndpointIndex];
  console.log(`Switched to API endpoint: ${API_BASE_URL}`);
  return API_BASE_URL;
};

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
  // Try each API endpoint until one works
  let attemptsLeft = API_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Making API request to search for songs: ${query} using ${API_BASE_URL}`
      );

      // Add a timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${API_BASE_URL}/search/songs?query=${encodeURIComponent(
          query
        )}&page=${page}&limit=${limit}`,
        { signal: controller.signal }
      );

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`API error: ${response.status} from ${API_BASE_URL}`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `API response received for query: ${query} from ${API_BASE_URL}`
      );

      // Check if the response has the expected structure
      if (!data || !data.data) {
        console.error("Unexpected API response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      // If we get here, the API call was successful
      return data.data;
    } catch (error) {
      attemptsLeft--;

      if (error.name === "AbortError") {
        console.error(
          `API request timed out for query: ${query} using ${API_BASE_URL}`
        );
      } else {
        console.error(
          `Error searching songs for query: ${query} using ${API_BASE_URL}`,
          error
        );
      }

      // If we have attempts left, switch to the next endpoint and try again
      if (attemptsLeft > 0) {
        switchToNextEndpoint();
        console.log(`Retrying with next API endpoint: ${API_BASE_URL}`);
      } else {
        // We've tried all endpoints and none worked
        console.error("All API endpoints failed");
        throw new Error("All API endpoints failed");
      }
    }
  }

  // This should never be reached due to the throw in the else block above
  throw new Error("Unexpected error in searchSongs");
};

/**
 * Get song details by ID
 * @param id Song ID
 * @returns Song details
 */
export const getSongById = async (id: string): Promise<any> => {
  // Try each API endpoint until one works
  let attemptsLeft = API_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Making API request to get song by ID: ${id} using ${API_BASE_URL}`
      );

      // Add a timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/songs/${id}`, {
        signal: controller.signal,
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`API error: ${response.status} from ${API_BASE_URL}`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `API response received for song ID: ${id} from ${API_BASE_URL}`
      );

      // Check if the response has the expected structure
      if (!data || !data.data) {
        console.error("Unexpected API response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      // If we get here, the API call was successful
      return data.data;
    } catch (error) {
      attemptsLeft--;

      if (error.name === "AbortError") {
        console.error(
          `API request timed out for song ID: ${id} using ${API_BASE_URL}`
        );
      } else {
        console.error(
          `Error getting song by ID: ${id} using ${API_BASE_URL}`,
          error
        );
      }

      // If we have attempts left, switch to the next endpoint and try again
      if (attemptsLeft > 0) {
        switchToNextEndpoint();
        console.log(`Retrying with next API endpoint: ${API_BASE_URL}`);
      } else {
        // We've tried all endpoints and none worked
        console.error("All API endpoints failed");
        throw new Error("All API endpoints failed");
      }
    }
  }

  // This should never be reached due to the throw in the else block above
  throw new Error("Unexpected error in getSongById");
};

/**
 * Get song details by link
 * @param link JioSaavn song link
 * @returns Song details
 */
export const getSongByLink = async (link: string): Promise<any> => {
  // Try each API endpoint until one works
  let attemptsLeft = API_ENDPOINTS.length;

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Making API request to get song by link: ${link} using ${API_BASE_URL}`
      );

      // Add a timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${API_BASE_URL}/songs?link=${encodeURIComponent(link)}`,
        { signal: controller.signal }
      );

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`API error: ${response.status} from ${API_BASE_URL}`);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log(
        `API response received for link: ${link} from ${API_BASE_URL}`
      );

      // Check if the response has the expected structure
      if (!data || !data.data) {
        console.error("Unexpected API response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      // If we get here, the API call was successful
      return data.data;
    } catch (error) {
      attemptsLeft--;

      if (error.name === "AbortError") {
        console.error(
          `API request timed out for link: ${link} using ${API_BASE_URL}`
        );
      } else {
        console.error(
          `Error getting song by link: ${link} using ${API_BASE_URL}`,
          error
        );
      }

      // If we have attempts left, switch to the next endpoint and try again
      if (attemptsLeft > 0) {
        switchToNextEndpoint();
        console.log(`Retrying with next API endpoint: ${API_BASE_URL}`);
      } else {
        // We've tried all endpoints and none worked
        console.error("All API endpoints failed");
        throw new Error("All API endpoints failed");
      }
    }
  }

  // This should never be reached due to the throw in the else block above
  throw new Error("Unexpected error in getSongByLink");
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
