import express from "express";
import dotenv from "dotenv";
import mcpRoutes from "./routes/mcp.js";
import authRoutes from "./routes/auth.js";
import auditRoutes from "./routes/audit.js";
import { createAuditMiddleware } from "./services/audit.js";
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { apiKeyAuth } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import rssRoutes from './routes/rss.js';
import thirdEyeRoutes from './routes/feed.js';
import summarizeRoutes from "./routes/summarize.js";
import transcriptRoutes from "./routes/transcripts.js";
import intelRoutes from './routes/intel.js';
import { createLogger } from './utils/logger.js';

dotenv.config();

const app = express();

// Important for Render / proxies
app.set("trust proxy", 1);

// Body parser
app.use(express.json({ limit: process.env.BODY_LIMIT_JSON || "2mb" }));

// Global audit middleware
// This captures request + response for all routes
app.use(createAuditMiddleware());

/**
 * Root health
 */
app.get("/", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Server is running",
    env: process.env.NODE_ENV || "development",
    auditId: req.auditId || null,
  });
});

/**
 * Routes
 */
app.use("/auth", authRoutes);
app.use("/audit", auditRoutes);
app.use("/mcp", mcpRoutes);

/**
 * 404 handler
 */
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
    auditId: req.auditId || null,
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, _next) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "unhandled_error",
      message: err?.message || "Unknown error",
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
      path: req?.originalUrl,
      auditId: req?.auditId || null,
    })
  );

  return res.status(500).json({
    success: false,
    error: err?.message || "Internal server error",
    auditId: req?.auditId || null,
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "server_started",
      port: PORT,
      env: process.env.NODE_ENV || "development",
    })
  );
});