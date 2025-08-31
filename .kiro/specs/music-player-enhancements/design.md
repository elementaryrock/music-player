# Design Document

## Overview

This design document outlines the architecture and implementation approach for enhancing the existing React-based music player application. The enhancements focus on three core areas: fixing search functionality, restoring Tidal API integration, and implementing modern UI with audio visualizations.

The current application uses React with TypeScript, integrates with JioSaavn and Tidal APIs, and includes components for playback controls, lyrics display, and playlist management. The design will build upon this existing foundation while introducing new visual elements and improving reliability.

## Architecture

### Current Architecture Analysis

The application follows a component-based React architecture with:
- **Main App Component**: Manages global state and orchestrates child components
- **Service Layer**: API integrations for JioSaavn (`api.ts`) and Tidal (`tidalApi.ts`)
- **Component Layer**: Modular UI components for different player functions
- **Type System**: TypeScript interfaces for API responses and internal data structures
- **Styling**: CSS modules with glassmorphism design patterns

### Enhanced Architecture

The enhanced architecture will maintain the existing structure while adding:

```
src/
├── components/
│   ├── visualizer/           # New visualizer components
│   │   ├── AudioVisualizer.tsx
│   │   ├── SpectrumAnalyzer.tsx
│   │   └── WaveformDisplay.tsx
│   ├── search/              # Enhanced search components
│   │   ├── SearchBar.tsx    # Enhanced existing
│   │   ├── SearchResults.tsx # Enhanced existing
│   │   ├── SearchSuggestions.tsx # New
│   │   └── SearchFilters.tsx # New
│   └── ui/                  # Enhanced UI components
│       ├── AnimatedBackground.tsx
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── services/
│   ├── audioContext.ts      # Web Audio API integration
│   ├── visualizerEngine.ts  # Audio analysis engine
│   └── searchEngine.ts      # Enhanced search logic
├── hooks/
│   ├── useAudioAnalyzer.ts  # Audio analysis hook
│   ├── useSearchDebounce.ts # Search optimization
│   └── useApiRetry.ts       # API reliability
└── utils/
    ├── audioUtils.ts        # Audio processing utilities
    └── animationUtils.ts    # Animation helpers
```

## Components and Interfaces

### 1. Audio Visualizer System

#### AudioVisualizer Component
```typescript
interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  visualizerType: 'spectrum' | 'waveform' | 'circular';
  theme: 'default' | 'neon' | 'minimal';
  sensitivity: number;
  showFPS?: boolean;
}
```

**Responsibilities:**
- Initialize Web Audio API context
- Analyze audio frequency data in real-time
- Render visualizations using Canvas API or WebGL
- Provide smooth animations with requestAnimationFrame
- Handle different visualization modes

#### SpectrumAnalyzer Component
```typescript
interface SpectrumAnalyzerProps {
  analyzerNode: AnalyserNode;
  width: number;
  height: number;
  barCount: number;
  colorScheme: string[];
  smoothingTimeConstant: number;
}
```

**Features:**
- Real-time frequency spectrum analysis
- Customizable bar count and colors
- Smooth transitions between frequency changes
- Responsive design for different screen sizes

### 2. Enhanced Search System

#### SearchEngine Service
```typescript
interface SearchEngineConfig {
  debounceMs: number;
  maxResults: number;
  enableSuggestions: boolean;
  sources: ('jiosaavn' | 'tidal')[];
}

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  source: 'jiosaavn' | 'tidal';
  imageUrl?: string;
  audioUrl?: string;
  confidence: number; // Relevance score
}
```

**Capabilities:**
- Debounced search to reduce API calls
- Parallel API requests to multiple sources
- Result deduplication and ranking
- Search history and suggestions
- Error handling with fallback mechanisms

#### SearchSuggestions Component
```typescript
interface SearchSuggestionsProps {
  query: string;
  onSuggestionSelect: (suggestion: string) => void;
  recentSearches: string[];
  popularSearches: string[];
}
```

### 3. Enhanced Tidal Integration

#### TidalApiService (Enhanced)
```typescript
interface TidalApiConfig {
  endpoints: string[];
  retryAttempts: number;
  timeoutMs: number;
  qualityPreference: TidalQuality[];
}

interface TidalTrackWithUrl extends TidalTrack {
  streamingUrl: string;
  actualQuality: TidalQuality;
  expiresAt: Date;
}
```

**Improvements:**
- Multiple endpoint fallback system
- Automatic quality detection based on browser support
- URL caching with expiration handling
- Connection health monitoring
- Retry logic with exponential backoff

### 4. UI Enhancement System

#### AnimatedBackground Component
```typescript
interface AnimatedBackgroundProps {
  albumArt?: string;
  isPlaying: boolean;
  audioData?: Uint8Array;
  effectType: 'blur' | 'particles' | 'gradient';
  intensity: number;
}
```

**Features:**
- Dynamic background based on album art
- Audio-reactive background effects
- Smooth transitions between tracks
- Performance-optimized animations

## Data Models

### Enhanced Track Interface
```typescript
interface EnhancedTrack extends Track {
  // Existing properties maintained
  
  // New properties
  searchMetadata?: {
    query: string;
    confidence: number;
    searchTimestamp: Date;
  };
  
  audioAnalysis?: {
    tempo?: number;
    key?: string;
    loudness?: number;
    danceability?: number;
  };
  
  playbackHistory?: {
    playCount: number;
    lastPlayed?: Date;
    skipCount: number;
  };
  
  qualityInfo?: {
    availableQualities: string[];
    currentQuality: string;
    bitrate?: number;
    format?: string;
  };
}
```

### Search State Management
```typescript
interface SearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  suggestions: string[];
  filters: {
    source: 'all' | 'jiosaavn' | 'tidal';
    duration: 'any' | 'short' | 'medium' | 'long';
    quality: 'any' | 'high' | 'lossless';
  };
  history: string[];
}
```

## Error Handling

### API Error Recovery
```typescript
interface ApiErrorHandler {
  handleJioSaavnError(error: Error, context: string): Promise<void>;
  handleTidalError(error: Error, context: string): Promise<void>;
  handleNetworkError(error: Error): Promise<void>;
  showUserFriendlyError(message: string, action?: string): void;
}
```

**Strategy:**
- Graceful degradation when APIs fail
- Automatic retry with exponential backoff
- User-friendly error messages
- Fallback to alternative sources
- Offline mode with cached content

### Audio Error Handling
```typescript
interface AudioErrorHandler {
  handleLoadError(track: Track): Promise<Track | null>;
  handlePlaybackError(error: MediaError): void;
  handleFormatUnsupported(track: Track): Promise<Track | null>;
  suggestAlternativeQuality(track: Track): string[];
}
```

## Testing Strategy

### Unit Testing
- **Component Testing**: React Testing Library for UI components
- **Service Testing**: Jest for API services and utilities
- **Hook Testing**: React Hooks Testing Library for custom hooks
- **Audio Testing**: Mock Web Audio API for visualizer components

### Integration Testing
- **API Integration**: Test actual API endpoints with rate limiting
- **Audio Playback**: Test different audio formats and qualities
- **Search Flow**: End-to-end search and playback testing
- **Error Scenarios**: Network failures and API errors

### Performance Testing
- **Visualizer Performance**: Frame rate monitoring and optimization
- **Memory Usage**: Audio buffer and canvas memory management
- **API Response Times**: Search and streaming latency testing
- **Bundle Size**: Code splitting and lazy loading verification

### Browser Compatibility Testing
- **Audio Format Support**: Test across different browsers
- **Web Audio API**: Fallbacks for unsupported features
- **Canvas Performance**: Hardware acceleration detection
- **Mobile Responsiveness**: Touch interactions and performance

## Performance Considerations

### Audio Visualizer Optimization
- Use `requestAnimationFrame` for smooth animations
- Implement canvas pooling to reduce garbage collection
- Use Web Workers for heavy audio analysis
- Implement adaptive quality based on device performance
- Cache frequency data to reduce redundant calculations

### Search Performance
- Debounce user input to reduce API calls
- Implement result caching with TTL
- Use virtual scrolling for large result sets
- Preload popular search results
- Implement progressive loading for images

### Memory Management
- Dispose of audio contexts when not needed
- Clean up event listeners and timers
- Implement proper component unmounting
- Use weak references for large objects
- Monitor and limit cache sizes

### Network Optimization
- Implement request deduplication
- Use HTTP/2 multiplexing where available
- Compress API responses
- Implement progressive audio loading
- Cache static assets with service workers

## Security Considerations

### API Security
- Validate all API responses before processing
- Sanitize user input for search queries
- Implement rate limiting for API calls
- Use HTTPS for all external requests
- Handle CORS properly for cross-origin requests

### Audio Security
- Validate audio URLs before loading
- Implement content security policy
- Prevent XSS through audio metadata
- Sanitize lyrics and track information
- Implement proper error boundaries

### Data Privacy
- Minimize data collection and storage
- Implement proper consent mechanisms
- Secure local storage of user preferences
- Handle user data according to privacy regulations
- Provide data export and deletion options