import express from "express";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { feeds } = req.body;

    if (!Array.isArray(feeds) || feeds.length === 0) {
      return res.status(400).json({
        error: "feeds array is required",
      });
    }

    const result = await summarizeFeeds(feeds);

    res.json({
      status: "success",
      ...result,
    });

  } catch (err) {
    console.error("Summarize route error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
