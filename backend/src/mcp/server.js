import express from "express";
import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { jsonrpc, id, method, params = {} } = req.body || {};

  try {
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "health_check",
              description: "Check if MCP server is running",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "fetch_rss_feed",
              description: "Fetch RSS feed and process it",
              inputSchema: {
                type: "object",
                properties: {
                  url: { type: "string" }
                },
                required: ["url"]
              }
            },
            {
              name: "feed_summary",
              description: "Summarize feed items using AI",
              inputSchema: {
                type: "object",
                properties: {
                  feeds: { type: "array" }
                },
                required: ["feeds"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call") {
      const name = params.name;
      const args = params.arguments || {};

      if (name === "health_check") {
        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            status: "MCP server running",
            timestamp: new Date().toISOString()
          }
        });
      }

      if (name === "fetch_rss_feed") {
        const { url } = args;
        if (!url) {
          return res.json({
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Missing required parameter: url" }
          });
        }

        const result = await processFeeds({ url });

        return res.json({
          jsonrpc: "2.0",
          id,
          result
        });
      }

      if (name === "feed_summary") {
        const { feeds } = args;
        const result = await summarizeFeeds(feeds);

        return res.json({
          jsonrpc: "2.0",
          id,
          result
        });
      }
    }

    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" }
    });

  } catch (error) {
    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error.message }
    });
  }
});

export default router;