import express from "express";
import { processFeeds } from "../services/feedprocess.js";
import { validateUrls, UrlValidationError } from "../utils/urlValidator.js";
import { createLogger } from "../utils/logger.js";
import { validateFeedProcess } from "../middleware/validator.js";

const router = express.Router();
const logger = createLogger('routes:feed');


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
