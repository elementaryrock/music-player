/**
 * Fixed Tidal API Service
 * 
 * This service provides a more robust implementation for interacting with Tidal API
 * with proper fallback mechanisms and CORS handling
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

// Enhanced endpoint configuration with multiple fallback strategies
interface TidalEndpoint {
  url: string;
  type: 'proxy' | 'direct' | 'cors-proxy';
  name: string;
  headers?: Record<string, string>;
}

const TIDAL_ENDPOINTS: TidalEndpoint[] = [
  // Development proxy endpoints (only work with Vite dev server)
  {
    url: "/api/tidal",
    type: 'proxy',
    name: 'Vite Proxy (HiFi)',
  },
  {
    url: "/api/tidal-backup", 
    type: 'proxy',
    name: 'Vite Proxy (Legacy)',
  },
  // Direct API endpoints with CORS handling - NEW HiFi endpoint
  {
    url: "https://hifi.401658.xyz",
    type: 'direct',
    name: 'HiFi API (Primary)',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  // Legacy endpoint as fallback
  {
    url: "https://tidal.401658.xyz",
    type: 'direct',
    name: 'Legacy API (Fallback)',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  },
  // CORS proxy as last resort
  {
    url: "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://hifi.401658.xyz"),
    type: 'cors-proxy',
    name: 'CORS Proxy (HiFi)',
    headers: {
      'Accept': 'application/json',
    },
  },
];

let currentEndpointIndex = 0;
let currentEndpoint = TIDAL_ENDPOINTS[currentEndpointIndex];

// Connection health tracking
interface ConnectionHealth {
  endpoint: string;
  lastSuccess: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}

const endpointHealth = new Map<string, ConnectionHealth>();

// Initialize health tracking
TIDAL_ENDPOINTS.forEach(endpoint => {
  endpointHealth.set(endpoint.url, {
    endpoint: endpoint.url,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    isHealthy: true,
  });
});

/**
 * Enhanced connection test with detailed diagnostics and HiFi API validation
 */
export const testTidalApiConnection = async (): Promise<{
  success: boolean;
  endpoint?: string;
  error?: string;
  diagnostics: Array<{
    endpoint: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    features?: {
      search: boolean;
      trackById: boolean;
      streaming: boolean;
    };
  }>;
}> => {
  const diagnostics: Array<{
    endpoint: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    features?: {
      search: boolean;
      trackById: boolean;
      streaming: boolean;
    };
  }> = [];

  console.log("🔍 Testing Tidal API connections with HiFi validation...");

  for (const endpoint of TIDAL_ENDPOINTS) {
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${endpoint.name}: ${endpoint.url}`);
      
      // Test 1: Basic connectivity with search
      const searchUrl = buildApiUrl(endpoint, '/search/?s=test&limit=1');
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: endpoint.headers || {},
        signal: AbortSignal.timeout(8000), // 8 second timeout for comprehensive test
      });

      const responseTime = Date.now() - startTime;
      const features = {
        search: false,
        trackById: false,
        streaming: false,
      };

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        features.search = !!(searchData?.items?.length > 0);
        
        // Test 2: Track by ID functionality (using known working ID from HiFi API)
        if (features.search && searchData.items?.[0]?.id) {
          try {
            const trackId = searchData.items[0].id;
            const trackUrl = buildApiUrl(endpoint, `/track/?id=${trackId}&quality=HIGH`);
            const trackResponse = await fetch(trackUrl, {
              method: 'GET',
              headers: endpoint.headers || {},
              signal: AbortSignal.timeout(5000),
            });

            if (trackResponse.ok) {
              const trackData = await trackResponse.json();
              features.trackById = true;
              
              // Test 3: Streaming URL availability
              if (Array.isArray(trackData)) {
                const streamingData = trackData.find((item: any) => item?.OriginalTrackUrl);
                features.streaming = !!streamingData?.OriginalTrackUrl;
              } else if (trackData?.OriginalTrackUrl) {
                features.streaming = true;
              }
            }
          } catch (trackError) {
            console.warn(`Track test failed for ${endpoint.name}:`, trackError);
          }
        }

        console.log(`✅ ${endpoint.name} - Success (${responseTime}ms)`, features);
        
        updateEndpointHealth(endpoint.url, true);
        diagnostics.push({
          endpoint: endpoint.name,
          success: true,
          responseTime,
          features,
        });

        // Set this as current endpoint and return success
        currentEndpointIndex = TIDAL_ENDPOINTS.indexOf(endpoint);
        currentEndpoint = endpoint;

        return {
          success: true,
          endpoint: endpoint.name,
          diagnostics,
        };
      } else {
        throw new Error(`HTTP ${searchResponse.status}: ${searchResponse.statusText}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.warn(`❌ ${endpoint.name} - Failed (${responseTime}ms): ${errorMessage}`);
      
      updateEndpointHealth(endpoint.url, false);
      diagnostics.push({
        endpoint: endpoint.name,
        success: false,
        responseTime,
        error: errorMessage,
      });
    }
  }

  console.error("🚫 All Tidal API endpoints failed");
  
  return {
    success: false,
    error: 'All endpoints failed',
    diagnostics,
  };
};

/**
 * Build API URL based on endpoint type
 */
function buildApiUrl(endpoint: TidalEndpoint, path: string): string {
  switch (endpoint.type) {
    case 'proxy':
      return `${endpoint.url}${path}`;
    case 'direct':
      return `${endpoint.url}${path}`;
    case 'cors-proxy':
      // For CORS proxy, we need to encode the full URL
      // Use HiFi endpoint for CORS proxy
      const fullUrl = `https://hifi.401658.xyz${path}`;
      return `https://api.allorigins.win/raw?url=${encodeURIComponent(fullUrl)}`;
    default:
      return `${endpoint.url}${path}`;
  }
}

/**
 * Update endpoint health tracking
 */
function updateEndpointHealth(endpointUrl: string, success: boolean): void {
  const health = endpointHealth.get(endpointUrl);
  if (!health) return;

  const now = Date.now();
  
  if (success) {
    health.lastSuccess = now;
    health.consecutiveFailures = 0;
    health.isHealthy = true;
  } else {
    health.lastFailure = now;
    health.consecutiveFailures++;
    health.isHealthy = health.consecutiveFailures < 3; // Mark unhealthy after 3 consecutive failures
  }
}

/**
 * Switch to the next healthy endpoint
 */
function switchToNextEndpoint(): boolean {
  const startIndex = currentEndpointIndex;
  
  do {
    currentEndpointIndex = (currentEndpointIndex + 1) % TIDAL_ENDPOINTS.length;
    currentEndpoint = TIDAL_ENDPOINTS[currentEndpointIndex];
    
    const health = endpointHealth.get(currentEndpoint.url);
    if (health?.isHealthy) {
      console.log(`🔄 Switched to ${currentEndpoint.name}: ${currentEndpoint.url}`);
      return true;
    }
  } while (currentEndpointIndex !== startIndex);

  // If no healthy endpoints, reset all to healthy and try the first one
  console.warn("⚠️ No healthy endpoints found, resetting health status");
  endpointHealth.forEach(health => {
    health.isHealthy = true;
    health.consecutiveFailures = 0;
  });
  
  currentEndpointIndex = 0;
  currentEndpoint = TIDAL_ENDPOINTS[0];
  return false;
}

/**
 * Make a robust API request with automatic endpoint switching
 */
async function makeRobustRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let attemptsLeft = TIDAL_ENDPOINTS.length;
  let lastError: Error | null = null;

  while (attemptsLeft > 0) {
    try {
      const url = buildApiUrl(currentEndpoint, path);
      console.log(`🌐 Making request to ${currentEndpoint.name}: ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...currentEndpoint.headers,
          ...options.headers,
        },
        signal: options.signal || AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      updateEndpointHealth(currentEndpoint.url, true);
      
      console.log(`✅ Request successful via ${currentEndpoint.name}`);
      return data;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      console.warn(`❌ Request failed via ${currentEndpoint.name}: ${lastError.message}`);
      updateEndpointHealth(currentEndpoint.url, false);
      
      attemptsLeft--;
      
      if (attemptsLeft > 0) {
        const switched = switchToNextEndpoint();
        if (!switched) {
          console.error("🚫 No more healthy endpoints available");
          break;
        }
      }
    }
  }

  throw new Error(`All Tidal API endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Enhanced search for songs on Tidal
 */
export const searchTidalSongs = async (
  query: string,
  limit: number = 10,
  offset: number = 0
): Promise<TidalSearchResponse | null> => {
  try {
    console.log(`🔍 Searching Tidal for: "${query}"`);
    
    const searchParams = new URLSearchParams({
      s: query,
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const data = await makeRobustRequest<TidalSearchResponse>(
      `/search/?${searchParams.toString()}`
    );

    console.log(`✅ Tidal search successful: ${data.items?.length || 0} results`);
    return data;

  } catch (error) {
    console.error(`❌ Tidal search failed for query: "${query}"`, error);
    return null;
  }
};

/**
 * Enhanced song retrieval with streaming URL
 */
export const getTidalSong = async (
  query: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<TidalSongResponse | null> => {
  try {
    console.log(`🎵 Getting Tidal song: "${query}" (${quality})`);
    
    const url = `/song/?q=${encodeURIComponent(query)}&quality=${quality}`;
    const data = await makeRobustRequest<TidalSongResponse | TidalSongResponse[]>(url);

    // Handle both single object and array responses
    const result = Array.isArray(data) ? data[0] : data;
    
    if (result) {
      console.log(`✅ Tidal song retrieved: ${result.title || 'Unknown'}`);
      return result;
    } else {
      console.warn(`⚠️ No song data returned for query: "${query}"`);
      return null;
    }

  } catch (error) {
    console.error(`❌ Failed to get Tidal song: "${query}"`, error);
    return null;
  }
};

/**
 * Enhanced track retrieval by ID
 */
export const getTidalTrackById = async (
  trackId: number,
  quality: TidalQuality = "LOSSLESS",
  country: string = "US"
): Promise<TidalTrackResponse | null> => {
  try {
    console.log(`🎵 Getting Tidal track by ID: ${trackId} (${quality})`);
    
    const url = `/track/?id=${trackId}&quality=${quality}&country=${country}`;
    const data = await makeRobustRequest<any>(url);

    // The API returns an array with track info and streaming URL
    if (Array.isArray(data) && data.length >= 2) {
      const trackInfo = data[0];
      const urlObject = data.find((item: any) => item && item.OriginalTrackUrl);
      
      if (urlObject && urlObject.OriginalTrackUrl) {
        const mergedData = {
          ...trackInfo,
          OriginalTrackUrl: urlObject.OriginalTrackUrl,
        };
        
        console.log(`✅ Tidal track retrieved: ${trackInfo.title || 'Unknown'}`);
        return mergedData;
      }
    }

    console.warn(`⚠️ No streaming URL found for track ID: ${trackId}`);
    return data;

  } catch (error) {
    console.error(`❌ Failed to get Tidal track by ID: ${trackId}`, error);
    return null;
  }
};

/**
 * Enhanced cover art retrieval
 */
export const getTidalCover = async (
  query: string | number
): Promise<TidalCoverResponse[] | null> => {
  try {
    console.log(`🖼️ Getting Tidal cover for: ${query}`);
    
    const queryParam = typeof query === "number" 
      ? `id=${query}` 
      : `q=${encodeURIComponent(query.toString())}`;
    
    const data = await makeRobustRequest<TidalCoverResponse[]>(`/cover/?${queryParam}`);
    
    console.log(`✅ Tidal cover retrieved`);
    return data;

  } catch (error) {
    console.error(`❌ Failed to get Tidal cover for: ${query}`, error);
    return null;
  }
};

/**
 * Enhanced lyrics retrieval
 */
export const getTidalLyrics = async (
  trackId: number
): Promise<TidalLyricsResponse | null> => {
  try {
    console.log(`📝 Getting Tidal lyrics for track ID: ${trackId}`);
    
    const data = await makeRobustRequest<TidalLyricsResponse[]>(`/lyrics/?id=${trackId}`);
    
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null;
    
    if (result) {
      console.log(`✅ Tidal lyrics retrieved`);
    } else {
      console.warn(`⚠️ No lyrics found for track ID: ${trackId}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Failed to get Tidal lyrics for track ID: ${trackId}`, error);
    return null;
  }
};

/**
 * Enhanced search and get songs with better error handling
 */
export const searchAndGetTidalSongs = async (
  query: string,
  quality: TidalQuality = "LOSSLESS",
  limit: number = 10
): Promise<Track[]> => {
  const callId = Math.random().toString(36).substring(2, 9);
  
  try {
    console.log(`[${callId}] 🔍 Searching and getting Tidal songs: "${query}"`);

    // Step 1: Search to get track IDs and metadata
    const searchResults = await searchTidalSongs(query, limit, 0);

    if (!searchResults?.items?.length) {
      console.log(`[${callId}] ⚠️ No search results found`);
      return [];
    }

    console.log(`[${callId}] 📋 Found ${searchResults.items.length} search results`);

    const tracks: Track[] = [];

    // Step 2: Get streaming URLs for each track
    for (const searchTrack of searchResults.items.slice(0, limit)) {
      try {
        const trackData = await getTidalTrackById(searchTrack.id, quality);

        if (trackData?.OriginalTrackUrl) {
          const track = convertTidalTrackToTrack(searchTrack, trackData.OriginalTrackUrl);
          tracks.push(track);
          console.log(`[${callId}] ✅ Added track: ${track.title}`);
        } else {
          console.warn(`[${callId}] ⚠️ No streaming URL for: ${searchTrack.title}`);
        }
      } catch (error) {
        console.warn(`[${callId}] ❌ Failed to get track data for: ${searchTrack.title}`, error);
      }
    }

    console.log(`[${callId}] 🎉 Successfully loaded ${tracks.length} Tidal tracks`);
    return tracks;

  } catch (error) {
    console.error(`[${callId}] ❌ Failed to search and get Tidal songs: "${query}"`, error);
    return [];
  }
};

/**
 * Enhanced direct song search
 */
export const searchTidalSongDirect = async (
  query: string,
  quality: TidalQuality = "LOSSLESS"
): Promise<Track | null> => {
  const callId = Math.random().toString(36).substring(2, 9);
  
  try {
    const trackName = query.trim();
    console.log(`[${callId}] 🎯 Direct Tidal search: "${trackName}"`);

    // Step 1: Search for the track
    const searchResults = await searchTidalSongs(trackName, 1, 0);

    if (!searchResults?.items?.length) {
      console.log(`[${callId}] ⚠️ No direct search results found`);
      return null;
    }

    const firstResult = searchResults.items[0];
    console.log(`[${callId}] 🎵 Found track: ${firstResult.title} (ID: ${firstResult.id})`);

    // Step 2: Get streaming URL
    const trackData = await getTidalTrackById(firstResult.id, quality);

    if (!trackData?.OriginalTrackUrl) {
      console.log(`[${callId}] ⚠️ No streaming URL available`);
      return null;
    }

    // Step 3: Convert to Track format
    const track = convertTidalTrackToTrack(firstResult, trackData.OriginalTrackUrl);

    // Step 4: Try to get lyrics
    try {
      const lyricsData = await getTidalLyrics(firstResult.id);
      if (lyricsData?.subtitles) {
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      }
    } catch (error) {
      console.warn(`[${callId}] ⚠️ Could not get lyrics`, error);
    }

    console.log(`[${callId}] ✅ Successfully created track: ${track.title}`);
    return track;

  } catch (error) {
    console.error(`[${callId}] ❌ Direct search failed: "${query}"`, error);
    return null;
  }
};

/**
 * Get endpoint health status
 */
export const getTidalEndpointHealth = (): Array<{
  name: string;
  url: string;
  isHealthy: boolean;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
}> => {
  return TIDAL_ENDPOINTS.map(endpoint => {
    const health = endpointHealth.get(endpoint.url)!;
    return {
      name: endpoint.name,
      url: endpoint.url,
      isHealthy: health.isHealthy,
      lastSuccess: health.lastSuccess ? new Date(health.lastSuccess) : null,
      lastFailure: health.lastFailure ? new Date(health.lastFailure) : null,
      consecutiveFailures: health.consecutiveFailures,
    };
  });
};

/**
 * Force endpoint health reset
 */
export const resetTidalEndpointHealth = (): void => {
  console.log("🔄 Resetting Tidal endpoint health status");
  endpointHealth.forEach(health => {
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.lastSuccess = null;
    health.lastFailure = null;
  });
  
  currentEndpointIndex = 0;
  currentEndpoint = TIDAL_ENDPOINTS[0];
};

/**
 * Comprehensive diagnostic function for Tidal API health
 */
export const runTidalDiagnostics = async (): Promise<{
  overall: {
    success: boolean;
    workingEndpoints: number;
    totalEndpoints: number;
    recommendedEndpoint?: string;
    issues: string[];
  };
  endpoints: Array<{
    name: string;
    url: string;
    status: 'healthy' | 'degraded' | 'failed';
    responseTime?: number;
    features: {
      search: boolean;
      trackById: boolean;
      streaming: boolean;
    };
    lastError?: string;
  }>;
  recommendations: string[];
}> => {
  console.log("🔬 Running comprehensive Tidal API diagnostics...");
  
  const results = {
    overall: {
      success: false,
      workingEndpoints: 0,
      totalEndpoints: TIDAL_ENDPOINTS.length,
      issues: [] as string[],
    },
    endpoints: [] as Array<{
      name: string;
      url: string;
      status: 'healthy' | 'degraded' | 'failed';
      responseTime?: number;
      features: {
        search: boolean;
        trackById: boolean;
        streaming: boolean;
      };
      lastError?: string;
    }>,
    recommendations: [] as string[],
  };

  // Test each endpoint comprehensively
  for (const endpoint of TIDAL_ENDPOINTS) {
    const startTime = Date.now();
    const features = {
      search: false,
      trackById: false,
      streaming: false,
    };
    
    let status: 'healthy' | 'degraded' | 'failed' = 'failed';
    let lastError: string | undefined;

    try {
      // Test search functionality
      const searchUrl = buildApiUrl(endpoint, '/search/?s=Taylor Swift&limit=1');
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: endpoint.headers || {},
        signal: AbortSignal.timeout(10000),
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        features.search = !!(searchData?.items?.length > 0);

        if (features.search && searchData.items?.[0]?.id) {
          // Test track by ID
          const trackId = searchData.items[0].id;
          const trackUrl = buildApiUrl(endpoint, `/track/?id=${trackId}&quality=HIGH`);
          const trackResponse = await fetch(trackUrl, {
            method: 'GET',
            headers: endpoint.headers || {},
            signal: AbortSignal.timeout(8000),
          });

          if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            features.trackById = true;

            // Test streaming URL
            if (Array.isArray(trackData)) {
              const streamingData = trackData.find((item: any) => item?.OriginalTrackUrl);
              features.streaming = !!streamingData?.OriginalTrackUrl;
            } else if (trackData?.OriginalTrackUrl) {
              features.streaming = true;
            }
          }
        }

        // Determine status based on features
        if (features.search && features.trackById && features.streaming) {
          status = 'healthy';
          results.overall.workingEndpoints++;
        } else if (features.search) {
          status = 'degraded';
          results.overall.workingEndpoints++;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      status = 'failed';
    }

    const responseTime = Date.now() - startTime;

    results.endpoints.push({
      name: endpoint.name,
      url: endpoint.url,
      status,
      responseTime,
      features,
      lastError,
    });

    console.log(`${status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌'} ${endpoint.name}: ${status} (${responseTime}ms)`);
  }

  // Generate overall assessment
  results.overall.success = results.overall.workingEndpoints > 0;
  
  // Find recommended endpoint
  const healthyEndpoint = results.endpoints.find(e => e.status === 'healthy');
  const degradedEndpoint = results.endpoints.find(e => e.status === 'degraded');
  
  if (healthyEndpoint) {
    results.overall.recommendedEndpoint = healthyEndpoint.name;
  } else if (degradedEndpoint) {
    results.overall.recommendedEndpoint = degradedEndpoint.name;
  }

  // Generate issues and recommendations
  if (results.overall.workingEndpoints === 0) {
    results.overall.issues.push('No working endpoints found');
    results.recommendations.push('Check internet connection');
    results.recommendations.push('Try running resetTidalEndpointHealth()');
  } else if (results.overall.workingEndpoints < results.overall.totalEndpoints) {
    results.overall.issues.push(`${results.overall.totalEndpoints - results.overall.workingEndpoints} endpoints are not working`);
  }

  const streamingIssues = results.endpoints.filter(e => e.features.search && e.features.trackById && !e.features.streaming);
  if (streamingIssues.length > 0) {
    results.overall.issues.push('Some endpoints have streaming URL issues');
    results.recommendations.push('Try different quality settings (HIGH instead of LOSSLESS)');
  }

  const proxyIssues = results.endpoints.filter(e => e.name.includes('Proxy') && e.status === 'failed');
  if (proxyIssues.length > 0) {
    results.recommendations.push('Restart development server if using Vite proxy');
  }

  console.log(`🔬 Diagnostics complete: ${results.overall.workingEndpoints}/${results.overall.totalEndpoints} endpoints working`);
  
  return results;
};

/**
 * Auto-fix common Tidal API issues
 */
export const autoFixTidalIssues = async (): Promise<{
  success: boolean;
  actionsPerformed: string[];
  remainingIssues: string[];
}> => {
  console.log("🔧 Auto-fixing Tidal API issues...");
  
  const actionsPerformed: string[] = [];
  const remainingIssues: string[] = [];

  // Step 1: Reset endpoint health
  resetTidalEndpointHealth();
  actionsPerformed.push('Reset endpoint health status');

  // Step 2: Test connection
  const connectionTest = await testTidalApiConnection();
  
  if (connectionTest.success) {
    actionsPerformed.push(`Successfully connected to ${connectionTest.endpoint}`);
    return {
      success: true,
      actionsPerformed,
      remainingIssues,
    };
  }

  // Step 3: Run full diagnostics to identify specific issues
  const diagnostics = await runTidalDiagnostics();
  
  if (diagnostics.overall.success) {
    actionsPerformed.push('Found working endpoint through diagnostics');
    
    // Switch to the recommended endpoint
    if (diagnostics.overall.recommendedEndpoint) {
      const recommendedIndex = TIDAL_ENDPOINTS.findIndex(e => e.name === diagnostics.overall.recommendedEndpoint);
      if (recommendedIndex >= 0) {
        currentEndpointIndex = recommendedIndex;
        currentEndpoint = TIDAL_ENDPOINTS[recommendedIndex];
        actionsPerformed.push(`Switched to ${diagnostics.overall.recommendedEndpoint}`);
      }
    }
    
    return {
      success: true,
      actionsPerformed,
      remainingIssues: diagnostics.overall.issues,
    };
  }

  // Step 4: If all else fails, provide recommendations
  remainingIssues.push(...diagnostics.overall.issues);
  remainingIssues.push(...diagnostics.recommendations);

  return {
    success: false,
    actionsPerformed,
    remainingIssues,
  };
};

// Export legacy functions for compatibility
export const loadTidalSong = searchTidalSongDirect;
export const loadTidalTrackById = getTidalTrackById;

// Make test functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testTidalConnection = testTidalApiConnection;
  (window as any).getTidalHealth = getTidalEndpointHealth;
  (window as any).resetTidalHealth = resetTidalEndpointHealth;
  (window as any).runTidalDiagnostics = runTidalDiagnostics;
  (window as any).autoFixTidal = autoFixTidalIssues;
  
  console.log('🔧 Enhanced Tidal API diagnostics loaded!');
  console.log('Available functions:');
  console.log('  - testTidalConnection() - Test all endpoints');
  console.log('  - runTidalDiagnostics() - Comprehensive health check');
  console.log('  - autoFixTidal() - Auto-fix common issues');
  console.log('  - getTidalHealth() - Get endpoint health status');
  console.log('  - resetTidalHealth() - Reset health tracking');
}