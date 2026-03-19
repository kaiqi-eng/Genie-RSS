import express from "express";
import { verifyBearerToken } from "../services/auth.js";
import { getTenantContext } from "../services/context.js";
import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
}

/**
 * Bearer auth middleware for MCP routes
 */
router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json(
        jsonRpcError(
          null,
          -32001,
          "Unauthorized: Missing or invalid Authorization header"
        )
      );
    }

    const authResult = await verifyBearerToken(authHeader);

    if (!authResult?.ok || !authResult?.user?.tenantId) {
      return res.status(401).json(
        jsonRpcError(
          null,
          -32001,
          `Unauthorized: ${authResult?.error || "Invalid token"}`
        )
      );
    }

    req.tenant = authResult.user;
    req.context = getTenantContext(authResult.user);

    next();
  } catch (error) {
    return res.status(401).json(
      jsonRpcError(
        null,
        -32001,
        `Unauthorized: ${error?.message || "Unknown auth error"}`
      )
    );
  }
});

/**
 * GET /mcp/health
 */
router.get("/health", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "MCP route healthy",
    tenantId: req.context?.tenantId || null,
    userId: req.tenant?.id || null,
    auditId: req.auditId || null,
  });
});

/**
 * POST /mcp
 * JSON-RPC endpoint
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const { jsonrpc = "2.0", id = null, method, params = {} } = body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json(
        jsonRpcError(id, -32600, "Invalid Request: jsonrpc must be '2.0'")
      );
    }

    if (!method || typeof method !== "string") {
      return res.status(400).json(
        jsonRpcError(id, -32600, "Invalid Request: Missing method")
      );
    }

    // =========================
    // tools/list
    // =========================
    if (method === "tools/list") {
      return res.status(200).json({
        jsonrpc,
        id,
        result: {
          tools: [
            {
              name: "fetch_rss_feed",
              description: "Fetch and process one or more RSS feeds",
              inputSchema: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    description: "Single RSS or site URL",
                  },
                  feeds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of RSS or site URLs",
                  },
                },
                anyOf: [{ required: ["url"] }, { required: ["feeds"] }],
              },
            },
            {
              name: "feed_summary",
              description: "Summarize feed items",
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
                        source: { type: "string" },
                      },
                    },
                  },
                },
                required: ["feeds"],
              },
            },
          ],
        },
      });
    }

    // =========================
    // tools/call
    // =========================
    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.args ?? params?.arguments ?? {};

      if (!toolName || typeof toolName !== "string") {
        return res.status(400).json(
          jsonRpcError(id, -32602, "Invalid params: tool name is required")
        );
      }

      // fetch_rss_feed
      if (toolName === "fetch_rss_feed") {
        let result;

        if (Array.isArray(args.feeds) && args.feeds.length > 0) {
          result = await processFeeds({ feeds: args.feeds });
        } else if (typeof args.url === "string" && args.url.trim()) {
          result = await processFeeds({ url: args.url.trim() });
        } else {
          return res.status(400).json(
            jsonRpcError(
              id,
              -32602,
              "Invalid params: provide 'url' or non-empty 'feeds'"
            )
          );
        }

        return res.status(200).json({
          jsonrpc,
          id,
          result,
        });
      }

      // feed_summary
      if (toolName === "feed_summary") {
        if (!Array.isArray(args.feeds) || args.feeds.length === 0) {
          return res.status(400).json(
            jsonRpcError(
              id,
              -32602,
              "Invalid params: 'feeds' must be a non-empty array"
            )
          );
        }

        const result = await summarizeFeeds(args.feeds);

        return res.status(200).json({
          jsonrpc,
          id,
          result,
        });
      }

      return res.status(404).json(
        jsonRpcError(id, -32601, `Unknown tool: ${toolName}`)
      );
    }

    // =========================
    // method not found
    // =========================
    return res.status(404).json(
      jsonRpcError(id, -32601, `Method not found: ${method}`)
    );
  } catch (error) {
    return res.status(500).json(
      jsonRpcError(
        req.body?.id ?? null,
        -32000,
        error?.message || "Internal server error"
      )
    );
  }
});

export default router;