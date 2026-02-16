import express from "express";
import { processFeeds } from "../services/feedprocess.js";

const router = express.Router();


router.post("/processfeed", async (req, res) => {
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

    const feedResult = await processFeeds({ feeds: normalizedFeeds });
    res.json(feedResult);
  } catch (err) {
    console.error("Feed process error:", err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
