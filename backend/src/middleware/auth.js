import express from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { verifyBearerToken } from "../services/auth.js";

/**
 * API key guard (README / Swagger: header X-API-Key).
 * If API_KEY is unset, requests are allowed (local/dev).
 */
export function apiKeyAuth(req, res, next) {
  const validApiKey = process.env.API_KEY;
  if (!validApiKey || String(validApiKey).trim() === "") {
    return next();
  }

  const provided = req.headers["x-api-key"];
  if (!provided || typeof provided !== "string") {
    req.rateLimit?.recordFailure?.();
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing X-API-Key header",
    });
  }

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(validApiKey, "utf8");
  if (a.length !== b.length) {
    req.rateLimit?.recordFailure?.();
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  try {
    if (!crypto.timingSafeEqual(a, b)) {
      req.rateLimit?.recordFailure?.();
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }
  } catch {
    req.rateLimit?.recordFailure?.();
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  req.rateLimit?.clearFailures?.();
  next();
}
import { getTenantContext } from "../services/context.js";
import { logAudit } from "../services/audit.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";

const router = express.Router();

/**
 * API Key / Auth config check
 * Fail-closed by default; optional skip for development
 */
router.use((req, res, next) => {
  const validApiKey = process.env.API_KEY;
  const skipAuth = process.env.SKIP_API_AUTH === "true";

  if (!validApiKey) {
    if (skipAuth) {
      console.warn(
        "⚠️  API_KEY not set and SKIP_API_AUTH=true - API is unprotected (development only)"
      );
      return next();
    }

    console.error("❌ API_KEY not set in environment - rejecting request (fail-closed)");
    return res.status(503).json({
      error: "Service Unavailable",
      message: "Authentication not configured",
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${validApiKey}`) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API_KEY",
    });
  }

  next();
});

/**
 * JWT Auth middleware for MCP routes
 */
router.use(async (req, res, next) => {
  const auditId = uuidv4();
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logAudit(
        null,
        "auth",
        req.method,
        {},
        auditId,
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
        req.method,
        {},
        auditId,
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
      req.method,
      {},
      auditId,
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
 * Global audit middleware (after auth)
 */
router.use((req, res, next) => {
  const auditId = uuidv4();
  const tenantId = req.context?.tenantId || null;
  const endpoint = req.originalUrl;
  const method = req.method;

  // Log "started"
  logAudit(tenantId, endpoint, method, req.body || req.query || {}, auditId, "started");

  // Hook into res.json to log success automatically
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    logAudit(tenantId, endpoint, method, req.body || req.query || {}, auditId, "success", body);
    return originalJson(body);
  };

  next();
});

/**
 * Health check endpoint
 */
router.get("/health", (req, res) => {
  return res.json({
    ok: true,
    message: "MCP server is healthy",
    tenantId: req.context?.tenantId || null,
  });
});

/**
 * MCP JSON-RPC endpoint
 */
router.post("/", async (req, res) => {
  const auditId = uuidv4();

  try {
    const body = req.body || {};
    const jsonrpc = body.jsonrpc || "2.0";
    const id = body.id ?? null;
    const method = body.method || "unknown";
    const params = body.params || {};

    // ---------------- TOOLS LIST ----------------
    if (method === "tools/list") {
      logAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
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
                  url: { type: "string", description: "RSS or site URL (single)" },
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
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: "You must provide 'url' or 'feeds'." },
          });
        }
      } else if (name === "feed_summary") {
        if (!args.feeds || !Array.isArray(args.feeds) || args.feeds.length === 0) {
          return res.status(400).json({
            jsonrpc,
            id,
            error: { code: -32602, message: "Invalid params: 'feeds' array is required" },
          });
        }
        result = await summarizeFeeds(args.feeds);
      } else {
        logAudit(req.context?.tenantId || null, method, params, auditId, "fail", "Unknown tool");
        return res.status(400).json({
          jsonrpc,
          id,
          error: { code: -32601, message: "Unknown tool" },
        });
      }

      logAudit(req.context?.tenantId || null, method, params, auditId, "success", null);
      return res.status(200).json({
        jsonrpc,
        id,
        result,
      });
    }

    // ---------------- METHOD NOT FOUND ----------------
    logAudit(req.context?.tenantId || null, method, params, auditId, "fail", "Method not found");
    return res.status(400).json({
      jsonrpc,
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (error) {
    logAudit(req.context?.tenantId || null, "unknown", {}, auditId, "fail", error?.message || "Unhandled MCP error");

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

/**
 * Helper: processFeeds
 */
export async function processFeeds(input) {
  let feeds = [];
  if (input.feeds && Array.isArray(input.feeds) && input.feeds.length > 0) {
    feeds = input.feeds;
  } else if (input.url && typeof input.url === "string") {
    feeds = [input.url];
  } else {
    throw new Error("feeds must be a non-empty array or url must be provided");
  }

  // Placeholder: implement your actual feed processing logic here
  return feeds.map((feed) => ({ feed, status: "processed" }));
}
