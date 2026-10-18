/**
 * Tidal API Service
 *
 * This file contains functions to interact with the Tidal API
 * Now using the enhanced fixed implementation with better error handling
 */

import {
  autoFixTidalIssues as autoFixTidalIssuesForDebug,
  runTidalDiagnostics as runTidalDiagnosticsForDebug,
  searchTidalSongDirect as searchTidalSongDirectForDebug,
} from './tidalApiFixed';

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

// Keep the separate HiFi diagnostic module lazy. Importing the player should
// not load a test module that probes dead public endpoints or prints a wall of
// console output. The fixed provider functions below are fail-closed and do
// not perform network work until explicitly called.
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
    const track = await searchTidalSongDirectForDebug(query, "LOSSLESS");

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

  // Expose diagnostic functions only when the browser console asks for them.
  // The functions themselves remain fail-closed and do not probe on import.
  (window as any).runTidalDiagnostics = runTidalDiagnosticsForDebug;
  (window as any).autoFixTidal = autoFixTidalIssuesForDebug;
}
