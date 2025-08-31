/**
 * Tests for fixed Tidal API service
 */

import { 
  testTidalApiConnection,
  searchTidalSongs,
  getTidalSong,
  getTidalTrackById,
  searchAndGetTidalSongs,
  searchTidalSongDirect,
  getTidalEndpointHealth,
  resetTidalEndpointHealth,
} from '../tidalApiFixed';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  (AbortSignal as any).timeout = jest.fn((ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
}

describe('Fixed Tidal API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTidalEndpointHealth();
    
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('testTidalApiConnection', () => {
    it('should return success when an endpoint works', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'data' }),
      } as Response);

      const result = await testTidalApiConnection();

      expect(result.success).toBe(true);
      expect(result.endpoint).toBeDefined();
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].success).toBe(true);
    });

    it('should test all endpoints when first ones fail', async () => {
      // First endpoint fails
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ test: 'data' }),
        } as Response);

      const result = await testTidalApiConnection();

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(4);
      expect(result.diagnostics.slice(0, 3).every(d => !d.success)).toBe(true);
      expect(result.diagnostics[3].success).toBe(true);
    });

    it('should return failure when all endpoints fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await testTidalApiConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('All endpoints failed');
      expect(result.diagnostics.every(d => !d.success)).toBe(true);
    });

    it('should handle HTTP errors correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await testTidalApiConnection();

      expect(result.success).toBe(false);
      expect(result.diagnostics[0].error).toContain('404');
    });

    it('should measure response times', async () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ test: 'data' }),
          } as Response), 100)
        )
      );

      const result = await testTidalApiConnection();

      expect(result.success).toBe(true);
      expect(result.diagnostics[0].responseTime).toBeGreaterThan(90);
    });
  });

  describe('searchTidalSongs', () => {
    it('should search for songs successfully', async () => {
      const mockResponse = {
        items: [
          { id: 1, title: 'Test Song', artist: { name: 'Test Artist' } },
        ],
        totalNumberOfItems: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await searchTidalSongs('test query');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/?s=test%20query&limit=10&offset=0'),
        expect.any(Object)
      );
    });

    it('should handle search failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await searchTidalSongs('test query');

      expect(result).toBeNull();
    });

    it('should use custom limit and offset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response);

      await searchTidalSongs('test', 5, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=5&offset=10'),
        expect.any(Object)
      );
    });
  });

  describe('getTidalSong', () => {
    it('should get song with streaming URL', async () => {
      const mockSong = {
        id: 1,
        title: 'Test Song',
        OriginalTrackUrl: 'https://example.com/stream.flac',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSong,
      } as Response);

      const result = await getTidalSong('test song');

      expect(result).toEqual(mockSong);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/song/?q=test%20song&quality=LOSSLESS'),
        expect.any(Object)
      );
    });

    it('should handle array responses', async () => {
      const mockSong = {
        id: 1,
        title: 'Test Song',
        OriginalTrackUrl: 'https://example.com/stream.flac',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSong],
      } as Response);

      const result = await getTidalSong('test song');

      expect(result).toEqual(mockSong);
    });

    it('should handle different quality settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, title: 'Test' }),
      } as Response);

      await getTidalSong('test', 'HIGH');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('quality=HIGH'),
        expect.any(Object)
      );
    });
  });

  describe('getTidalTrackById', () => {
    it('should get track by ID with streaming URL', async () => {
      const mockResponse = [
        { id: 1, title: 'Test Song' },
        { OriginalTrackUrl: 'https://example.com/stream.flac' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getTidalTrackById(1);

      expect(result).toEqual({
        id: 1,
        title: 'Test Song',
        OriginalTrackUrl: 'https://example.com/stream.flac',
      });
    });

    it('should handle missing streaming URL', async () => {
      const mockResponse = [
        { id: 1, title: 'Test Song' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await getTidalTrackById(1);

      expect(result).toEqual(mockResponse);
    });

    it('should use custom quality and country', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{}],
      } as Response);

      await getTidalTrackById(1, 'HIGH', 'UK');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('quality=HIGH&country=UK'),
        expect.any(Object)
      );
    });
  });

  describe('searchAndGetTidalSongs', () => {
    it('should search and get complete tracks', async () => {
      // Mock search response
      const searchResponse = {
        items: [
          { id: 1, title: 'Test Song', artist: { name: 'Test Artist' } },
        ],
      };

      // Mock track response
      const trackResponse = [
        { id: 1, title: 'Test Song' },
        { OriginalTrackUrl: 'https://example.com/stream.flac' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => searchResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => trackResponse,
        } as Response);

      const result = await searchAndGetTidalSongs('test query');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Test Song',
        source: 'tidal',
      });
    });

    it('should handle empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      } as Response);

      const result = await searchAndGetTidalSongs('test query');

      expect(result).toEqual([]);
    });

    it('should skip tracks without streaming URLs', async () => {
      const searchResponse = {
        items: [
          { id: 1, title: 'Test Song 1' },
          { id: 2, title: 'Test Song 2' },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => searchResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1 }], // No streaming URL
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 2, title: 'Test Song 2' },
            { OriginalTrackUrl: 'https://example.com/stream.flac' },
          ],
        } as Response);

      const result = await searchAndGetTidalSongs('test query');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Test Song 2');
    });
  });

  describe('endpoint health tracking', () => {
    it('should track endpoint health', async () => {
      // Successful request should mark endpoint as healthy
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'data' }),
      } as Response);

      await testTidalApiConnection();

      const health = getTidalEndpointHealth();
      expect(health[0].isHealthy).toBe(true);
      expect(health[0].consecutiveFailures).toBe(0);
    });

    it('should mark endpoints as unhealthy after failures', async () => {
      // Multiple failures should mark endpoint as unhealthy
      mockFetch.mockRejectedValue(new Error('Network error'));

      await testTidalApiConnection();

      const health = getTidalEndpointHealth();
      expect(health.every(h => !h.isHealthy)).toBe(true);
    });

    it('should reset health status', () => {
      resetTidalEndpointHealth();

      const health = getTidalEndpointHealth();
      expect(health.every(h => h.isHealthy)).toBe(true);
      expect(health.every(h => h.consecutiveFailures === 0)).toBe(true);
    });
  });

  describe('error handling and retries', () => {
    it('should retry with different endpoints on failure', async () => {
      // First endpoint fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('First endpoint error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        } as Response);

      const result = await searchTidalSongs('test');

      expect(result).toEqual({ items: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await searchTidalSongs('test');

      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      const result = await searchTidalSongs('test');

      expect(result).toBeNull();
    });
  });

  describe('CORS proxy handling', () => {
    it('should build correct CORS proxy URLs', async () => {
      // Force all regular endpoints to fail to test CORS proxy
      mockFetch
        .mockRejectedValueOnce(new Error('Proxy failed'))
        .mockRejectedValueOnce(new Error('Proxy failed'))
        .mockRejectedValueOnce(new Error('Direct failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        } as Response);

      await searchTidalSongs('test');

      // Should eventually call CORS proxy
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('allorigins.win'),
        expect.any(Object)
      );
    });
  });

  describe('global debugging functions', () => {
    it('should expose debugging functions to window', () => {
      // Simulate browser environment
      const mockWindow = {} as any;
      (global as any).window = mockWindow;

      // Re-import to trigger window assignment
      jest.resetModules();
      require('../tidalApiFixed');

      expect(mockWindow.testTidalConnection).toBeDefined();
      expect(mockWindow.getTidalHealth).toBeDefined();
      expect(mockWindow.resetTidalHealth).toBeDefined();

      // Cleanup
      delete (global as any).window;
    });
  });
});