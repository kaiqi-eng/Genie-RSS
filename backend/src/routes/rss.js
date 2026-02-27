import express from 'express';
import { discoverRssFeed } from '../services/rssDiscovery.js';
import { fetchAndParseRss } from '../services/rssFetcher.js';
import { scrapeWebsite } from '../utils/scraper.js';
import { generateRssFeed } from '../services/rssGenerator.js';
import { validateUrl, UrlValidationError } from '../utils/urlValidator.js';
import { createLogger } from '../utils/logger.js';
import { validateRssFetch } from '../middleware/validator.js';

const router = express.Router();
const logger = createLogger('routes:rss');

/**
 * @swagger
 * /rss/fetch:
 *   post:
 *     summary: Fetch or generate RSS feed for a URL
 *     description: Discovers an existing RSS feed for the given URL, or scrapes the website and generates one if no feed is found.
 *     tags: [RSS]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: The URL to fetch or generate RSS for
 *                 example: https://example.com
 *     responses:
 *       200:
 *         description: RSS feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 source:
 *                   type: string
 *                   enum: [discovered, generated]
 *                   description: Whether the feed was discovered or generated
 *                 feedUrl:
 *                   type: string
 *                   nullable: true
 *                   description: URL of discovered feed (null if generated)
 *                 feed:
 *                   $ref: '#/components/schemas/Feed'
 *                 rssXml:
 *                   type: string
 *                   description: Raw XML (only for generated feeds)
 *       400:
 *         description: Invalid URL or SSRF protection triggered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
router.post('/fetch', validateRssFetch, async (req, res) => {
  try {
    const { url } = req.body;

    // Validate URL with SSRF protection
    try {
      validateUrl(url);
    } catch (e) {
      if (e instanceof UrlValidationError) {
        return res.status(400).json({ error: e.message, code: e.code });
      }
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Try to discover RSS feed
    const rssUrl = await discoverRssFeed(url);

    if (rssUrl) {
      // RSS feed found, fetch and parse it
      const feed = await fetchAndParseRss(rssUrl);
      return res.json({
        source: 'discovered',
        feedUrl: rssUrl,
        feed
      });
    }

    // No RSS feed found, scrape the website and generate one
    const scrapedData = await scrapeWebsite(url);
    const generatedFeed = generateRssFeed(url, scrapedData);

    return res.json({
      source: 'generated',
      feedUrl: null,
      feed: generatedFeed.json,
      rssXml: generatedFeed.xml
    });

  } catch (error) {
    logger.error('Error processing RSS request', { url: req.body?.url, error });
    res.status(500).json({
      error: 'Failed to process request',
      message: error.message
    });
  }
});

export default router;