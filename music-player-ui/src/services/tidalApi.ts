/**
 * Tidal API Service
 *
 * This file contains functions to interact with the Tidal API
 * Now using the enhanced fixed implementation with better error handling
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

// Re-export all functions from the fixed implementation
export {
  testTidalApiConnection,
  searchTidalSongs,
  getTidalSong,
  getTidalTrackById,
  getTidalCover,
  getTidalLyrics,
  searchAndGetTidalSongs,
  searchTidalSongDirect,
  loadTidalSong,
  loadTidalTrackById,
  getTidalEndpointHealth,
  resetTidalEndpointHealth,
  runTidalDiagnostics,
  autoFixTidalIssues,
} from './tidalApiFixed';

// Keep diagnostic utilities lazy. Importing the player should not load a test
// module that probes dead public endpoints or prints a wall of console output.
// The browser console helpers below still load the utilities when explicitly
// called.
export const testHiFiTidalAPI = () =>
  import("./tidalHiFiTest").then(({ testHiFiTidalAPI: run }) => run());
export const quickHiFiHealthCheck = () =>
  import("./tidalHiFiTest").then(({ quickHiFiHealthCheck: run }) => run());
export const compareHiFiVsLegacy = () =>
  import("./tidalHiFiTest").then(({ compareHiFiVsLegacy: run }) => run());

// Legacy compatibility - the old implementation has been moved to tidalApiFixed.ts
// with enhanced error handling, multiple endpoint fallbacks, and better CORS support

/**
 * Test function for debugging - can be called from browser console
 * Tests the enhanced Tidal API implementation
 * @param query Song query to test
 * @returns Promise with test results
 */
export const testTidalSong = async (query: string = "That's So True") => {
  console.log(`🧪 Testing enhanced Tidal API: "${query}"`);

  try {
    // Import the function to avoid circular dependency
    const { searchTidalSongDirect } = await import('./tidalApiFixed');
    const track = await searchTidalSongDirect(query, "LOSSLESS");

    if (track) {
      console.log("✅ Success! Enhanced API working:", track);
      return { success: true, track };
    } else {
      console.log("❌ No track returned");
      return { success: false };
    }
  } catch (error) {
    console.error("❌ Enhanced API test failed:", error);
    return { success: false, error };
  }
};

// Make test functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testTidalSong = testTidalSong;
  (window as any).testHiFiTidal = testHiFiTidalAPI;
  (window as any).quickHiFiCheck = quickHiFiHealthCheck;
  (window as any).compareHiFiVsLegacy = compareHiFiVsLegacy;

  // Import and expose diagnostic functions
  import('./tidalApiFixed').then(({ runTidalDiagnostics, autoFixTidalIssues }) => {
    (window as any).runTidalDiagnostics = runTidalDiagnostics;
    (window as any).autoFixTidal = autoFixTidalIssues;
  });
}
