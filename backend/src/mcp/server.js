import express from "express";
import { v4 as uuidv4 } from "uuid";
import { verifyBearerToken } from "../services/auth.js";
import { getTenantContext } from "../services/context.js";
import { logAudit } from "../services/audit.js";
import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

/**
 * Auth middleware for MCP routes
 */
router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logAudit(
        null,
        "auth",
        {},
        uuidv4(),
        "fail",
        "Missing or invalid Authorization header"
      );

      return res.status(401).json({
        error: {
          code: -32600,
          message: "Unauthorized: Missing or invalid Authorization header",
        },
      });
    }

    const authResult = await verifyBearerToken(authHeader);

    if (!authResult?.ok || !authResult?.user?.tenantId) {
      logAudit(
        null,
        "auth",
        {},
        uuidv4(),
        "fail",
        authResult?.error || "Invalid token"
      );

      return res.status(401).json({
        error: {
          code: -32600,
          message: `Unauthorized: ${authResult?.error || "Invalid token"}`,
        },
      });
    }

    req.tenant = authResult.user;
    req.context = getTenantContext(authResult.user);

    next();
  } catch (error) {
    logAudit(
      null,
      "auth",
      {},
      uuidv4(),
      "fail",
      error?.message || "Unknown auth error"
    );

    return res.status(401).json({
      error: {
        code: -32600,
        message: `Unauthorized: ${error?.message || "Unknown auth error"}`,
      },
    });
  }
});

/**
 * Health check for MCP route
 */
router.get("/health", (req, res) => {
  return res.json({
    ok: true,
    message: "MCP server is healthy",
    tenantId: req.context?.tenantId || null,
  });
});

/**
 * Example MCP JSON-RPC endpoint
 * Replace this with your actual MCP handlers if needed
 */
router.post("/", async (req, res) => {
  const auditId = uuidv4();

  try {
    const body = req.body || {};
    const method = body.method || "unknown";
    const params = body.params || {};

    // TOOLS LIST
    if (method === "tools/list") {
      logAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
      return res.status(200).json({
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          tools: [
            {
              name: "fetch_rss_feed",
              description: "Fetch and process one or more RSS feeds",
              inputSchema: {
                type: "object",
                properties: {
                  url: { type: "string", description: "RSS or site URL (single)" },
                  feeds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of RSS or site URLs"
                  }
                },
                anyOf: [
                  { required: ["url"] },
                  { required: ["feeds"] }
                ]
              }
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
                        source: { type: "string" }
                      }
                    }
                  }
                },
                required: ["feeds"]
              }
            }
          ]
        }
      });
    }

    // TOOLS CALL
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params;
      let result;
      if (name === "fetch_rss_feed") {
        // Accept either a single url or an array of feeds
        if (args.feeds && Array.isArray(args.feeds) && args.feeds.length > 0) {
          result = await processFeeds({ feeds: args.feeds });
        } else if (args.url && typeof args.url === "string") {
          result = await processFeeds({ url: args.url });
        } else {
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: "You must provide 'url' or 'feeds'." }
          });
        }
      } else if (name === "feed_summary") {
        result = await summarizeFeeds(args.feeds);
      } else {
        logAudit(req.context?.tenantId || null, method, params, auditId, "fail", "Unknown tool");
        return res.status(400).json({
          jsonrpc: "2.0",
          id: body.id ?? null,
          error: { code: -32601, message: "Unknown tool" }
        });
      }
      logAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
      return res.status(200).json({
        jsonrpc: "2.0",
        id: body.id ?? null,
        result
      });
    }

    // DEFAULT: echo
    logAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
    return res.status(200).json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        ok: true,
        auditId,
        tenantId: req.context?.tenantId || null,
        method,
      },
    });
  } catch (error) {
    logAudit(
      req.context?.tenantId || null,
      "unknown",
      {},
      auditId,
      "fail",
      error?.message || "Unhandled MCP error"
    );

    return res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id ?? null,
      error: {
        code: -32000,
        message: error?.message || "Internal server error",
      },
    });
  }
});

export default router;

export async function processFeeds(input) {
  let feeds = [];
  if (input.feeds && Array.isArray(input.feeds) && input.feeds.length > 0) {
    feeds = input.feeds;
  } else if (input.url && typeof input.url === "string") {
    feeds = [input.url];
  } else {
    throw new Error("feeds must be a non-empty array or url must be provided");
  }
  // ...rest of logic...
}