import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "health_check",
            description: "Check if MCP server is running",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "fetch_rss_feed",
            description: "Fetch RSS feed and process it",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "RSS or site URL" }
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
                feeds: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      link: { type: "string" },
                      content: { type: "string" },
                      pubDate: { type: "string" },
                      source: { type: "string" }
                    }
                  },
                  description: "Array of feed items to summarize"
                }
              },
              required: ["feeds"]
            }
          }
        ]
      }
    });
  }

  if (method === "tools/call") {
    if (params.name === "health_check") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          status: "MCP server running",
          timestamp: new Date().toISOString()
        }
      });
    }
    if (params.name === "fetch_rss_feed") {
      try {
        const response = await axios.post(
          "http://localhost:3001/api/rss/feed/processfeed",
          { url: params.url },
          { headers: { "Content-Type": "application/json", "X-API-KEY": "testing" } }
        );
        return res.json({
          jsonrpc: "2.0",
          id,
          result: response.data
        });
      } catch (err) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: "Failed to fetch/process RSS feed",
            details: err.message
          }
        });
      }
    }
    if (params.name === "feed_summary") {
      try {
        const response = await axios.post(
          "http://localhost:3001/api/summarize",
          { feeds: params.feeds },
          { headers: { "Content-Type": "application/json", "X-API-KEY": "testing" } }
        );
        return res.json({
          jsonrpc: "2.0",
          id,
          result: response.data
        });
      } catch (err) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32001,
            message: "Failed to summarize feeds",
            details: err.message
          }
        });
      }
    }
  }

  return res.json({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: "Method not found"
    }
  });
});

app.listen(5005, () => {
  console.log("MCP HTTP Server running on port 5005");
});