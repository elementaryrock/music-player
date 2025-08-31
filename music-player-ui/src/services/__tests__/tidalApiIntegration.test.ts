/**
 * Tidal API Integration Tests
 * 
 * Tests for the enhanced HiFi Tidal API integration with connection monitoring
 */

import {
  testTidalApiConnection,
  searchTidalSongs,
  getTidalTrackById,
  searchTidalSongDirect,
  getTidalEndpointHealth,
  resetTidalEndpointHealth,
  runTidalDiagnostics,
  autoFixTidalIssues,
} from '../tidalApiFixed';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Tidal API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTidalEndpointHealth();
  });

  describe('Connection Testing', () => {
    it('should test all endpoints and return diagnostics', async () => {
      // Mock successful response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 123, title: 'Test Song' }]
        }),
      });

      const result = await testTidalApiConnection();

      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(5); // Should test all 5 endpoints
      expect(result.endpoint).toBeDefined();
    });

    it('should handle connection failures gracefully', async () => {
      // Mock failed responses
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await testTidalApiConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('All endpoints failed');
      expect(result.diagnostics).toHaveLength(5);
    });
  });

  describe('Search Functionality', () => {
    it('should search for songs successfully', async () => {
      const mockResponse = {
        items: [
          {
            id: 123456789,
            title: 'Test Song',
            artist: { name: 'Test Artist' },
            album: { title: 'Test Album' },
            duration: 180,
          }
        ],
        totalNumberOfItems: 1,
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchTidalSongs('test query', 10, 0);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/?s=test%20query&limit=10&offset=0'),
        expect.any(Object)
      );
    });

    it('should handle search failures', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const result = await searchTidalSongs('test query');

      expect(result).toBeNull();
    });
  });

  describe('Track Retrieval', () => {
    it('should get track by ID with streaming URL', async () => {
      const mockResponse = [
        {
          id: 123456789,
          title: 'Test Song',
          artist: { name: 'Test Artist' },
        },
        {
          OriginalTrackUrl: 'https://streaming-url.com/track.flac',
        }
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getTidalTrackById(123456789, 'LOSSLESS');

      expect(result).toEqual({
        id: 123456789,
        title: 'Test Song',
        artist: { name: 'Test Artist' },
        OriginalTrackUrl: 'https://streaming-url.com/track.flac',
      });
    });

    it('should handle missing streaming URL', async () => {
      const mockResponse = [
        {
          id: 123456789,
          title: 'Test Song',
        }
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getTidalTrackById(123456789, 'LOSSLESS');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Direct Song Search', () => {
    it('should perform complete search-to-track workflow', async () => {
      // Mock search response
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 123456789,
                title: 'Blinding Lights',
                artist: { name: 'The Weeknd' },
                album: { title: 'After Hours' },
                duration: 200,
              }
            ],
          }),
        })
        // Mock track by ID response
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 123456789,
              title: 'Blinding Lights',
            },
            {
              OriginalTrackUrl: 'https://streaming-url.com/track.flac',
            }
          ],
        })
        // Mock lyrics response (optional)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              subtitles: 'Test lyrics content',
            }
          ],
        });

      const result = await searchTidalSongDirect('Blinding Lights', 'LOSSLESS');

      expect(result).toBeDefined();
      expect(result?.title).toBe('Blinding Lights');
      expect(result?.artist).toBe('The Weeknd');
      expect(result?.audioSrc).toBe('https://streaming-url.com/track.flac');
      expect(result?.source).toBe('tidal');
    });
  });

  describe('Health Monitoring', () => {
    it('should track endpoint health', () => {
      const health = getTidalEndpointHealth();

      expect(health).toHaveLength(5);
      expect(health[0]).toHaveProperty('name');
      expect(health[0]).toHaveProperty('isHealthy');
      expect(health[0]).toHaveProperty('consecutiveFailures');
    });

    it('should reset endpoint health', () => {
      resetTidalEndpointHealth();
      const health = getTidalEndpointHealth();

      health.forEach(endpoint => {
        expect(endpoint.isHealthy).toBe(true);
        expect(endpoint.consecutiveFailures).toBe(0);
      });
    });
  });

  describe('Diagnostics', () => {
    it('should run comprehensive diagnostics', async () => {
      // Mock successful responses for diagnostics
      (fetch as jest.Mock)
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            items: [{ id: 123, title: 'Test' }]
          }),
        });

      const result = await runTidalDiagnostics();

      expect(result.overall).toHaveProperty('success');
      expect(result.overall).toHaveProperty('workingEndpoints');
      expect(result.overall).toHaveProperty('totalEndpoints');
      expect(result.endpoints).toHaveLength(5);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should provide auto-fix functionality', async () => {
      // Mock successful connection after reset
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 123, title: 'Test' }]
        }),
      });

      const result = await autoFixTidalIssues();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('actionsPerformed');
      expect(result).toHaveProperty('remainingIssues');
      expect(result.actionsPerformed).toContain('Reset endpoint health status');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      (fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await searchTidalSongs('test');
      expect(result).toBeNull();
    });

    it('should handle malformed JSON responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await searchTidalSongs('test');
      expect(result).toBeNull();
    });

    it('should handle HTTP error status codes', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await searchTidalSongs('test');
      expect(result).toBeNull();
    });
  });
});

describe('Integration with HiFi API', () => {
  it('should prioritize HiFi endpoints', () => {
    const health = getTidalEndpointHealth();
    
    // HiFi API should be in the list
    const hifiEndpoint = health.find(h => h.name.includes('HiFi'));
    expect(hifiEndpoint).toBeDefined();
  });

  it('should handle HiFi API response format', async () => {
    // Mock HiFi API response format (array with track info and streaming URL)
    const mockHiFiResponse = [
      {
        id: 430965606,
        title: "That's So True",
        duration: 180,
      },
      {
        OriginalTrackUrl: 'https://streaming-url.tidal.com/track.flac',
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHiFiResponse,
    });

    const result = await getTidalTrackById(430965606, 'LOSSLESS');

    expect(result).toEqual({
      id: 430965606,
      title: "That's So True",
      duration: 180,
      OriginalTrackUrl: 'https://streaming-url.tidal.com/track.flac',
    });
  });
});