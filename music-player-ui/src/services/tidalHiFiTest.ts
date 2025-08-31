/**
 * HiFi Tidal API Test Utility
 * 
 * Specific tests for the new https://hifi.401658.xyz/ endpoint
 */

import { testTidalApiConnection, searchTidalSongs, getTidalSong, searchTidalSongDirect } from './tidalApiFixed';

export interface HiFiTestResult {
  endpoint: string;
  timestamp: Date;
  tests: {
    connection: { success: boolean; responseTime?: number; error?: string };
    search: { success: boolean; resultCount?: number; error?: string };
    songRetrieval: { success: boolean; hasStreamingUrl?: boolean; error?: string };
    directSearch: { success: boolean; trackData?: any; error?: string };
  };
  overall: {
    success: boolean;
    workingFeatures: string[];
    failedFeatures: string[];
    recommendations: string[];
  };
}

/**
 * Comprehensive test of the new HiFi Tidal API endpoint
 */
export async function testHiFiTidalAPI(): Promise<HiFiTestResult> {
  console.log('🎵 Testing HiFi Tidal API (https://hifi.401658.xyz/)...');
  
  const result: HiFiTestResult = {
    endpoint: 'https://hifi.401658.xyz/',
    timestamp: new Date(),
    tests: {
      connection: { success: false },
      search: { success: false },
      songRetrieval: { success: false },
      directSearch: { success: false },
    },
    overall: {
      success: false,
      workingFeatures: [],
      failedFeatures: [],
      recommendations: [],
    },
  };

  // Test 1: Connection Test
  console.log('1️⃣ Testing API connection...');
  try {
    const startTime = Date.now();
    const connectionResult = await testTidalApiConnection();
    const responseTime = Date.now() - startTime;
    
    result.tests.connection = {
      success: connectionResult.success,
      responseTime,
      error: connectionResult.error,
    };
    
    if (connectionResult.success) {
      result.overall.workingFeatures.push('API Connection');
      console.log(`✅ Connection successful (${responseTime}ms)`);
    } else {
      result.overall.failedFeatures.push('API Connection');
      console.log(`❌ Connection failed: ${connectionResult.error}`);
    }
  } catch (error) {
    result.tests.connection.error = error instanceof Error ? error.message : 'Unknown error';
    result.overall.failedFeatures.push('API Connection');
    console.log(`❌ Connection test threw error: ${result.tests.connection.error}`);
  }

  // Test 2: Search Functionality
  console.log('2️⃣ Testing search functionality...');
  try {
    const searchResult = await searchTidalSongs('test', 5, 0);
    
    if (searchResult && searchResult.items) {
      result.tests.search = {
        success: true,
        resultCount: searchResult.items.length,
      };
      result.overall.workingFeatures.push('Search');
      console.log(`✅ Search successful: ${searchResult.items.length} results`);
    } else {
      result.tests.search = {
        success: false,
        error: 'No search results returned',
      };
      result.overall.failedFeatures.push('Search');
      console.log('❌ Search failed: No results returned');
    }
  } catch (error) {
    result.tests.search.error = error instanceof Error ? error.message : 'Unknown error';
    result.overall.failedFeatures.push('Search');
    console.log(`❌ Search test threw error: ${result.tests.search.error}`);
  }

  // Test 3: Song Retrieval with Streaming URL
  console.log('3️⃣ Testing song retrieval...');
  try {
    const songResult = await getTidalSong('test', 'HIGH');
    
    if (songResult) {
      const hasStreamingUrl = !!(songResult.OriginalTrackUrl || (Array.isArray(songResult) && songResult[0]?.OriginalTrackUrl));
      
      result.tests.songRetrieval = {
        success: true,
        hasStreamingUrl,
      };
      
      if (hasStreamingUrl) {
        result.overall.workingFeatures.push('Song Retrieval with Streaming URL');
        console.log('✅ Song retrieval successful with streaming URL');
      } else {
        result.overall.workingFeatures.push('Song Retrieval (metadata only)');
        console.log('⚠️ Song retrieval successful but no streaming URL');
      }
    } else {
      result.tests.songRetrieval = {
        success: false,
        error: 'No song data returned',
      };
      result.overall.failedFeatures.push('Song Retrieval');
      console.log('❌ Song retrieval failed: No data returned');
    }
  } catch (error) {
    result.tests.songRetrieval.error = error instanceof Error ? error.message : 'Unknown error';
    result.overall.failedFeatures.push('Song Retrieval');
    console.log(`❌ Song retrieval test threw error: ${result.tests.songRetrieval.error}`);
  }

  // Test 4: Direct Search (Complete Workflow)
  console.log('4️⃣ Testing direct search workflow...');
  try {
    const directResult = await searchTidalSongDirect('test', 'HIGH');
    
    if (directResult) {
      result.tests.directSearch = {
        success: true,
        trackData: {
          title: directResult.title,
          artist: directResult.artist,
          hasAudioSrc: !!directResult.audioSrc,
          source: directResult.source,
        },
      };
      result.overall.workingFeatures.push('Direct Search Workflow');
      console.log(`✅ Direct search successful: "${directResult.title}" by ${directResult.artist}`);
    } else {
      result.tests.directSearch = {
        success: false,
        error: 'No track returned from direct search',
      };
      result.overall.failedFeatures.push('Direct Search Workflow');
      console.log('❌ Direct search failed: No track returned');
    }
  } catch (error) {
    result.tests.directSearch.error = error instanceof Error ? error.message : 'Unknown error';
    result.overall.failedFeatures.push('Direct Search Workflow');
    console.log(`❌ Direct search test threw error: ${result.tests.directSearch.error}`);
  }

  // Generate Overall Assessment
  const workingCount = result.overall.workingFeatures.length;
  const totalTests = 4;
  result.overall.success = workingCount >= totalTests / 2; // At least 50% working

  // Generate Recommendations
  if (result.overall.failedFeatures.includes('API Connection')) {
    result.overall.recommendations.push('Check network connectivity and firewall settings');
    result.overall.recommendations.push('Verify that https://hifi.401658.xyz/ is accessible');
  }

  if (result.overall.failedFeatures.includes('Search')) {
    result.overall.recommendations.push('API connection works but search endpoint may have changed');
    result.overall.recommendations.push('Check API documentation at https://hifi.401658.xyz/tdoc');
  }

  if (result.tests.songRetrieval.success && !result.tests.songRetrieval.hasStreamingUrl) {
    result.overall.recommendations.push('Streaming URLs may require different quality settings or authentication');
  }

  if (result.overall.workingFeatures.length === 0) {
    result.overall.recommendations.push('All tests failed - the HiFi API may be down or have breaking changes');
    result.overall.recommendations.push('Consider falling back to legacy endpoints');
  }

  if (result.overall.success) {
    result.overall.recommendations.push('HiFi API is working well! 🎉');
  }

  console.log(`\n📊 HiFi API Test Summary:`);
  console.log(`✅ Working: ${result.overall.workingFeatures.join(', ')}`);
  console.log(`❌ Failed: ${result.overall.failedFeatures.join(', ')}`);
  console.log(`📋 Recommendations: ${result.overall.recommendations.join('; ')}`);

  return result;
}

/**
 * Quick HiFi API health check
 */
export async function quickHiFiHealthCheck(): Promise<boolean> {
  try {
    console.log('⚡ Quick HiFi health check...');
    
    // Just test basic connectivity
    const response = await fetch('https://hifi.401658.xyz/song/?q=test&quality=HIGH', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    const isHealthy = response.ok || response.status < 500;
    console.log(`HiFi API Health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'} (${response.status})`);
    
    return isHealthy;
  } catch (error) {
    console.log(`HiFi API Health: ❌ Error - ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

/**
 * Compare HiFi vs Legacy API performance
 */
export async function compareHiFiVsLegacy(): Promise<{
  hifi: { responseTime: number; success: boolean; error?: string };
  legacy: { responseTime: number; success: boolean; error?: string };
  winner: 'hifi' | 'legacy' | 'tie';
}> {
  console.log('🏁 Comparing HiFi vs Legacy API performance...');
  
  const testEndpoint = async (url: string, name: string) => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${url}/song/?q=test&quality=HIGH`, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      const responseTime = Date.now() - startTime;
      const success = response.ok;
      
      console.log(`${name}: ${success ? '✅' : '❌'} ${responseTime}ms`);
      
      return { responseTime, success };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      console.log(`${name}: ❌ ${responseTime}ms (${errorMsg})`);
      
      return { responseTime, success: false, error: errorMsg };
    }
  };

  const [hifi, legacy] = await Promise.all([
    testEndpoint('https://hifi.401658.xyz', 'HiFi API'),
    testEndpoint('https://tidal.401658.xyz', 'Legacy API'),
  ]);

  let winner: 'hifi' | 'legacy' | 'tie' = 'tie';
  
  if (hifi.success && !legacy.success) {
    winner = 'hifi';
  } else if (!hifi.success && legacy.success) {
    winner = 'legacy';
  } else if (hifi.success && legacy.success) {
    winner = hifi.responseTime < legacy.responseTime ? 'hifi' : 'legacy';
  }

  console.log(`🏆 Winner: ${winner.toUpperCase()}`);

  return { hifi, legacy, winner };
}

// Export functions to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).testHiFiTidal = testHiFiTidalAPI;
  (window as any).quickHiFiCheck = quickHiFiHealthCheck;
  (window as any).compareHiFiVsLegacy = compareHiFiVsLegacy;
  
  console.log('🎵 HiFi Tidal API test functions available:');
  console.log('  - testHiFiTidal() - Full API test suite');
  console.log('  - quickHiFiCheck() - Quick health check');
  console.log('  - compareHiFiVsLegacy() - Performance comparison');
}