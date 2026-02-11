import express from "express";
import { processFeeds } from "../services/feedprocess.js";

const router = express.Router();

router.post("/processfeed", async (req, res) => {
  try {
    const { feeds, url } = req.body;

    // ---------- Input Validation ----------
    if ((!feeds || !Array.isArray(feeds) || feeds.length === 0) && !url) {
      return res.status(400).json({
        error: "You must provide a non-empty 'feeds' array or a 'url' property",
      });
    }

    // ---------- Ngrok Warning ----------
    // const host = req.get("host") || "";
    // if (host.includes("ngrok")) {
    //   console.warn(
    //     "⚠️ Warning: This endpoint is being accessed via ngrok. Be careful with exposing sensitive data!"
    //   );
    //   return res.status(403).json({
    //     error: "Access from ngrok is not allowed for security reasons",
    //   });
    // }

    // ---------- Process Feeds ----------
    const feedResult = await processFeeds({ feeds, url });
    res.json(feedResult);
  } catch (err) {
    console.error("Feed process error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
