/**
 * Tests for HiFi Tidal API implementation
 */

import { testHiFiTidalAPI, quickHiFiHealthCheck, compareHiFiVsLegacy } from '../tidalHiFiTest';

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

describe('HiFi Tidal API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('testHiFiTidalAPI', () => {
    it('should run comprehensive HiFi API tests', async () => {
      // Mock successful responses for all test endpoints
      mockFetch
        // Connection test
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ test: 'connection successful' }),
        } as Response)
        // Search test
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { id: 1, title: 'Test Song', artist: { name: 'Test Artist' } },
            ],
          }),
        } as Response)
        // Song retrieval test
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 1,
            title: 'Test Song',
            OriginalTrackUrl: 'https://example.com/stream.flac',
          }),
        } as Response)
        // Direct search test - search call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              { id: 1, title: 'Test Song', artist: { name: 'Test Artist' } },
            ],
          }),
        } as Response)
        // Direct search test - track by ID call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 1, title: 'Test Song' },
            { OriginalTrackUrl: 'https://example.com/stream.flac' },
          ],
        } as Response);

      const result = await testHiFiTidalAPI();

      expect(result).toHaveProperty('endpoint', 'https://hifi.401658.xyz/');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('tests');
      expect(result).toHaveProperty('overall');

      // Check test structure
      expect(result.tests).toHaveProperty('connection');
      expect(result.tests).toHaveProperty('search');
      expect(result.tests).toHaveProperty('songRetrieval');
      expect(result.tests).toHaveProperty('directSearch');

      // All tests should be successful with our mocks
      expect(result.tests.connection.success).toBe(true);
      expect(result.tests.search.success).toBe(true);
      expect(result.tests.songRetrieval.success).toBe(true);
      expect(result.tests.directSearch.success).toBe(true);

      // Overall should be successful
      expect(result.overall.success).toBe(true);
      expect(result.overall.workingFeatures.length).toBeGreaterThan(0);
      expect(result.overall.failedFeatures.length).toBe(0);
    });

    it('should handle partial failures gracefully', async () => {
      // Mock mixed success/failure responses
      mockFetch
        // Connection test - success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ test: 'connection successful' }),
        } as Response)
        // Search test - failure
        .mockRejectedValueOnce(new Error('Search failed'))
        // Song retrieval test - success but no streaming URL
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 1,
            title: 'Test Song',
            // No OriginalTrackUrl
          }),
        } as Response)
        // Direct search test - failure
        .mockRejectedValueOnce(new Error('Direct search failed'));

      const result = await testHiFiTidalAPI();

      expect(result.tests.connection.success).toBe(true);
      expect(result.tests.search.success).toBe(false);
      expect(result.tests.songRetrieval.success).toBe(true);
      expect(result.tests.songRetrieval.hasStreamingUrl).toBe(false);
      expect(result.tests.directSearch.success).toBe(false);

      // Should have mixed results
      expect(result.overall.workingFeatures.length).toBeGreaterThan(0);
      expect(result.overall.failedFeatures.length).toBeGreaterThan(0);
      expect(result.overall.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle complete API failure', async () => {
      // Mock all requests to fail
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await testHiFiTidalAPI();

      expect(result.tests.connection.success).toBe(false);
      expect(result.tests.search.success).toBe(false);
      expect(result.tests.songRetrieval.success).toBe(false);
      expect(result.tests.directSearch.success).toBe(false);

      expect(result.overall.success).toBe(false);
      expect(result.overall.workingFeatures.length).toBe(0);
      expect(result.overall.failedFeatures.length).toBe(4);
      expect(result.overall.recommendations).toContain('All tests failed - the HiFi API may be down or have breaking changes');
    });
  });

  describe('quickHiFiHealthCheck', () => {
    it('should return true for healthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await quickHiFiHealthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hifi.401658.xyz/song/?q=test&quality=HIGH',
        expect.objectContaining({
          method: 'HEAD',
        })
      );
    });

    it('should return false for unhealthy API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await quickHiFiHealthCheck();

      expect(result).toBe(false);
    });

    it('should return false for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await quickHiFiHealthCheck();

      expect(result).toBe(false);
    });

    it('should treat 4xx errors as healthy (API is responding)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await quickHiFiHealthCheck();

      expect(result).toBe(true); // 404 < 500, so considered healthy
    });
  });

  describe('compareHiFiVsLegacy', () => {
    it('should compare both endpoints and determine winner', async () => {
      // Mock HiFi as faster and successful
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response);

      // Add delay to simulate different response times
      const originalFetch = mockFetch;
      mockFetch.mockImplementation((url) => {
        const delay = url.toString().includes('hifi') ? 100 : 200;
        return new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
          } as Response), delay)
        );
      });

      const result = await compareHiFiVsLegacy();

      expect(result).toHaveProperty('hifi');
      expect(result).toHaveProperty('legacy');
      expect(result).toHaveProperty('winner');

      expect(result.hifi.success).toBe(true);
      expect(result.legacy.success).toBe(true);
      expect(result.hifi.responseTime).toBeLessThan(result.legacy.responseTime);
      expect(result.winner).toBe('hifi');

      // Restore original mock
      mockFetch.mockImplementation(originalFetch);
    });

    it('should handle when only one endpoint works', async () => {
      // HiFi works, Legacy fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response)
        .mockRejectedValueOnce(new Error('Legacy API down'));

      const result = await compareHiFiVsLegacy();

      expect(result.hifi.success).toBe(true);
      expect(result.legacy.success).toBe(false);
      expect(result.winner).toBe('hifi');
    });

    it('should handle when both endpoints fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await compareHiFiVsLegacy();

      expect(result.hifi.success).toBe(false);
      expect(result.legacy.success).toBe(false);
      expect(result.winner).toBe('tie');
    });

    it('should make requests to correct endpoints', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await compareHiFiVsLegacy();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hifi.401658.xyz/song/?q=test&quality=HIGH',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://tidal.401658.xyz/song/?q=test&quality=HIGH',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await quickHiFiHealthCheck();

      expect(result).toBe(false);
    });

    it('should handle malformed responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      const result = await testHiFiTidalAPI();

      // Should handle the error gracefully
      expect(result).toHaveProperty('tests');
      expect(result.overall.success).toBe(false);
    });
  });

  describe('global function exposure', () => {
    it('should expose functions to window object', () => {
      // Simulate browser environment
      const mockWindow = {} as any;
      (global as any).window = mockWindow;

      // Re-import to trigger window assignment
      jest.resetModules();
      require('../tidalHiFiTest');

      expect(mockWindow.testHiFiTidal).toBeDefined();
      expect(mockWindow.quickHiFiCheck).toBeDefined();
      expect(mockWindow.compareHiFiVsLegacy).toBeDefined();

      // Cleanup
      delete (global as any).window;
    });
  });
});