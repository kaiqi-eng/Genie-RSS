import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  invalidateFeedCache,
  invalidateAllFeedCache,
  getFeedCacheStats,
  isFeedCached,
  getFeedCacheTtl
} from '../../src/services/rssFetcher.js';

describe('RSS Feed Cache', () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateAllFeedCache();
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
