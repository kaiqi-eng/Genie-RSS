import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateUrl } from './urlValidator.js';
import { createLogger } from './logger.js';

const logger = createLogger('utils:scraper');

/**
 * Scrape a website for content to generate an RSS feed
 * @param {string} url - The website URL to scrape
 * @returns {object} - Scraped website data
 * @throws {UrlValidationError} - If URL is invalid or blocked (SSRF protection)
 */
export async function scrapeWebsite(url) {
  // Validate URL for SSRF protection
  validateUrl(url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const baseUrl = new URL(url);

    // Extract page metadata
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('title').text().trim() ||
                  'Untitled';
    
    const description = $('meta[property="og:description"]').attr('content') ||
                        $('meta[name="description"]').attr('content') ||
                        '';

    const siteName = $('meta[property="og:site_name"]').attr('content') || 
                     baseUrl.hostname;

    const favicon = $('link[rel="icon"]').attr('href') ||
                    $('link[rel="shortcut icon"]').attr('href') ||
                    '/favicon.ico';

    // Extract content items (articles, posts, etc.)
    const items = extractContentItems($, baseUrl);

    return {
      title,
      description,
      siteName,
      url,
      favicon: new URL(favicon, baseUrl.origin).toString(),
      items,
      scrapedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error scraping website', { url, error });
    throw new Error(`Failed to scrape website: ${error.message}`);
  }
}

/**
 * Extract content items from the page
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {URL} baseUrl - Base URL for resolving relative links
 * @returns {array} - Array of content items
 */
function extractContentItems($, baseUrl) {
  const items = [];
  const seen = new Set();

  // Selectors for common content containers (ordered by specificity)
  const articleSelectors = [
    'article',
    '[role="article"]',
    '.post',
    '.entry',
    '.article',
    '.blog-post',
    '.news-item',
    '.card',
    '.item',
    'main section',
    '.content-item'
  ];

  // Try each selector
  for (const selector of articleSelectors) {
    $(selector).each((_, element) => {
      const item = extractItemData($, $(element), baseUrl);
      if (item && item.link && !seen.has(item.link)) {
        seen.add(item.link);
        items.push(item);
      }
    });

    // If we found items, stop looking
    if (items.length > 0) break;
  }

  // If no structured content found, try to extract from links with headings
  if (items.length === 0) {
    $('a').each((_, element) => {
      const $a = $(element);
      const $heading = $a.find('h1, h2, h3, h4, h5, h6').first();
      
      if ($heading.length > 0 || $a.closest('h1, h2, h3, h4, h5, h6').length > 0) {
        const href = $a.attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const link = resolveUrl(href, baseUrl);
          if (!seen.has(link)) {
            seen.add(link);
            const title = $heading.text().trim() || $a.text().trim();
            if (title && title.length > 5 && title.length < 200) {
              items.push({
                title,
                link,
                content: '',
                pubDate: null,
                thumbnail: null
              });
            }
          }
        }
      }
    });
  }

  // Limit to 20 items
  return items.slice(0, 20);
}

/**
 * Extract data from a single content item
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} $element - The element to extract from
 * @param {URL} baseUrl - Base URL for resolving relative links
 * @returns {object|null} - Extracted item data or null
 */
function extractItemData($, $element, baseUrl) {
  // Find the main link
  const $link = $element.find('a').first();
  const href = $link.attr('href') || $element.find('a[href]').first().attr('href');
  
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
    return null;
  }

  const link = resolveUrl(href, baseUrl);

  // Extract title
  const $heading = $element.find('h1, h2, h3, h4, h5, h6').first();
  const title = $heading.text().trim() ||
                $link.text().trim() ||
                $element.find('.title, .headline').text().trim() ||
                '';

  if (!title || title.length < 3) {
    return null;
  }

  // Extract content/description
  const $content = $element.find('p, .excerpt, .summary, .description').first();
  const content = $content.text().trim().substring(0, 500);

  // Extract date
  const $time = $element.find('time, .date, .published, .post-date').first();
  const dateStr = $time.attr('datetime') || $time.text().trim();
  const pubDate = parseDate(dateStr);

  // Extract thumbnail
  const $img = $element.find('img').first();
  const imgSrc = $img.attr('src') || $img.attr('data-src');
  const thumbnail = imgSrc ? resolveUrl(imgSrc, baseUrl) : null;

  return {
    title,
    link,
    content,
    pubDate,
    thumbnail
  };
}

/**
 * Resolve a URL against a base URL
 * @param {string} href - The URL to resolve
 * @param {URL} baseUrl - The base URL
 * @returns {string} - Resolved absolute URL
 */
function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl.origin).toString();
  } catch {
    return href;
  }
}

/**
 * Parse a date string into ISO format
 * @param {string} dateStr - Date string to parse
 * @returns {string|null} - ISO date string or null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Ignore parse errors
  }
  
  return null;
}
