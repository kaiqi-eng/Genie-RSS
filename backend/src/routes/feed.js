import express from "express";
import { processFeeds } from "../services/feedprocess.js";
import { validateUrls, UrlValidationError } from "../utils/urlValidator.js";
import { createLogger } from "../utils/logger.js";
import { validateFeedProcess } from "../middleware/validator.js";

const router = express.Router();
const logger = createLogger('routes:feed');

/**
 * @swagger
 * /rss/feed/processfeed:
 *   post:
 *     summary: Process multiple RSS feeds
 *     description: Fetches and processes multiple RSS feed URLs, returning their combined content.
 *     tags: [Feed Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feeds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: Array of RSS feed URLs to process
 *                 example: ["https://example.com/feed.xml"]
 *               url:
 *                 oneOf:
 *                   - type: string
 *                     format: uri
 *                   - type: array
 *                     items:
 *                       type: string
 *                       format: uri
 *                 description: Alternative to feeds - single URL or array of URLs
 *     responses:
 *       200:
 *         description: Feeds processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FeedItem'
 *                 rejectedUrls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       url:
 *                         type: string
 *                       error:
 *                         type: string
 *                   description: URLs that failed validation
 *       400:
 *         description: No valid URLs provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
router.post("/processfeed", validateFeedProcess, async (req, res) => {
  try {
    const payload =
      req.body?.body && typeof req.body.body === "object"
        ? req.body.body
        : req.body;

    let { feeds, url } = payload;

    // ✅ NORMALIZATION FIX
    let normalizedFeeds = [];

    if (Array.isArray(feeds)) {
      normalizedFeeds = feeds;
    } else if (Array.isArray(url)) {
      normalizedFeeds = url;
    } else if (typeof url === "string") {
      normalizedFeeds = [url];
    }

    if (normalizedFeeds.length === 0) {
      return res.status(400).json({
        error: "You must provide feeds[] or url (string or array)",
      });
    }

    // Validate URLs with SSRF protection
    const { valid: validFeeds, invalid: invalidFeeds } = validateUrls(normalizedFeeds);

    if (validFeeds.length === 0) {
      return res.status(400).json({
        error: "No valid URLs provided",
        invalidUrls: invalidFeeds
      });
    }

    const feedResult = await processFeeds({ feeds: validFeeds });

    // Include info about rejected URLs in response
    if (invalidFeeds.length > 0) {
      feedResult.rejectedUrls = invalidFeeds;
    }

    res.json(feedResult);
  } catch (err) {
    logger.error('Feed process error', { error: err });
    if (err instanceof UrlValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});


export default router;
