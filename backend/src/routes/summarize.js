import express from "express";
import { summarizeFeeds } from "../services/feedSummarizer.js";
import { createLogger } from "../utils/logger.js";
import { validateSummarize } from "../middleware/validator.js";

const router = express.Router();
const logger = createLogger('routes:summarize');

router.post("/", validateSummarize, async (req, res) => {
  try {
    const { feeds } = req.body;

    const result = await summarizeFeeds(feeds);

    res.json({
      status: "success",
      ...result,
    });

  } catch (err) {
    logger.error('Summarize route error', { error: err });
    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;
