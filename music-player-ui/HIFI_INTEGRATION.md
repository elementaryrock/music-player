# HiFi Tidal API Integration Guide

This document explains the integration of the new HiFi Tidal API endpoint (`https://hifi.401658.xyz/`) into the Glass Player music application.

## Overview

The HiFi Tidal API provides enhanced music streaming capabilities with better reliability and performance compared to the legacy endpoints. The integration includes:

- **Primary Endpoint**: `https://hifi.401658.xyz/`
- **Documentation**: `https://hifi.401658.xyz/tdoc`
- **Fallback Support**: Legacy endpoints for redundancy
- **Enhanced Error Handling**: Multi-tier fallback system

## Key Features

### 🎵 Enhanced API Endpoints
- **HiFi Primary**: Direct access to `https://hifi.401658.xyz/`
- **Vite Proxy**: Development proxy for CORS handling
- **Legacy Fallback**: `https://tidal.401658.xyz/` as backup
- **CORS Proxy**: `api.allorigins.win` for production fallback

### 🔄 Intelligent Fallback System
1. **Vite Proxy** (Development) - `/api/tidal` → `https://hifi.401658.xyz/`
2. **Direct HiFi API** - `https://hifi.401658.xyz/`
3. **Legacy API** - `https://tidal.401658.xyz/`
4. **CORS Proxy** - For production environments

### 📊 Health Monitoring
- Real-time endpoint health tracking
- Automatic endpoint switching on failures
- Performance metrics and response time monitoring
- Consecutive failure counting with recovery

## Configuration

### Vite Development Proxy

The `vite.config.ts` has been updated to proxy to the HiFi endpoint:

```typescript
"/api/tidal": {
  target: "https://hifi.401658.xyz",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/tidal/, ""),
  // ... additional configuration
}
```

### API Endpoint Priority

Endpoints are tried in this order:
1. **Vite Proxy (HiFi)** - `/api/tidal`
2. **Vite Proxy (Legacy)** - `/api/tidal-backup`
3. **Direct HiFi API** - `https://hifi.401658.xyz`
4. **Direct Legacy API** - `https://tidal.401658.xyz`
5. **CORS Proxy (HiFi)** - Via `api.allorigins.win`

## Testing & Diagnostics

### Browser Console Functions

The following functions are available in the browser console for testing:

```javascript
// Quick health check
await quickHiFiCheck()

// Full HiFi API test suite
await testHiFiTidal()

// Performance comparison
await compareHiFiVsLegacy()

// Test with working example (track ID 430965606)
await testHiFiExample()

// Complete search-to-play workflow
await testCompleteWorkflow("Blinding Lights")

// General Tidal API test
await testTidalSong("song name")

// Complete diagnostics
await runTidalDiagnostics()

// Validate API response format
validateHiFiResponse(responseData)
```

### Working Example Test

Based on your API call example, you can test the exact working scenario:

```javascript
// Test the exact API call from your example
const trackData = await getTidalTrackById(430965606, 'LOSSLESS');
console.log('Track data:', trackData);

// Expected response structure:
// [
//   { id: 430965606, title: "...", duration: ..., ... },
//   { OriginalTrackUrl: "https://...", ... }
// ]
```

### Test Results Interpretation

#### `testHiFiTidal()` Results:
- **Connection Test**: Basic API connectivity
- **Search Test**: Song search functionality
- **Song Retrieval**: Getting streaming URLs
- **Direct Search**: Complete workflow test

#### Health Check Status:
- ✅ **Healthy**: API responding normally
- ⚠️ **Degraded**: Some features working
- ❌ **Unhealthy**: API not responding

## API Usage Examples

### Basic Search
```typescript
import { searchTidalSongs } from './services/tidalApi';

const results = await searchTidalSongs('Taylor Swift', 10, 0);
console.log(`Found ${results?.items?.length || 0} results`);
```

### Get Track by ID (HiFi API Example)
```typescript
import { getTidalTrackById } from './services/tidalApi';

// Example from HiFi API: GET /track/?id=430965606&quality=LOSSLESS
const trackData = await getTidalTrackById(430965606, 'LOSSLESS');
if (trackData?.OriginalTrackUrl) {
  console.log('Streaming URL:', trackData.OriginalTrackUrl);
  // Response includes: streaming URL, track metadata, quality info
  
  // Example response structure:
  // [
  //   { id: 430965606, title: "Song Title", duration: 180, ... },
  //   { OriginalTrackUrl: "https://streaming-url.com/track.flac", ... }
  // ]
}
```

### Complete Search-to-Play Workflow
```typescript
import { searchTidalSongs, getTidalTrackById } from './services/tidalApi';

// 1. Search for songs
const searchResults = await searchTidalSongs('Blinding Lights', 5, 0);

if (searchResults?.items?.length > 0) {
  const firstTrack = searchResults.items[0];
  
  // 2. Get streaming URL using track ID
  const trackData = await getTidalTrackById(firstTrack.id, 'LOSSLESS');
  
  if (trackData?.OriginalTrackUrl) {
    // 3. Create playable track object
    const playableTrack = {
      id: firstTrack.id,
      title: firstTrack.title,
      artist: firstTrack.artist?.name || 'Unknown Artist',
      audioSrc: trackData.OriginalTrackUrl, // Ready to play!
      source: 'tidal',
    };
    
    console.log('🎵 Ready to play:', playableTrack);
  }
}
```

### Direct Song Search
```typescript
import { searchTidalSongDirect } from './services/tidalApi';

const track = await searchTidalSongDirect('Blinding Lights', 'LOSSLESS');
if (track) {
  console.log(`Playing: ${track.title} by ${track.artist}`);
  // track.audioSrc contains the streaming URL
}
```

### Health Monitoring
```typescript
import { getTidalEndpointHealth } from './services/tidalApi';

const health = getTidalEndpointHealth();
const healthyEndpoints = health.filter(h => h.isHealthy);
console.log(`${healthyEndpoints.length}/${health.length} endpoints healthy`);
```

## Error Handling

### Automatic Recovery
- **Endpoint Switching**: Automatically tries next endpoint on failure
- **Exponential Backoff**: Delays between retry attempts
- **Health Tracking**: Marks unhealthy endpoints for temporary avoidance
- **Graceful Degradation**: Falls back to available sources

### Error Types Handled
- **Network Timeouts**: 5-15 second timeouts with abort signals
- **HTTP Errors**: 4xx/5xx status codes with appropriate fallbacks
- **CORS Issues**: Automatic CORS proxy fallback
- **Malformed Responses**: JSON parsing error handling

## Performance Optimizations

### Response Time Monitoring
- Tracks response times for each endpoint
- Automatically prefers faster endpoints
- Provides performance comparison tools

### Caching Strategy
- Endpoint health status caching
- Connection test result caching
- Automatic cache invalidation on failures

### Resource Management
- Proper cleanup of AbortControllers
- Memory-efficient error tracking
- Optimized retry logic

## Troubleshooting

### Common Issues

#### 1. "All Tidal API endpoints failed"
**Cause**: Network connectivity or all endpoints down
**Solution**: 
- Check internet connection
- Run `quickHiFiCheck()` to test HiFi API
- Check firewall/proxy settings

#### 2. "No streaming URL found"
**Cause**: API returns metadata but no playable URL
**Solution**:
- Try different quality settings (HIGH instead of LOSSLESS)
- Check if track is available in your region
- Verify API endpoint is working correctly

#### 3. "Vite proxy not working"
**Cause**: Development server proxy configuration
**Solution**:
- Restart development server (`npm run dev`)
- Check `vite.config.ts` proxy configuration
- Verify HiFi endpoint is accessible

### Diagnostic Commands

```javascript
// Quick diagnosis
await runTidalDiagnostics().then(formatTidalDiagnostics)

// Auto-fix common issues
await autoFixTidal()

// Compare endpoint performance
await compareHiFiVsLegacy()
```

## Migration Notes

### From Legacy Implementation
- **No Breaking Changes**: All existing function signatures maintained
- **Enhanced Reliability**: Multi-endpoint fallback system
- **Better Error Handling**: Comprehensive error recovery
- **Performance Improvements**: Faster endpoint selection

### Configuration Updates
- **Vite Config**: Updated to use HiFi endpoint as primary
- **Endpoint Priority**: HiFi endpoints prioritized over legacy
- **Headers**: Enhanced headers for better compatibility

## Support

### Documentation
- **HiFi API Docs**: https://hifi.401658.xyz/tdoc
- **Legacy API Docs**: https://tidal.401658.xyz/tdoc

### Debugging
- Enable verbose logging in browser console
- Use diagnostic functions for detailed health reports
- Check network tab for actual API requests/responses

### Reporting Issues
When reporting issues, include:
1. Output from `testHiFiTidal()`
2. Browser console errors
3. Network connectivity status
4. Operating system and browser version

---

*This integration provides enterprise-grade reliability for Tidal music streaming with automatic fallback and comprehensive error handling.*