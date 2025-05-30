/**
 * JioSaavn API Service
 *
 * This service provides methods to interact with the unofficial JioSaavn API
 * API Documentation: https://saavn.dev/
 */

// Base URL for the JioSaavn API
// Updated to use the MaanasMS Cloudflare Worker instance (single, high-availability endpoint)
const API_ENDPOINTS = ["https://jiosaavn-api.maanasms.workers.dev/api"];

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
/**
 * Database of popular artists to help with search matching
 */
const POPULAR_ARTISTS = [
  "Taylor Swift",
  "Ed Sheeran",
  "Ariana Grande",
  "The Weeknd",
  "Drake",
  "Beyoncé",
  "Justin Bieber",
  "BTS",
  "Adele",
  "Billie Eilish",
  "Lady Gaga",
  "Bruno Mars",
  "Rihanna",
  "Post Malone",
  "Bad Bunny",
  "Eminem",
  "Dua Lipa",
  "Coldplay",
  "Maroon 5",
  "Imagine Dragons",
  "Katy Perry",
  "Shawn Mendes",
  "Travis Scott",
  "Harry Styles",
  "Alan Walker",
  "Marshmello",
  "Gracie Abrams",
  "A.R. Rahman",
  "Arijit Singh",
  "Alka Yagnik",
  "Amit Trivedi",
  "Mohit Chauhan",
  "Shreya Ghoshal",
];

/**
 * Database of known songs and their artists for direct mapping
 * This helps with songs that consistently have missing artist info
 */
const KNOWN_SONGS_ARTISTS: Record<string, string> = {
  // Tamasha movie soundtrack
  "Agar Tum Saath Ho": "Alka Yagnik, Arijit Singh",
  Matargashti: "Mohit Chauhan",
  "Heer Toh Badi Sad Hai": "Mika Singh",
  "Wat Wat Wat": "Arijit Singh",
  "Tu Koi Aur Hai": "A.R. Rahman",
  "Agar Tum Mil Jao": "Arijit Singh",
  // Other popular songs that might have artist issues
  Alone: "Alan Walker",
  Faded: "Alan Walker",
  "Shape of You": "Ed Sheeran",
  Despacito: "Luis Fonsi, Daddy Yankee",
  "Blinding Lights": "The Weeknd",
  "Dance Monkey": "Tones and I",
  "That's So True": "Gracie Abrams",
};

/**
 * Prepare search query to improve results
 * @param originalQuery The original search query
 * @returns An enhanced query for better search results
 */
const prepareSearchQuery = (originalQuery: string): string => {
  // Try to extract artist and song title patterns
  const byPattern = /(.+)\s+by\s+(.+)/i;
  const dashPattern = /(.+)\s+-\s+(.+)/i;

  // Check if the query contains artist information
  const byMatch = originalQuery.match(byPattern);
  const dashMatch = originalQuery.match(dashPattern);

  // If we have a match, create an enhanced query that the API understands better
  if (byMatch) {
    const [_, songTitle, artist] = byMatch;
    return `${songTitle.trim()} ${artist.trim()}`;
  } else if (dashMatch) {
    const [_, artist, songTitle] = dashMatch;
    return `${songTitle.trim()} ${artist.trim()}`;
  }

  // Check if query matches or contains any popular artist
  const matchingArtist = POPULAR_ARTISTS.find((artist) => {
    return originalQuery.toLowerCase().includes(artist.toLowerCase());
  });

  if (matchingArtist) {
    // If query contains artist name, return as is - the artist name helps
    return originalQuery;
  }

  // For generic queries without artist info, return original
  return originalQuery;
};

export const searchSongs = async (
  query: string,
  page: number = 0,
  limit: number = 20 // Increased limit for better results
): Promise<any> => {
  // Try each API endpoint until one works
  let attemptsLeft = API_ENDPOINTS.length;
  const enhancedQuery = prepareSearchQuery(query);

  console.log(`Original query: "${query}", Enhanced query: "${enhancedQuery}"`);

  while (attemptsLeft > 0) {
    try {
      console.log(
        `Making API request to search for songs: ${enhancedQuery} using ${API_BASE_URL}`
      );

      // Add a timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Add sort=popularity and language=all parameters for better results
      const response = await fetch(
        `${API_BASE_URL}/search/songs?query=${encodeURIComponent(
          enhancedQuery
        )}&page=${page}&limit=${limit}&sort=popularity&language=all`,
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
        `API response received for query: ${enhancedQuery} from ${API_BASE_URL}`
      );

      // Check if the response has the expected structure
      if (!data || !data.data) {
        console.error("Unexpected API response structure:", data);
        throw new Error("Unexpected API response structure");
      }

      // Process the results to ensure they have all required information
      const results = data.data.results || [];
      const processedResults = results.map((song: any) => {
        // Ensure each song has imageUrl property by checking different possible formats
        if (!song.imageUrl && song.image) {
          if (Array.isArray(song.image) && song.image.length > 0) {
            // Use the highest quality image available (last in array)
            song.imageUrl =
              song.image[song.image.length - 1].link ||
              song.image[song.image.length - 1].url;
          } else if (typeof song.image === "string") {
            song.imageUrl = song.image;
          } else if (typeof song.image === "object" && song.image !== null) {
            song.imageUrl = song.image.link || song.image.url;
          }
        }

        // Enhanced artist information extraction
        // Extract and normalize artist information from all possible fields
        const extractArtistInfo = (songData: any) => {
          // First check if this is a known song with a predefined artist
          const songName = songData.name || songData.title || "";
          if (songName && KNOWN_SONGS_ARTISTS[songName]) {
            return KNOWN_SONGS_ARTISTS[songName];
          }

          // Check for partial matches in known songs
          for (const knownSong in KNOWN_SONGS_ARTISTS) {
            if (songName.includes(knownSong) || knownSong.includes(songName)) {
              return KNOWN_SONGS_ARTISTS[knownSong];
            }
          }

          // Check all possible artist fields in order of priority
          if (
            songData.primaryArtists &&
            songData.primaryArtists.trim() !== ""
          ) {
            return songData.primaryArtists;
          }

          if (songData.artist && songData.artist.trim() !== "") {
            return songData.artist;
          }

          // Handle arrays of artists
          if (
            songData.artists &&
            Array.isArray(songData.artists) &&
            songData.artists.length > 0
          ) {
            // Check if it's an array of strings
            if (typeof songData.artists[0] === "string") {
              return songData.artists[0];
            }
            // Check if it's an array of objects with name property
            if (
              typeof songData.artists[0] === "object" &&
              songData.artists[0] &&
              songData.artists[0].name
            ) {
              return songData.artists[0].name;
            }
          }

          // Check for featured artists
          if (
            songData.featuredArtists &&
            songData.featuredArtists.trim() !== ""
          ) {
            return songData.featuredArtists;
          }

          // Check for singers field
          if (songData.singers && songData.singers.trim() !== "") {
            return songData.singers;
          }

          // Try to parse from title if in format 'Song - Artist'
          const titleMatch = (songData.title || songData.name || "").match(
            /\s+-\s+(.+)$/
          );
          if (titleMatch && titleMatch[1]) {
            return titleMatch[1];
          }

          return null;
        };

        // Apply the artist extraction and save to primaryArtists
        const artistInfo = extractArtistInfo(song);
        if (artistInfo) {
          song.primaryArtists = artistInfo;
          // Ensure artist field is also set as a backup
          if (!song.artist) {
            song.artist = artistInfo;
          }
        } else if (!song.primaryArtists) {
          // Fallbacks: use any existing non-placeholder artist / singers field, else set to 'Unknown Artist'
          const fallbackArtist =
            song.artist && !/^artist$/i.test(song.artist)
              ? song.artist
              : song.singers && song.singers.trim() !== ""
              ? song.singers
              : undefined;
          song.primaryArtists = fallbackArtist || "Unknown Artist";
        }

        return song;
      });

      // Return the processed results
      return { ...data.data, results: processedResults };
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
        console.error(
          `API request timed out for query: ${enhancedQuery} using ${API_BASE_URL}`
        );
      } else {
        console.error(
          `Error searching songs for query: ${enhancedQuery} using ${API_BASE_URL}`,
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
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
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
    } catch (error: unknown) {
      attemptsLeft--;

      if (error instanceof Error && error.name === "AbortError") {
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

/**
 * Fetch lyrics for a song using LRCLIB API
 * @param title - The song title
 * @param artist - The artist name
 * @param album - The album name (optional)
 * @param duration - The song duration in seconds (optional)
 * @returns A Promise that resolves to the lyrics text or null if not found
 */
export const getLyrics = async (
  title: string,
  artist: string,
  album?: string,
  duration?: number
): Promise<string | null> => {
  try {
    const searchApiUrl = "https://lrclib.net/api/search";

    // Helper to sanitize strings (remove brackets, feat., etc.)
    const sanitize = (str: string): string =>
      str
        .replace(/\(.*?\)|\[.*?\]/g, "") // remove brackets/parentheses
        .replace(/feat\.?|ft\.?/gi, "")
        .replace(/[^a-zA-Z0-9\s]/g, "") // remove special chars
        .trim()
        .replace(/^artist$/i, "") // remove placeholder 'Artist'
        .replace(/^unknown\s*artist?$/i, "");

    const trySearch = async (
      params: Record<string, string>
    ): Promise<any[]> => {
      const usp = new URLSearchParams(params);
      const resp = await fetch(`${searchApiUrl}?${usp.toString()}`);
      if (!resp.ok) {
        console.warn(
          `LRCLIB search API error ${resp.status} for params`,
          params
        );
        return [];
      }
      const json = await resp.json();
      return Array.isArray(json) ? json : [];
    };

    const cleanTitle = sanitize(title);
    const cleanArtist = sanitize(artist);

    /*
     * STEP 1: Try LRCLIB /api/get (and get-cached) endpoints directly.
     * These endpoints can often return lyrics immediately when supplied
     * with a combination of track name / artist / duration, avoiding the
     * need for a separate search round-trip. We try a few progressively
     * relaxed parameter sets until we either get lyrics or exhaust the possibilities.
     */
    const attemptDirectGet = async (): Promise<string | null> => {
      // Build a list of URLSearchParams variants to try – start strict, then relax
      const variants: URLSearchParams[] = [];

      const buildParams = (
        track: string,
        artistParam?: string,
        dur?: number
      ): URLSearchParams => {
        const p = new URLSearchParams();
        p.append("track_name", track);
        if (artistParam) p.append("artist_name", artistParam);
        if (dur !== undefined) p.append("duration", dur.toString());
        return p;
      };

      // 1. Exact title, artist, duration (if available)
      variants.push(
        buildParams(cleanTitle, cleanArtist || undefined, duration)
      );
      // 2. Exact title & artist – no duration (only if artist present)
      if (cleanArtist) variants.push(buildParams(cleanTitle, cleanArtist));
      // 3. Title only
      variants.push(buildParams(cleanTitle));

      for (const params of variants) {
        try {
          const url = `https://lrclib.net/api/get?${params.toString()}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            console.warn(`LRCLIB direct GET error ${resp.status} for ${url}`);
            continue;
          }
          const json: any = await resp.json();
          const lyr = json?.syncedLyrics || json?.plainLyrics;
          if (lyr) {
            console.log(
              "LRCLIB: obtained lyrics via direct GET with params",
              params.toString()
            );
            return lyr;
          }
        } catch (e) {
          console.warn("LRCLIB: direct GET attempt failed", e);
        }
      }

      return null;
    };

    const directLyrics = await attemptDirectGet();
    if (directLyrics) {
      return directLyrics;
    }

    const searchVariants: Record<string, string>[] = [
      cleanArtist
        ? { track_name: cleanTitle, artist_name: cleanArtist }
        : { track_name: cleanTitle },
      cleanArtist ? { q: `${cleanTitle} ${cleanArtist}` } : { q: cleanTitle },
      { track_name: cleanTitle },
      { q: cleanTitle },
    ];

    let searchResults: any[] = [];
    for (const variant of searchVariants) {
      searchResults = await trySearch(variant);
      if (searchResults.length > 0) {
        console.log("LRCLIB: results found with params", variant);
        break;
      }
    }

    if (searchResults.length === 0) {
      console.log("No results from LRCLIB search API after trying variants.");
      return null;
    }

    // Step 2: Find the best match from search results
    let bestMatch: {
      id: number;
      score: number;
      name: string;
      artist: string;
      album?: string;
      duration?: number;
      instrumental?: boolean;
    } | null = null;
    // After empirical testing some valid matches scored 4, lower threshold slightly
    const MIN_SCORE_THRESHOLD = 4;

    for (const result of searchResults) {
      let currentScore = 0;
      const Rartist = result.artistName?.toLowerCase();
      const Rtitle = result.trackName?.toLowerCase();
      const Ralbum = result.albumName?.toLowerCase();
      const Rduration = result.duration
        ? Math.round(result.duration)
        : undefined;

      const inputArtistLower = artist.toLowerCase();
      const inputTitleLower = title.toLowerCase();
      const inputAlbumLower =
        typeof album === "string" ? album.toLowerCase() : undefined;

      // Artist scoring
      if (Rartist) {
        if (Rartist === inputArtistLower) {
          currentScore += 3;
        } else if (
          inputArtistLower.includes(Rartist) ||
          Rartist.includes(inputArtistLower)
        ) {
          currentScore += 1;
        }
      }

      // Title scoring
      if (Rtitle) {
        if (Rtitle === inputTitleLower) {
          currentScore += 3;
        } else if (
          inputTitleLower.includes(Rtitle) ||
          Rtitle.includes(inputTitleLower)
        ) {
          currentScore += 1;
        }
      }

      // Album scoring
      if (inputAlbumLower && Ralbum) {
        if (Ralbum === inputAlbumLower) {
          currentScore += 2;
        } else if (
          inputAlbumLower.includes(Ralbum) ||
          Ralbum.includes(inputAlbumLower)
        ) {
          currentScore += 1;
        }
      }

      // Duration scoring
      if (duration && Rduration && Math.abs(duration - Rduration) <= 5) {
        // Allow 5s difference
        currentScore += 1;
      }

      // Penalize instrumental tracks if we are not specifically looking for them
      if (result.instrumental) {
        currentScore -= 2;
      }

      if (!bestMatch || currentScore > bestMatch.score) {
        bestMatch = {
          id: result.id,
          score: currentScore,
          name: result.trackName,
          artist: result.artistName,
          album: result.albumName,
          duration: result.duration ? Math.round(result.duration) : undefined,
          instrumental: result.instrumental,
        };
      }
    }

    let finalMatchId: number | null = null;

    if (bestMatch && bestMatch.score >= MIN_SCORE_THRESHOLD) {
      finalMatchId = bestMatch.id;
      console.log(
        `LRCLIB: Found best match: ID=${finalMatchId}, Score=${bestMatch.score}, Track='${bestMatch.name}', Artist='${bestMatch.artist}'`
      );
    } else {
      console.log(
        `LRCLIB: Failed to find a match above threshold ${MIN_SCORE_THRESHOLD}.`
      );
      console.log(
        `LRCLIB: Input - Title: '${title}', Artist: '${artist}', Album: '${album}', Duration: ${duration}`
      );
      if (bestMatch) {
        console.log(
          `LRCLIB: Best candidate was - ID=${bestMatch.id}, Score=${bestMatch.score}, Track='${bestMatch.name}', Artist='${bestMatch.artist}', Album='${bestMatch.album}', Duration=${bestMatch.duration}, Instrumental=${bestMatch.instrumental}`
        );
      } else {
        console.log(
          "LRCLIB: No potential matches found after scoring search results."
        );
      }
    }

    if (!finalMatchId) {
      console.log(
        "LRCLIB: Could not find a suitable match (above threshold) in search results."
      );
      return null;
    }

    // Step 3: Fetch lyrics by ID
    const getApiUrl = `https://lrclib.net/api/get/${finalMatchId}`;
    const getResponse = await fetch(getApiUrl);

    if (!getResponse.ok) {
      console.error(
        `Failed to fetch lyrics from LRCLIB by ID ${finalMatchId}: ${getResponse.status}`
      );
      console.error(
        `LRCLIB: Details for failed fetch - Input Title: '${title}', Artist: '${artist}', Album: '${album}', Duration: ${duration}`
      );
      return null;
    }

    const data: any = await getResponse.json();
    const lyrics = data.syncedLyrics || data.plainLyrics;
    return lyrics || null;
  } catch (error) {
    console.error("Error fetching lyrics from LRCLIB:", error);
    return null;
  }
};

/**
 * Combined search function that searches both JioSaavn and Tidal
 * @param query Search query
 * @param source Audio source to search ('jiosaavn', 'tidal', or 'both')
 * @returns Combined search results
 */
export const searchCombined = async (
  query: string,
  source: "jiosaavn" | "tidal" | "both" = "both"
): Promise<any> => {
  const results = {
    jiosaavn: null,
    tidal: null,
    combined: [],
  };

  try {
    // Search JioSaavn if requested
    if (source === "jiosaavn" || source === "both") {
      try {
        const jiosaavnResults = await searchSongs(query, 0, 10);
        results.jiosaavn = jiosaavnResults;

        // Add JioSaavn results to combined array
        if (jiosaavnResults?.results) {
          results.combined.push(
            ...jiosaavnResults.results.map((song: any) => ({
              ...song,
              source: "jiosaavn",
            }))
          );
        }
      } catch (error) {
        console.warn("JioSaavn search failed:", error);
      }
    }

    // Search Tidal if requested
    if (source === "tidal" || source === "both") {
      try {
        // Import Tidal search function dynamically to avoid circular imports
        const { searchTidalSongs } = await import("./tidalApi");
        const tidalResults = await searchTidalSongs(query, 10, 0);
        results.tidal = tidalResults;

        // Add Tidal results to combined array
        if (tidalResults?.items) {
          results.combined.push(
            ...tidalResults.items.map((song: any) => ({
              id: song.id,
              title: song.title,
              artist:
                song.artist?.name ||
                song.artists?.[0]?.name ||
                "Unknown Artist",
              audioSrc: "", // Will be filled when track is selected
              albumArtUrl: `https://resources.tidal.com/images/${song.album.cover.replace(
                /-/g,
                "/"
              )}/640x640.jpg`,
              album: song.album.title,
              duration: song.duration,
              source: "tidal",
              // Keep original Tidal data for compatibility with existing code
              name: song.title,
              primaryArtists:
                song.artist?.name ||
                song.artists?.[0]?.name ||
                "Unknown Artist",
              imageUrl: `https://resources.tidal.com/images/${song.album.cover.replace(
                /-/g,
                "/"
              )}/640x640.jpg`,
              image: [
                {
                  link: `https://resources.tidal.com/images/${song.album.cover.replace(
                    /-/g,
                    "/"
                  )}/640x640.jpg`,
                },
              ],
            }))
          );
        }
      } catch (error) {
        console.warn("Tidal search failed:", error);
      }
    }

    console.log(`Combined search results for "${query}":`, results);
    return results;
  } catch (error) {
    console.error("Error in combined search:", error);
    throw error;
  }
};
