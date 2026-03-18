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
 * Global audit middleware for all endpoints
 */
router.use((req, res, next) => {
  const auditId = uuidv4();
  const tenantId = req.context?.tenantId || null;
  const endpoint = req.originalUrl;
  const method = req.method;

  // Log "started"
  safeLogAudit(tenantId, endpoint, method, req.body || req.query || {}, auditId, "started");

  // Hook into res.json to log success automatically
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    safeLogAudit(tenantId, endpoint, method, req.body || req.query || {}, auditId, "success", body);
    return originalJson(body);
  };

  next();
});

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
        error: {
          code: -32001,
          message: "Unauthorized: Missing or invalid Authorization header",
        },
      });
    }

    const authResult = await verifyBearerToken(authHeader);
    if (!authResult?.ok || !authResult?.user?.tenantId) {
      safeLogAudit(null, "auth", {}, auditId, "fail", authResult?.error || "Invalid token");
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: `Unauthorized: ${authResult?.error || "Invalid token"}`,
        },
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
 * Audit wrapper for JSON-RPC endpoint
 */
function withAudit(handler) {
  return async (req, res, next) => {
    const auditId = uuidv4();
    const tenantId = req.context?.tenantId || null;
    const endpoint = req.originalUrl;
    const method = req.body?.method || req.method;

    // Log "started" specifically for JSON-RPC
    safeLogAudit(tenantId, endpoint, method, req.body || {}, auditId, "started");

    try {
      const handlerResult = await handler(req, res, auditId);

      // Log success with actual result
      safeLogAudit(tenantId, endpoint, method, req.body || {}, auditId, "success", handlerResult);

      if (handlerResult) {
        return res.status(200).json(handlerResult);
      }
      return;
    } catch (error) {
      // Log failure
      safeLogAudit(
        tenantId,
        endpoint,
        method,
        req.body || {},
        auditId,
        "fail",
        null,
        error?.message || "Unhandled error"
      );

      return res.status(500).json({
        jsonrpc: req.body?.jsonrpc || "2.0",
        id: req.body?.id ?? null,
        error: { code: -32000, message: error?.message || "Internal server error" },
      });
    }
  };
}

/**
 * Main JSON-RPC endpoint
 */
router.post(
  "/",
  withAudit(async (req) => {
    const body = req.body || {};
    const { jsonrpc = "2.0", id = null, method, params = {} } = body;

    if (!method) {
      return {
        jsonrpc,
        id,
        error: { code: -32600, message: "Invalid Request: Missing method" },
      };
    }

    // ---------------- TOOLS LIST ----------------
    if (method === "tools/list") {
      return {
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
                  feeds: { type: "array", items: { type: "string" }, description: "Array of RSS or site URLs" },
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
      };
    }

    // ---------------- TOOLS CALL ----------------
    if (method === "tools/call") {
      const { name, args = {} } = params;
      let result;

      if (name === "fetch_rss_feed") {
        if (args.feeds && Array.isArray(args.feeds) && args.feeds.length > 0) {
          result = await processFeeds({ feeds: args.feeds });
        } else if (args.url && typeof args.url === "string") {
          result = await processFeeds({ url: args.url });
        } else {
          return {
            jsonrpc,
            id,
            error: { code: -32602, message: "You must provide 'url' or 'feeds'" },
          };
        }
      } else if (name === "feed_summary") {
        result = await summarizeFeeds(args.feeds);
      } else {
        return {
          jsonrpc,
          id,
          error: { code: -32601, message: "Unknown tool" },
        };
      }

      return { jsonrpc, id, result };
    }

    // ---------------- METHOD NOT FOUND ----------------
    return {
      jsonrpc,
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  })
);

export default router;