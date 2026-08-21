import Parser from 'rss-parser';
import axios from 'axios';
import NodeCache from 'node-cache';
import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger.js';
import { cache, timeouts } from '../config/index.js';

const logger = createLogger('services:rssFetcher');
const MINIMUM_CONTENT_LENGTH = 10;
const ARTICLE_EXTRACTION_METHOD = 'json-ld.articleBody > cnbc-article-body-selector > metadata-description';

// Initialize cache with centralized config
const feedCache = new NodeCache({
  stdTTL: cache.rssTtl,
  checkperiod: cache.rssCheckPeriod,
  useClones: true, // Return clones to prevent mutation
  deleteOnExpire: true
});

const parser = new Parser({
  timeout: timeouts.rssFetch,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:description', 'mediaDescription'],
      ['media:group', 'mediaGroup'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/**
 * Fetch and parse an RSS feed with caching
 * @param {string} feedUrl - The URL of the RSS feed
 * @param {object} options - Options for fetching
 * @param {boolean} options.bypassCache - Skip cache and fetch fresh data
 * @param {string} options.since - Optional ISO datetime to filter recent items
 * @returns {object} - Parsed feed data with cache metadata
 */
export async function fetchAndParseRss(feedUrl, options = {}) {
  const { bypassCache = false, since } = options;
  const normalizedSince = since ? new Date(since).toISOString() : null;
  const sinceTimestamp = normalizedSince ? Date.parse(normalizedSince) : null;
  const cacheKey = normalizedSince
    ? `feed:${feedUrl}:since:${normalizedSince}`
    : `feed:${feedUrl}:since:none`;

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
    const feed = await parseFeedWithFallback(feedUrl);

    const mappedResults = await Promise.all((feed.items || []).map(async item => {
      const feedContent = extractContent(item);
      const baseItem = {
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || null,
        creator: item.creator || item.author || '',
        categories: item.categories || [],
        guid: item.guid || item.id || item.link,
        thumbnail: extractThumbnail(item)
      };

      if (hasSufficientContent(feedContent)) {
        return {
          item: {
            ...baseItem,
            content: feedContent,
            contentSnippet: item.contentSnippet || feedContent.substring(0, 200)
          }
        };
      }

      const enrichment = await enrichLinkOnlyItem(baseItem);
      if (enrichment.failure) {
        return { failure: enrichment.failure };
      }

      return {
        item: {
          ...baseItem,
          content: enrichment.content,
          contentSnippet: enrichment.content.substring(0, 200),
          extractionMethod: enrichment.method
        }
      };
    }));

    const mappedItems = mappedResults
      .filter(result => result.item)
      .map(result => result.item);
    const itemFailures = mappedResults
      .filter(result => result.failure)
      .map(result => result.failure);

    const items = sinceTimestamp === null
      ? mappedItems
      : mappedItems.filter(item => {
        if (!item.pubDate) return false;
        const itemTimestamp = Date.parse(item.pubDate);
        if (Number.isNaN(itemTimestamp)) return false;
        return itemTimestamp >= sinceTimestamp;
      });

    const parsedFeed = {
      title: feed.title || 'Untitled Feed',
      description: feed.description || '',
      link: feed.link || feedUrl,
      language: feed.language || 'en',
      lastBuildDate: feed.lastBuildDate || null,
      items,
      itemFailures,
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

async function parseFeedWithFallback(feedUrl) {
  try {
    return await parser.parseURL(feedUrl);
  } catch (error) {
    // Some feeds are served gzip-compressed behind redirects and can fail in parseURL.
    const message = String(error?.message || '');
    const looksLikeXmlParseFailure =
      message.includes('Unable to parse XML') ||
      message.includes('Non-whitespace before first tag');

    if (!looksLikeXmlParseFailure) {
      throw error;
    }

    const response = await axios.get(feedUrl, {
      timeout: timeouts.rssFetch,
      responseType: 'text',
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    return await parser.parseString(response.data);
  }
}

/**
 * Extract thumbnail from feed item
 * @param {object} item - Feed item
 * @returns {string|null} - Thumbnail URL or null
 */
function extractThumbnail(item) {
  const mediaContent = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent;
  const mediaThumbnail = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail;

  if (mediaContent && mediaContent.$) {
    return mediaContent.$.url;
  }
  if (mediaThumbnail && mediaThumbnail.$) {
    return mediaThumbnail.$.url;
  }

  const mediaGroup = extractMediaGroup(item);
  const groupThumbnail = Array.isArray(mediaGroup?.['media:thumbnail'])
    ? mediaGroup['media:thumbnail'][0]
    : mediaGroup?.['media:thumbnail'] || mediaGroup?.mediaThumbnail;
  if (groupThumbnail && groupThumbnail.$?.url) {
    return groupThumbnail.$.url;
  }

  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  return null;
}

function extractContent(item) {
  return cleanText(
    item.contentEncoded ||
    item.content ||
    extractMediaDescription(item) ||
    item.contentSnippet ||
    ''
  );
}

async function enrichLinkOnlyItem(item) {
  const diagnostics = {
    guid: item.guid || null,
    url: item.link || null,
    httpStatus: null,
    extractionMethod: ARTICLE_EXTRACTION_METHOD,
    responseBodySize: 0,
    extractedContentLength: 0
  };

  if (!item.link) {
    return {
      failure: {
        ...diagnostics,
        reason: 'RSS item has insufficient content and no article URL to enrich.'
      }
    };
  }

  try {
    const response = await axios.get(item.link, {
      timeout: timeouts.rssFetch,
      responseType: 'text',
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const html = typeof response.data === 'string' ? response.data : String(response.data || '');
    diagnostics.httpStatus = response.status;
    diagnostics.responseBodySize = Buffer.byteLength(html, 'utf8');

    const extracted = extractArticleContent(html);
    diagnostics.extractedContentLength = extracted.content.length;
    if (!hasSufficientContent(extracted.content)) {
      return {
        failure: {
          ...diagnostics,
          reason: 'Article response did not contain at least 10 characters of readable content.'
        }
      };
    }

    return extracted;
  } catch (error) {
    const responseBody = error.response?.data;
    const responseText = typeof responseBody === 'string' ? responseBody : '';
    return {
      failure: {
        ...diagnostics,
        httpStatus: error.response?.status || null,
        responseBodySize: Buffer.byteLength(responseText, 'utf8'),
        reason: error.message || 'Article fetch failed.'
      }
    };
  }
}

function extractArticleContent(html) {
  const $ = cheerio.load(html);
  const jsonLdContent = extractJsonLdArticleBody($);
  if (hasSufficientContent(jsonLdContent)) {
    return { content: jsonLdContent, method: 'json-ld.articleBody' };
  }

  const cnbcSelector = [
    '.ArticleBody-articleBody',
    '.ArticleBodyWrapper',
    '[data-testid="article-body"]',
    '[data-module="ArticleBody"]'
  ].find(selector => hasSufficientContent(cleanText($(selector).text())));
  if (cnbcSelector) {
    return {
      content: cleanText($(cnbcSelector).text()),
      method: `cnbc-selector:${cnbcSelector}`
    };
  }

  const metadataDescription = cleanText(
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    ''
  );
  return { content: metadataDescription, method: 'metadata-description' };
}

function extractJsonLdArticleBody($) {
  let articleBody = '';
  $('script[type="application/ld+json"]').each((_, script) => {
    if (articleBody) return;
    try {
      const json = JSON.parse($(script).text());
      articleBody = findArticleBody(json);
    } catch {
      // Ignore malformed JSON-LD and continue to CNBC's HTML selectors.
    }
  });
  return cleanText(articleBody);
}

function findArticleBody(value) {
  if (!value || typeof value !== 'object') return '';
  if (typeof value.articleBody === 'string') return value.articleBody;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const articleBody = findArticleBody(entry);
      if (articleBody) return articleBody;
    }
    return '';
  }
  for (const nestedValue of Object.values(value)) {
    const articleBody = findArticleBody(nestedValue);
    if (articleBody) return articleBody;
  }
  return '';
}

function hasSufficientContent(content) {
  return cleanText(content).length >= MINIMUM_CONTENT_LENGTH;
}

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMediaDescription(item) {
  const directDescription = extractText(item.mediaDescription);
  if (directDescription) {
    return directDescription;
  }

  const mediaGroup = extractMediaGroup(item);
  if (!mediaGroup) {
    return '';
  }

  return extractText(mediaGroup['media:description'] || mediaGroup.mediaDescription || mediaGroup.description);
}

function extractMediaGroup(item) {
  const group = item.mediaGroup || item['media:group'];
  return Array.isArray(group) ? group[0] : group;
}

function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return extractText(value[0]);
  if (typeof value === 'object') {
    return extractText(value._ || value['#text'] || value.text || '');
  }
  return '';
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