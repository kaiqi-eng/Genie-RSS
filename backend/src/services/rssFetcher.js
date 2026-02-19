import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('services:rssFetcher');

// Cache configuration
const CACHE_TTL = parseInt(process.env.RSS_CACHE_TTL) || 3600; // Default: 1 hour
const CACHE_CHECK_PERIOD = parseInt(process.env.RSS_CACHE_CHECK_PERIOD) || 600; // Default: 10 minutes

// Initialize cache
const feedCache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: CACHE_CHECK_PERIOD,
  useClones: true, // Return clones to prevent mutation
  deleteOnExpire: true
});

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/**
 * Fetch and parse an RSS feed with caching
 * @param {string} feedUrl - The URL of the RSS feed
 * @param {object} options - Options for fetching
 * @param {boolean} options.bypassCache - Skip cache and fetch fresh data
 * @returns {object} - Parsed feed data with cache metadata
 */
export async function fetchAndParseRss(feedUrl, options = {}) {
  const { bypassCache = false } = options;
  const cacheKey = `feed:${feedUrl}`;

  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cached = feedCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        _cache: {
          hit: true,
          key: cacheKey,
          ttl: feedCache.getTtl(cacheKey)
        }
      };
    }
  }

  try {
    const feed = await parser.parseURL(feedUrl);

    const parsedFeed = {
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      link: feed.link || feedUrl,
      language: feed.language || 'en',
      lastBuildDate: feed.lastBuildDate || null,
      items: (feed.items || []).map(item => ({
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || null,
        creator: item.creator || item.author || '',
        content: item.contentEncoded || item.content || item.contentSnippet || '',
        contentSnippet: item.contentSnippet || '',
        categories: item.categories || [],
        guid: item.guid || item.id || item.link,
        thumbnail: extractThumbnail(item)
      })),
      _fetchedAt: new Date().toISOString()
    };

    // Store in cache
    feedCache.set(cacheKey, parsedFeed);

    return {
      ...parsedFeed,
      _cache: {
        hit: false,
        key: cacheKey,
        ttl: feedCache.getTtl(cacheKey)
      }
    };
  } catch (error) {
    logger.error('Error fetching RSS feed', { feedUrl, error });
    throw new Error(`Failed to fetch RSS feed: ${error.message}`);
  }
}

/**
 * Extract thumbnail from feed item
 * @param {object} item - Feed item
 * @returns {string|null} - Thumbnail URL or null
 */
function extractThumbnail(item) {
  if (item.mediaContent && item.mediaContent.$) {
    return item.mediaContent.$.url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$) {
    return item.mediaThumbnail.$.url;
  }
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  return null;
}

// ============ Cache Management Functions ============

/**
 * Invalidate cache for a specific feed URL
 * @param {string} feedUrl - The feed URL to invalidate
 * @returns {boolean} - True if key was found and deleted
 */
export function invalidateFeedCache(feedUrl) {
  const cacheKey = `feed:${feedUrl}`;
  return feedCache.del(cacheKey) > 0;
}

/**
 * Invalidate all cached feeds
 * @returns {number} - Number of keys deleted
 */
export function invalidateAllFeedCache() {
  const keys = feedCache.keys();
  feedCache.flushAll();
  return keys.length;
}

/**
 * Get cache statistics
 * @returns {object} - Cache statistics
 */
export function getFeedCacheStats() {
  const stats = feedCache.getStats();
  return {
    keys: feedCache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits + stats.misses > 0
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%'
      : '0%',
    ksize: stats.ksize,
    vsize: stats.vsize
  };
}

/**
 * Check if a feed URL is cached
 * @param {string} feedUrl - The feed URL to check
 * @returns {boolean} - True if cached
 */
export function isFeedCached(feedUrl) {
  const cacheKey = `feed:${feedUrl}`;
  return feedCache.has(cacheKey);
}

/**
 * Get remaining TTL for a cached feed
 * @param {string} feedUrl - The feed URL to check
 * @returns {number|null} - Remaining TTL in milliseconds, or null if not cached
 */
export function getFeedCacheTtl(feedUrl) {
  const cacheKey = `feed:${feedUrl}`;
  const ttl = feedCache.getTtl(cacheKey);
  return ttl ? ttl - Date.now() : null;
}