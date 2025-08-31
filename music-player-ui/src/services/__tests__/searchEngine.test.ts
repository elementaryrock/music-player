/**
 * Unit tests for SearchEngine
 */

import { SearchEngine, SearchResult } from '../searchEngine';

// Mock the API services
jest.mock('../api', () => ({
  searchSongs: jest.fn(),
  searchCombined: jest.fn(),
}));

jest.mock('../tidalApi', () => ({
  searchTidalSongs: jest.fn(),
  searchAndGetTidalSongs: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SearchEngine', () => {
  let searchEngine: SearchEngine;
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    searchEngine = new SearchEngine({
      debounceMs: 0, // Disable debouncing for tests
      maxResults: 10,
      sources: ['jiosaavn', 'tidal'],
      cacheTimeout: 1000,
      retryAttempts: 1, // Reduce retries for faster tests
    });
  });

  afterEach(() => {
    searchEngine.destroy();
  });

  describe('search', () => {
    it('should return empty array for empty query', async () => {
      const results = await searchEngine.search('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const results = await searchEngine.search('   ');
      expect(results).toEqual([]);
    });

    it('should search JioSaavn when source is included', async () => {
      const mockJioSaavnResponse = {
        results: [
          {
            id: 'test1',
            name: 'Test Song',
            primaryArtists: 'Test Artist',
            album: { name: 'Test Album' },
            duration: '180',
            image: [{ link: 'test-image.jpg' }],
            downloadUrl: [{ link: 'test-audio.mp3' }],
          },
        ],
      };

      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(mockJioSaavnResponse);

      const results = await searchEngine.search('test query', { sources: ['jiosaavn'] });

      expect(searchSongs).toHaveBeenCalledWith('test query', 0, 10);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'jiosaavn_test1',
        title: 'Test Song',
        artist: 'Test Artist',
        source: 'jiosaavn',
      });
    });

    it('should search Tidal when source is included', async () => {
      const mockTidalTracks = [
        {
          id: 'tidal1',
          title: 'Tidal Song',
          artist: 'Tidal Artist',
          album: 'Tidal Album',
          duration: 200,
          albumArtUrl: 'tidal-image.jpg',
          audioSrc: 'tidal-audio.flac',
        },
      ];

      const { searchAndGetTidalSongs } = require('../tidalApi');
      searchAndGetTidalSongs.mockResolvedValue(mockTidalTracks);

      const results = await searchEngine.search('test query', { sources: ['tidal'] });

      expect(searchAndGetTidalSongs).toHaveBeenCalledWith('test query', 'LOSSLESS', 10);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'tidal_tidal1',
        title: 'Tidal Song',
        artist: 'Tidal Artist',
        source: 'tidal',
      });
    });

    it('should handle API errors gracefully', async () => {
      const { searchSongs } = require('../api');
      const { searchAndGetTidalSongs } = require('../tidalApi');
      
      searchSongs.mockRejectedValue(new Error('JioSaavn API error'));
      searchAndGetTidalSongs.mockRejectedValue(new Error('Tidal API error'));

      // Should not throw, but return empty results
      const results = await searchEngine.search('test query');
      expect(results).toEqual([]);
    });

    it('should deduplicate similar results', async () => {
      const mockJioSaavnResponse = {
        results: [
          {
            id: 'test1',
            name: 'Test Song',
            primaryArtists: 'Test Artist',
            album: { name: 'Test Album' },
            duration: '180',
          },
        ],
      };

      const mockTidalTracks = [
        {
          id: 'tidal1',
          title: 'Test Song', // Same title
          artist: 'Test Artist', // Same artist
          album: 'Test Album',
          duration: 180,
        },
      ];

      const { searchSongs } = require('../api');
      const { searchAndGetTidalSongs } = require('../tidalApi');
      
      searchSongs.mockResolvedValue(mockJioSaavnResponse);
      searchAndGetTidalSongs.mockResolvedValue(mockTidalTracks);

      const results = await searchEngine.search('test query');

      // Should only return one result (the one with higher confidence)
      expect(results).toHaveLength(1);
    });
  });

  describe('caching', () => {
    it('should cache search results', async () => {
      const mockResponse = { results: [{ id: 'test1', name: 'Test Song' }] };
      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(mockResponse);

      // First search
      await searchEngine.search('test query', { sources: ['jiosaavn'] });
      expect(searchSongs).toHaveBeenCalledTimes(1);

      // Second search should use cache
      await searchEngine.search('test query', { sources: ['jiosaavn'] });
      expect(searchSongs).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should respect forceRefresh option', async () => {
      const mockResponse = { results: [{ id: 'test1', name: 'Test Song' }] };
      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(mockResponse);

      // First search
      await searchEngine.search('test query', { sources: ['jiosaavn'] });
      expect(searchSongs).toHaveBeenCalledTimes(1);

      // Force refresh should bypass cache
      await searchEngine.search('test query', { sources: ['jiosaavn'], forceRefresh: true });
      expect(searchSongs).toHaveBeenCalledTimes(2);
    });
  });

  describe('search history', () => {
    it('should add queries to history', async () => {
      const mockResponse = { results: [] };
      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(mockResponse);

      await searchEngine.search('test query 1', { sources: ['jiosaavn'] });
      await searchEngine.search('test query 2', { sources: ['jiosaavn'] });

      const history = searchEngine.getHistory();
      expect(history).toEqual(['test query 2', 'test query 1']);
    });

    it('should not duplicate queries in history', async () => {
      const mockResponse = { results: [] };
      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(mockResponse);

      await searchEngine.search('test query', { sources: ['jiosaavn'] });
      await searchEngine.search('test query', { sources: ['jiosaavn'] });

      const history = searchEngine.getHistory();
      expect(history).toEqual(['test query']);
    });

    it('should save and load history from localStorage', () => {
      const savedHistory = ['saved query 1', 'saved query 2'];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedHistory));

      const newEngine = new SearchEngine();
      expect(newEngine.getHistory()).toEqual(savedHistory);
    });
  });

  describe('suggestions', () => {
    it('should return history items for empty query', () => {
      // Add some history
      searchEngine['searchHistory'] = ['query 1', 'query 2', 'query 3'];
      
      const suggestions = searchEngine.getSuggestions('');
      expect(suggestions).toEqual(['query 1', 'query 2', 'query 3']);
    });

    it('should return matching history items for partial query', () => {
      searchEngine['searchHistory'] = ['taylor swift', 'ed sheeran', 'taylor nation'];
      
      const suggestions = searchEngine.getSuggestions('taylor');
      expect(suggestions).toEqual(['taylor swift', 'taylor nation']);
    });

    it('should include popular searches when needed', () => {
      const suggestions = searchEngine.getSuggestions('taylor');
      expect(suggestions).toContain('Taylor Swift');
    });
  });

  describe('confidence calculation', () => {
    it('should give higher confidence to exact title matches', () => {
      const exactMatch = {
        title: 'test song',
        name: 'test song',
        artist: 'artist',
        primaryArtists: 'artist',
      };

      const partialMatch = {
        title: 'test song remix',
        name: 'test song remix',
        artist: 'artist',
        primaryArtists: 'artist',
      };

      const exactConfidence = searchEngine['calculateConfidence'](exactMatch, 'test song', 0);
      const partialConfidence = searchEngine['calculateConfidence'](partialMatch, 'test song', 0);

      expect(exactConfidence).toBeGreaterThan(partialConfidence);
    });

    it('should consider position in results', () => {
      const item = {
        title: 'test song',
        name: 'test song',
        artist: 'artist',
        primaryArtists: 'artist',
      };

      const firstPosition = searchEngine['calculateConfidence'](item, 'test song', 0);
      const laterPosition = searchEngine['calculateConfidence'](item, 'test song', 10);

      expect(firstPosition).toBeGreaterThan(laterPosition);
    });
  });

  describe('utility methods', () => {
    it('should extract artist names from various formats', () => {
      const testCases = [
        { input: { primaryArtists: 'Primary Artist' }, expected: 'Primary Artist' },
        { input: { artist: 'Artist Name' }, expected: 'Artist Name' },
        { input: { artists: ['Artist 1', 'Artist 2'] }, expected: 'Artist 1' },
        { input: { artists: [{ name: 'Artist Object' }] }, expected: 'Artist Object' },
        { input: { featuredArtists: 'Featured Artist' }, expected: 'Featured Artist' },
        { input: { singers: 'Singer Name' }, expected: 'Singer Name' },
        { input: {}, expected: 'Unknown Artist' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = searchEngine['extractArtistName'](input);
        expect(result).toBe(expected);
      });
    });

    it('should create consistent dedupe keys', () => {
      const key1 = searchEngine['createDedupeKey']('Test Song!', 'Test Artist');
      const key2 = searchEngine['createDedupeKey']('test song', 'test artist');
      const key3 = searchEngine['createDedupeKey']('Test  Song', 'Test   Artist');

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });

  describe('error handling', () => {
    it('should handle malformed API responses', async () => {
      const { searchSongs } = require('../api');
      searchSongs.mockResolvedValue(null); // Malformed response

      const results = await searchEngine.search('test query', { sources: ['jiosaavn'] });
      expect(results).toEqual([]);
    });

    it('should handle network timeouts', async () => {
      const { searchSongs } = require('../api');
      searchSongs.mockImplementation(() => new Promise(() => {})); // Never resolves

      // This should eventually timeout or be aborted
      const searchPromise = searchEngine.search('test query', { sources: ['jiosaavn'] });
      
      // Simulate abort
      searchEngine.destroy();
      
      await expect(searchPromise).resolves.toEqual([]);
    });
  });
});