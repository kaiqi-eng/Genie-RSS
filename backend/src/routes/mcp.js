// server/routes/mcp.js
import express from "express";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";

import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";
import { verifyBearerToken, getTenantContext } from "../services/auth.js";
import { logAudit } from "../services/audit.js";

const router = express.Router();

// -------------------------
// RATE LIMITER
// -------------------------
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers["authorization"];
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice(7, 25); // partial token fingerprint only
    }
    return req.ip;
  },
});

router.use(limiter);

// -------------------------
// SAFE AUDIT WRAPPER
// Prevent audit failures from breaking auth flow
// -------------------------
function safeLogAudit(tenantId, action, params, auditId, status, error = null) {
  try {
    logAudit(tenantId, action, params, auditId, status, error);
  } catch (e) {
    console.error("AUDIT LOG ERROR:", e);
  }
}

// -------------------------
// AUTH MIDDLEWARE
// Compatible with auth.js returning:
// { ok: true, user: { tenantId, email, id?, role?, permissions? } }
// -------------------------
router.use(async (req, res, next) => {
  const auditId = uuidv4();

  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      safeLogAudit(null, "auth", {}, auditId, "fail", "Missing Bearer token");

      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: "Unauthorized: Bearer token required",
        },
      });
    }

    // IMPORTANT: pass full Authorization header
    const authResult = await verifyBearerToken(authHeader);

    if (!authResult?.ok || !authResult?.user?.tenantId) {
      safeLogAudit(
        null,
        "auth",
        {},
        auditId,
        "fail",
        authResult?.error || "Invalid token"
      );

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

    // This now works whether getTenantContext accepts object or string
    req.context = getTenantContext(authResult.user);

    console.log("AUTH SUCCESS:", {
      tenantId: req.context.tenantId,
      userId: req.context.userId ?? null,
      email: req.tenant.email ?? null,
    });

    next();
  } catch (err) {
    console.error("AUTH MIDDLEWARE ERROR:", err);

    safeLogAudit(null, "auth", {}, auditId, "fail", err.message);

    return res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: `Internal auth error: ${err.message}`,
      },
    });
  }
});

// -------------------------
// SSE STREAM (Protected)
// NOTE: currently just confirms connection
// -------------------------
router.get("/stream", (req, res) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(`event: connected\n`);
    res.write(
      `data: ${JSON.stringify({
        tenantId: req.context.tenantId,
        message: "SSE connected",
      })}\n\n`
    );

    req.on("close", () => {
      res.end();
    });
  } catch (err) {
    console.error("SSE ERROR:", err);
    return res.status(500).end();
  }
});

// -------------------------
// JSON-RPC POST ENDPOINT
// -------------------------
router.post("/", async (req, res) => {
  const { jsonrpc, id, method, params = {} } = req.body || {};
  const auditId = uuidv4();
  let status = "success";
  let error = null;

  try {
    // -------------------------
    // Validate JSON-RPC request
    // -------------------------
    if (jsonrpc !== "2.0" || typeof method !== "string") {
      safeLogAudit(
        req.tenant?.tenantId || null,
        "invalid_request",
        req.body,
        auditId,
        "fail",
        "Invalid JSON-RPC request"
      );

      return res.status(400).json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
          code: -32600,
          message: "Invalid Request",
        },
      });
    }

    // -------------------------
    // MCP initialize
    // -------------------------
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          server_info: {
            name: "MCP Express Server",
            version: "1.0.0",
            features: ["tools", "resources", "prompts", "streaming"],
          },
          tenant: {
            tenantId: req.context.tenantId,
          },
        },
      });
    }

    // -------------------------
    // List tools
    // -------------------------
    if (method === "tools/list") {
      safeLogAudit(req.tenant.tenantId, method, params, auditId, status);

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
                properties: {},
              },
            },
            {
              name: "fetch_rss_feed",
              description: "Fetch RSS feed and process it",
              inputSchema: {
                type: "object",
                properties: {
                  url: { type: "string", format: "uri" },
                },
                required: ["url"],
              },
            },
            {
              name: "feed_summary",
              description: "Summarize feed items using AI",
              inputSchema: {
                type: "object",
                properties: {
                  feeds: { type: "array" },
                },
                required: ["feeds"],
              },
            },
          ],
        },
      });
    }

    // -------------------------
    // Tool execution
    // -------------------------
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params;

      if (!name || typeof name !== "string") {
        safeLogAudit(
          req.tenant.tenantId,
          method,
          params,
          auditId,
          "fail",
          "Tool name is required"
        );

        return res.status(400).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: "Invalid params: tool name is required",
          },
        });
      }

      let result;

      // health_check
      if (name === "health_check") {
        result = {
          status: "ok",
          server: "MCP Express Server",
          tenantId: req.context.tenantId,
          userId: req.context.userId ?? null,
          timestamp: new Date().toISOString(),
        };
      }

      // fetch_rss_feed
      else if (name === "fetch_rss_feed") {
        if (!args.url || typeof args.url !== "string") {
          safeLogAudit(
            req.tenant.tenantId,
            method,
            params,
            auditId,
            "fail",
            "Invalid url"
          );

          return res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: "Invalid params: url is required",
            },
          });
        }

        result = await processFeeds({ url: args.url }, req.context);
      }

      // feed_summary
      else if (name === "feed_summary") {
        if (!Array.isArray(args.feeds)) {
          safeLogAudit(
            req.tenant.tenantId,
            method,
            params,
            auditId,
            "fail",
            "Invalid feeds"
          );

          return res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: "Invalid params: feeds must be an array",
            },
          });
        }

        result = await summarizeFeeds(args.feeds, req.context);
      }

      // unknown tool
      else {
        status = "fail";
        error = "Unknown tool";

        safeLogAudit(req.tenant.tenantId, method, params, auditId, status, error);

        return res.status(400).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: error,
          },
        });
      }

      safeLogAudit(req.tenant.tenantId, method, params, auditId, status);

      return res.json({
        jsonrpc: "2.0",
        id,
        result,
      });
    }

    // -------------------------
    // Unknown method
    // -------------------------
    status = "fail";
    error = "Method not found";

    safeLogAudit(req.tenant.tenantId, method, params, auditId, status, error);

    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: error,
      },
    });
  } catch (err) {
    console.error("MCP ROUTE ERROR:", err);

    status = "fail";
    error = err.message;

    safeLogAudit(req.tenant?.tenantId || null, method, params, auditId, status, error);

    return res.status(500).json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32000,
        message: `Internal server error: ${err.message}`,
      },
    });
  }
});

export default router;