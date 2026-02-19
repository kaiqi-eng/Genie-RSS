import express from "express";
import { summarizeTranscript } from "../services/otterTranscript.js";
import { createLogger } from "../utils/logger.js";

const router = express.Router();
const logger = createLogger('routes:transcripts');

// Increase JSON body limit for large transcripts
router.use(express.json({ limit: "10mb" }));

/**
 * POST /api/transcript/summarize
 * Summarize multiple transcripts into one combined summary
 */
router.post("/summarize", async (req, res) => {
  try {

    let { transcripts } = req.body;

    logger.debug('Received transcripts for summarization', { count: req.body?.transcripts?.length });

    // Handle raw string payload (if ngrok mangled JSON)
    if (typeof transcripts === "string") {
      try {
        transcripts = JSON.parse(transcripts);
      } catch (err) {
        return res.status(400).json({ error: "Invalid JSON string in 'transcripts'" });
      }
    }

    if (!Array.isArray(transcripts) || transcripts.length === 0) {
      return res.status(400).json({
        error: "transcripts must be a non-empty array",
      });
    }

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
