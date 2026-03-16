// server/routes/mcp.js
import express from "express";
import { processFeeds } from "../services/feedprocess.js";
import { summarizeFeeds } from "../services/feedSummarizer.js";
import { verifyBearerToken, getTenantContext } from "../services/auth.js";
import { logAudit } from "../services/audit.js";
import rateLimit from "express-rate-limit";
import SSE from "express-sse";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();
const sse = new SSE();
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Rate limiter (token bucket style)
// const limiter = rateLimit({
//   windowMs: 60 * 1000, // 1 min
//   max: 60,             // 60 requests per minute per IP
//   keyGenerator: (req) => req.headers["authorization"] || req.ip,
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Middleware: authentication
router.use(limiter);
router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logAudit(null, "auth", {}, uuidv4(), "fail", "Missing Bearer token");
      return res.status(401).json({
        error: { code: -32600, message: "Unauthorized: Bearer token required" }
      });
    }
    const token = authHeader.split(" ")[1];
    const tenant = await verifyBearerToken(token);
    if (!tenant) {
      logAudit(null, "auth", {}, uuidv4(), "fail", "Invalid token");
      return res.status(403).json({
        error: { code: -32600, message: "Forbidden: Invalid token" }
      });
    }
    req.tenant = tenant;
    req.context = getTenantContext(tenant.tenantId);
    next();
  } catch (err) {
    logAudit(null, "auth", {}, uuidv4(), "fail", err.message);
    return res.status(500).json({
      error: { code: -32000, message: "Internal auth error" }
    });
  }
});

// SSE endpoint for server->client streaming
router.get("/stream", sse.init);

// JSON-RPC POST endpoint
router.post("/", async (req, res) => {
  const { jsonrpc, id, method, params = {} } = req.body || {};
  const auditId = uuidv4();
  let status = "success";
  let error = null;

  try {
    // MCP initialize
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          server_info: {
            name: "MCP Express Server",
            version: "1.0.0",
            features: ["tools", "resources", "prompts", "streaming"]
          }
        }
      });
    }

    // List available tools
    if (method === "tools/list") {
      logAudit(req.tenant.tenantId, method, params, auditId, status);
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
                properties: { url: { type: "string", format: "uri" } },
                required: ["url"]
              }
            },
            {
              name: "feed_summary",
              description: "Summarize feed items using AI",
              inputSchema: {
                type: "object",
                properties: { feeds: { type: "array" } },
                required: ["feeds"]
              }
            }
          ]
        }
      });
    }

    // Tool execution
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params;
      let result;
      if (name === "fetch_rss_feed") {
        result = await processFeeds({ url: args.url });
      } else if (name === "feed_summary") {
        result = await summarizeFeeds(args.feeds);
      } else {
        status = "fail";
        error = "Unknown tool";
        logAudit(req.tenant.tenantId, method, params, auditId, status, error);
        return res.status(400).json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: error }
        });
      }
      logAudit(req.tenant.tenantId, method, params, auditId, status);
      return res.json({ jsonrpc: "2.0", id, result });
    }
    status = "fail";
    error = "Method not found";
    logAudit(req.tenant.tenantId, method, params, auditId, status, error);
    return res.status(404).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: error }
    });
  } catch (err) {
    status = "fail";
    error = err.message;
    logAudit(req.tenant.tenantId, method, params, auditId, status, error);
    return res.status(500).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error }
    });
  }
});

export default router;