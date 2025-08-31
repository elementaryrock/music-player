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

// Re-export HiFi-specific test functions
export {
  testHiFiTidalAPI,
  quickHiFiHealthCheck,
  compareHiFiVsLegacy,
} from './tidalHiFiTest';

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
  
  // Import and expose HiFi test functions
  import('./tidalHiFiTest').then(({ testHiFiTidalAPI, quickHiFiHealthCheck, compareHiFiVsLegacy }) => {
    (window as any).testHiFiTidal = testHiFiTidalAPI;
    (window as any).quickHiFiCheck = quickHiFiHealthCheck;
    (window as any).compareHiFiVsLegacy = compareHiFiVsLegacy;
  });

  // Import and expose diagnostic functions
  import('./tidalApiFixed').then(({ runTidalDiagnostics, autoFixTidalIssues }) => {
    (window as any).runTidalDiagnostics = runTidalDiagnostics;
    (window as any).autoFixTidal = autoFixTidalIssues;
  });
  
  console.log('🎵 Enhanced Tidal API with HiFi endpoint loaded!');
  console.log('Available test functions:');
  console.log('  - testTidalSong("song name") - Test enhanced API');
  console.log('  - testHiFiTidal() - Full HiFi API test suite');
  console.log('  - quickHiFiCheck() - Quick HiFi health check');
  console.log('  - compareHiFiVsLegacy() - Performance comparison');
}