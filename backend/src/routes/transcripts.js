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
 * POST /api/transcript/summarize
 * Summarize multiple transcripts into one combined summary
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
