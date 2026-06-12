import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';

const mockParseURL = jest.fn();

jest.unstable_mockModule('rss-parser', () => ({
  default: jest.fn().mockImplementation(() => ({
    parseURL: mockParseURL
  }))
}));

// Import everything dynamically AFTER mock is registered so the mock is
// in place when rssFetcher.js first loads and creates the Parser instance.
const {
  fetchAndParseRss,
  invalidateFeedCache,
  invalidateAllFeedCache,
  getFeedCacheStats,
  isFeedCached,
  getFeedCacheTtl
} = await import('../../src/services/rssFetcher.js');

describe('RSS Feed Cache', () => {
  beforeEach(() => {
    mockParseURL.mockReset();
    invalidateAllFeedCache();
  });

  it('uses md5 item IDs based on the fetched item data', async () => {
    mockParseURL.mockResolvedValueOnce({
      title: 'Example Feed',
      items: [
        {
          title: 'Item One',
          link: 'https://example.com/item-1',
          pubDate: 'Mon, 01 Jan 2026 00:00:00 GMT',
          content: 'Item body'
        }
      ]
    });

    const result = await fetchAndParseRss('https://example.com/feed.xml');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(
      crypto
        .createHash('md5')
        .update('Item Onehttps://example.com/item-1Mon, 01 Jan 2026 00:00:00 GMTItem body')
        .digest('hex')
    );
    expect(result.items[0].guid).toBe(result.items[0].id);
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = getFeedCacheStats();

      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.keys).toBe('number');
    });

    it('should start with empty cache', () => {
      const stats = getFeedCacheStats();
      expect(stats.keys).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific feed cache', () => {
      const feedUrl = 'https://example.com/feed';

      // Initially not cached
      expect(isFeedCached(feedUrl)).toBe(false);

      // Invalidate returns false when key doesn't exist
      expect(invalidateFeedCache(feedUrl)).toBe(false);
    });

    it('should invalidate all feed cache', () => {
      const count = invalidateAllFeedCache();
      expect(typeof count).toBe('number');

      const stats = getFeedCacheStats();
      expect(stats.keys).toBe(0);
    });
  });

  describe('Cache State Checks', () => {
    it('should check if feed is cached', () => {
      const feedUrl = 'https://example.com/uncached';
      expect(isFeedCached(feedUrl)).toBe(false);
    });

    it('should return null TTL for uncached feeds', () => {
      const feedUrl = 'https://example.com/uncached';
      expect(getFeedCacheTtl(feedUrl)).toBeNull();
    });
  });
});