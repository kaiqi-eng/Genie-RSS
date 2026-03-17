/**
 * MCP Router
 * Handles JSON-RPC for tools
 */
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { verifyBearerToken } from "../services/auth.js";
import { getTenantContext } from "../services/context.js";
import { safeLogAudit } from "../services/audit.js";
import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

/**
 * Auth middleware
 */
router.use(async (req, res, next) => {
  const auditId = uuidv4();
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      safeLogAudit(null, "auth", {}, auditId, "fail", "Missing Authorization");
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized: Missing or invalid Authorization header" },
      });
    }

    const authResult = await verifyBearerToken(authHeader);
    if (!authResult?.ok || !authResult?.user?.tenantId) {
      safeLogAudit(null, "auth", {}, auditId, "fail", authResult?.error || "Invalid token");
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: `Unauthorized: ${authResult?.error || "Invalid token"}` },
      });
    }

    req.tenant = authResult.user;
    req.context = getTenantContext(authResult.user);
    next();
  } catch (err) {
    safeLogAudit(null, "auth", {}, auditId, "fail", err.message || "Unknown auth error");
    return res.status(401).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: `Unauthorized: ${err.message || "Unknown auth error"}` },
    });
  }
});

/**
 * Health check
 */
router.get("/health", (req, res) => {
  return res.status(200).json({
    ok: true,
    tenantId: req.context?.tenantId || null,
    message: "MCP route healthy",
  });
});

/**
 * Main JSON-RPC endpoint
 */
router.post("/", async (req, res) => {
  const auditId = uuidv4();
  try {
    const body = req.body || {};
    const { jsonrpc = "2.0", id = null, method, params = {} } = body;

    if (!method) {
      safeLogAudit(req.context?.tenantId || null, "unknown", params, auditId, "fail", "Missing method");
      return res.status(400).json({
        jsonrpc,
        id,
        error: { code: -32600, message: "Invalid Request: Missing method" },
      });
    }

    // ---------------- TOOLS LIST ----------------
    if (method === "tools/list") {
      safeLogAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
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
                  url: { type: "string", description: "Single RSS or site URL" },
                  feeds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of RSS or site URLs"
                  }
                },
                anyOf: [{ required: ["url"] }, { required: ["feeds"] }]
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

    // ---------------- TOOLS CALL ----------------
    if (method === "tools/call") {
      // Use `args` instead of `arguments` to avoid reserved word issues
      const { name, args = {} } = params;
      let result;

      if (name === "fetch_rss_feed") {
        if (args.feeds && Array.isArray(args.feeds) && args.feeds.length > 0) {
          result = await processFeeds({ feeds: args.feeds });
        } else if (args.url && typeof args.url === "string") {
          result = await processFeeds({ url: args.url });
        } else {
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: "You must provide 'url' or 'feeds'" }
          });
        }
      } else if (name === "feed_summary") {
        result = await summarizeFeeds(args.feeds);
      } else {
        safeLogAudit(req.context?.tenantId || null, method, params, auditId, "fail", "Unknown tool");
        return res.status(400).json({
          jsonrpc,
          id,
          error: { code: -32601, message: "Unknown tool" }
        });
      }

      safeLogAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
      return res.status(200).json({ jsonrpc, id, result });
    }

    // ---------------- METHOD NOT FOUND ----------------
    safeLogAudit(req.context?.tenantId || null, method, params, auditId, "fail", "Method not found");
    return res.status(404).json({
      jsonrpc,
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (error) {
    safeLogAudit(req.context?.tenantId || null, req.body?.method || "unknown", req.body?.params || {}, auditId, "fail", error.message || "Unhandled MCP error");
    return res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id ?? null,
      error: { code: -32000, message: error?.message || "Internal server error" }
    });
  }
});

export default router;