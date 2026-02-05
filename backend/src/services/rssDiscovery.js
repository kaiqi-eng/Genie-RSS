import axios from 'axios';
import * as cheerio from 'cheerio';

// Common RSS feed URL patterns to check
const COMMON_FEED_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/rss.xml',
  '/atom.xml',
  '/feed.xml',
  '/index.xml',
  '/feeds/posts/default',  // Blogger
  '/?feed=rss2',           // WordPress
];

/**
 * Discover RSS feed URL from a website
 * @param {string} url - The website URL to check
 * @returns {string|null} - The RSS feed URL if found, null otherwise
 */
export async function discoverRssFeed(url) {
  try {
    const baseUrl = new URL(url);
    
    // First, try to find RSS link in HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Look for RSS/Atom link tags in the head
    const feedLink = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first();
    
    if (feedLink.length > 0) {
      const href = feedLink.attr('href');
      if (href) {
        // Handle relative URLs
        return new URL(href, baseUrl.origin).toString();
      }
    }

    // Check for alternate links
    const alternateLink = $('link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]').first();
    
    if (alternateLink.length > 0) {
      const href = alternateLink.attr('href');
      if (href) {
        return new URL(href, baseUrl.origin).toString();
      }
    }

    // Try common feed URL patterns
    for (const path of COMMON_FEED_PATHS) {
      const feedUrl = new URL(path, baseUrl.origin).toString();
      const exists = await checkFeedExists(feedUrl);
      if (exists) {
        return feedUrl;
      }
    }

    return null;
  } catch (error) {
    console.error('Error discovering RSS feed:', error.message);
    return null;
  }
}

/**
 * Check if a URL returns a valid RSS/Atom feed
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL returns a valid feed
 */
async function checkFeedExists(url) {
  try {
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });

    const contentType = response.headers['content-type'] || '';
    return (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom')
    );
  } catch {
    // If HEAD fails, try GET with a small range
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': 'bytes=0-500'
        },
        timeout: 5000
      });

      const data = response.data.toString().toLowerCase();
      return data.includes('<rss') || data.includes('<feed') || data.includes('<?xml');
    } catch {
      return false;
    }
  }
}
