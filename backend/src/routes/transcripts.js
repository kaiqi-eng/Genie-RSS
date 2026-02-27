import express from "express";
import { summarizeTranscript } from "../services/otterTranscript.js";
import { createLogger } from "../utils/logger.js";
import { validateTranscriptSummarize } from "../middleware/validator.js";
import { bodyLimits } from "../config/index.js";

const router = express.Router();
const logger = createLogger('routes:transcripts');

// Increase JSON body limit for large transcripts
router.use(express.json({ limit: bodyLimits.transcript }));

/**
 * @swagger
 * /transcript/summarize:
 *   post:
 *     summary: Summarize transcripts using AI
 *     description: Combines and summarizes multiple transcripts into a single AI-generated summary.
 *     tags: [Transcripts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transcripts
 *             properties:
 *               transcripts:
 *                 oneOf:
 *                   - type: array
 *                     minItems: 1
 *                     items:
 *                       oneOf:
 *                         - type: string
 *                         - type: object
 *                           properties:
 *                             content:
 *                               type: string
 *                             title:
 *                               type: string
 *                   - type: string
 *                     description: JSON string that parses to an array (legacy support)
 *                 description: Array of transcripts to summarize
 *     responses:
 *       200:
 *         description: Transcripts summarized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 *                   description: AI-generated summary of transcripts
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
router.post("/summarize", validateTranscriptSummarize, async (req, res) => {
  try {
    // Zod validation handles JSON string parsing and array validation
    const { transcripts } = req.body;

    logger.debug('Received transcripts for summarization', { count: transcripts?.length });

    logger.info('Processing transcript summarization', { transcriptCount: transcripts.length });
    const result = await summarizeTranscript(transcripts);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Transcript summarization error', { error });

    return res.status(500).json({
      error: "Failed to summarize transcript",
      details: error.message,
    });
  }
});

export default router;
