/**
 * HiFi Tidal API Example Implementation
 * 
 * Based on the working API call: GET https://hifi.401658.xyz/track/?id=430965606&quality=LOSSLESS
 */

import { getTidalTrackById, searchTidalSongs } from './tidalApiFixed';
import { TidalQuality } from '../types/tidal.types';

/**
 * Example function demonstrating the working HiFi API call
 */
export async function testHiFiApiExample(): Promise<void> {
  console.log('🎵 Testing HiFi API with working example...');
  
  try {
    // Example 1: Get track by ID (from your screenshot)
    console.log('📋 Example 1: Get track by ID 430965606...');
    const trackData = await getTidalTrackById(430965606, 'LOSSLESS');
    
    if (trackData) {
      console.log('✅ Track data received:');
      console.log(`  Title: ${trackData.title || 'Unknown'}`);
      console.log(`  ID: ${trackData.id}`);
      console.log(`  Has Streaming URL: ${!!trackData.OriginalTrackUrl}`);
      
      if (trackData.OriginalTrackUrl) {
        console.log(`  Streaming URL: ${trackData.OriginalTrackUrl.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ No track data received');
    }

    // Example 2: Search for songs and get their streaming URLs
    console.log('\n📋 Example 2: Search and get streaming URLs...');
    const searchResults = await searchTidalSongs('Taylor Swift', 3, 0);
    
    if (searchResults?.items?.length) {
      console.log(`✅ Found ${searchResults.items.length} search results:`);
      
      for (const item of searchResults.items.slice(0, 2)) {
        console.log(`\n  🎵 ${item.title} (ID: ${item.id})`);
        
        // Get streaming URL for this track
        const trackWithUrl = await getTidalTrackById(item.id, 'HIGH');
        if (trackWithUrl?.OriginalTrackUrl) {
          console.log(`    ✅ Streaming URL available`);
          console.log(`    🔗 ${trackWithUrl.OriginalTrackUrl.substring(0, 60)}...`);
        } else {
          console.log(`    ❌ No streaming URL available`);
        }
      }
    } else {
      console.log('❌ No search results found');
    }

    // Example 3: Test different quality levels
    console.log('\n📋 Example 3: Testing different quality levels...');
    const qualities: TidalQuality[] = ['HIGH', 'LOSSLESS', 'HI_RES'];
    
    for (const quality of qualities) {
      try {
        const qualityTest = await getTidalTrackById(430965606, quality);
        const hasUrl = !!qualityTest?.OriginalTrackUrl;
        console.log(`  ${quality}: ${hasUrl ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`  ${quality}: ❌ Error`);
      }
    }

  } catch (error) {
    console.error('❌ HiFi API example test failed:', error);
  }
}

/**
 * Test the complete workflow: Search → Get Track → Play
 */
export async function testCompleteWorkflow(songQuery: string = 'Blinding Lights'): Promise<{
  success: boolean;
  track?: any;
  error?: string;
}> {
  console.log(`🔄 Testing complete workflow for: "${songQuery}"`);
  
  try {
    // Step 1: Search for the song
    console.log('1️⃣ Searching...');
    const searchResults = await searchTidalSongs(songQuery, 5, 0);
    
    if (!searchResults?.items?.length) {
      return { success: false, error: 'No search results found' };
    }
    
    const firstResult = searchResults.items[0];
    console.log(`✅ Found: "${firstResult.title}" (ID: ${firstResult.id})`);
    
    // Step 2: Get streaming URL
    console.log('2️⃣ Getting streaming URL...');
    const trackData = await getTidalTrackById(firstResult.id, 'LOSSLESS');
    
    let streamUrl = trackData?.OriginalTrackUrl;
    if (!streamUrl) {
      // Try with HIGH quality as fallback
      console.log('⚠️ LOSSLESS failed, trying HIGH quality...');
      const trackDataHigh = await getTidalTrackById(firstResult.id, 'HIGH');

      if (!trackDataHigh?.OriginalTrackUrl) {
        return { success: false, error: 'No streaming URL available' };
      }

      streamUrl = trackDataHigh.OriginalTrackUrl;
    }
    
    console.log('✅ Streaming URL obtained');
    
    // Step 3: Create playable track object
    console.log('3️⃣ Creating track object...');
    const playableTrack = {
      id: firstResult.id,
      title: firstResult.title,
      artist: firstResult.artist?.name || firstResult.artists?.[0]?.name || 'Unknown Artist',
      audioSrc: streamUrl,
      albumArtUrl: firstResult.album?.cover ? 
        `https://resources.tidal.com/images/${firstResult.album.cover.replace(/-/g, '/')}/640x640.jpg` : 
        undefined,
      duration: firstResult.duration,
      source: 'tidal',
    };
    
    console.log('✅ Complete workflow successful!');
    console.log('🎵 Ready to play:', {
      title: playableTrack.title,
      artist: playableTrack.artist,
      hasAudio: !!playableTrack.audioSrc,
      hasArt: !!playableTrack.albumArtUrl,
    });
    
    return { success: true, track: playableTrack };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Complete workflow failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Validate that the HiFi API response matches expected format
 */
export function validateHiFiResponse(response: any): {
  isValid: boolean;
  issues: string[];
  data?: any;
} {
  const issues: string[] = [];
  
  if (!response) {
    issues.push('Response is null or undefined');
    return { isValid: false, issues };
  }
  
  // Check if it's an array (track endpoint returns array)
  if (Array.isArray(response)) {
    if (response.length === 0) {
      issues.push('Response array is empty');
    } else {
      // Look for streaming URL in array
      const hasStreamingUrl = response.some(item => item?.OriginalTrackUrl);
      if (!hasStreamingUrl) {
        issues.push('No OriginalTrackUrl found in response array');
      }
      
      // Check for basic track info
      const hasTrackInfo = response.some(item => item?.id && item?.title);
      if (!hasTrackInfo) {
        issues.push('No basic track info (id, title) found in response');
      }
    }
  } else if (typeof response === 'object') {
    // Single object response
    if (!response.id) {
      issues.push('Missing track ID');
    }
    if (!response.title) {
      issues.push('Missing track title');
    }
    if (!response.OriginalTrackUrl) {
      issues.push('Missing OriginalTrackUrl');
    }
  } else {
    issues.push('Response is not an object or array');
  }
  
  const isValid = issues.length === 0;
  
  console.log(`Validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
  if (issues.length > 0) {
    console.log('Issues found:', issues);
  }
  
  return { isValid, issues, data: response };
}

// Export to window for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testHiFiExample = testHiFiApiExample;
  (window as any).testCompleteWorkflow = testCompleteWorkflow;
  (window as any).validateHiFiResponse = validateHiFiResponse;
  
  console.log('🧪 HiFi API example functions loaded:');
  console.log('  - testHiFiExample() - Test with working example');
  console.log('  - testCompleteWorkflow("song name") - Full search→play workflow');
  console.log('  - validateHiFiResponse(data) - Validate API response format');
}
