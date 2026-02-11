import express from 'express';
import { discoverRssFeed } from '../services/rssDiscovery.js';
import { fetchAndParseRss } from '../services/rssFetcher.js';
import { scrapeWebsite } from '../utils/scraper.js';
import { generateRssFeed } from '../services/rssGenerator.js';

const router = express.Router();

router.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
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
    console.error('Error processing RSS request:', error);
    res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
});

export default router;