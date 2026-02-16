import express from "express";
import { summarizeTranscript } from "../services/otterTranscript.js";

const router = express.Router();

// Increase JSON body limit for large transcripts
router.use(express.json({ limit: "10mb" }));

/**
 * POST /api/transcript/summarize
 * Summarize multiple transcripts into one combined summary
 */
router.post("/summarize", async (req, res) => {
  try {

    let { transcripts } = req.body;

    console.log("Received transcripts for summarization:", req.body);

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

    console.log("Received transcripts for summarization:", transcripts);
    const result = await summarizeTranscript(transcripts);

    return res.status(200).json(result);
  } catch (error) {
    console.error("Transcript summarization error:", error);

    return res.status(500).json({
      error: "Failed to summarize transcript",
      details: error.message,
    });
  }
});

export default router;
