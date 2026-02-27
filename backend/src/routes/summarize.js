import express from "express";
import { summarizeFeeds } from "../services/feedSummarizer.js";
import { createLogger } from "../utils/logger.js";
import { validateSummarize } from "../middleware/validator.js";

const router = express.Router();
const logger = createLogger('routes:summarize');

/**
 * @swagger
 * /summarize:
 *   post:
 *     summary: Summarize RSS feeds using AI
 *     description: Uses AI (OpenAI) to generate a summary of the provided feed items.
 *     tags: [Summarization]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feeds
 *             properties:
 *               feeds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     link:
 *                       type: string
 *                     content:
 *                       type: string
 *                     pubDate:
 *                       type: string
 *                     source:
 *                       type: string
 *                 description: Array of feed items to summarize
 *     responses:
 *       200:
 *         description: Feeds summarized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 summary:
 *                   type: string
 *                   description: AI-generated summary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or invalid API key
 *       500:
 *         description: Server error
 */
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
