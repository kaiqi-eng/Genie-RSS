import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import mcpRoutes from "./routes/mcp.js";
import authRoutes from "./routes/auth.js";
import auditRoutes from "./routes/audit.js";
import { createAuditMiddleware } from "./services/audit.js";
import { swaggerSpec } from "./config/swagger.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { requestLoggerMiddleware } from "./middleware/requestLogger.js";
import { apiKeyAuth } from "./middleware/auth.js";
import rssRoutes from "./routes/rss.js";
import thirdEyeRoutes from "./routes/feed.js";
import summarizeRoutes from "./routes/summarize.js";
import transcriptRoutes from "./routes/transcripts.js";
import intelRoutes from "./routes/intel.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(requestLoggerMiddleware);
app.use(express.json({ limit: process.env.BODY_LIMIT_JSON || "2mb" }));

app.use(createAuditMiddleware());

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Service health check
 *     description: Returns basic service availability.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * Root health
 */
/**
 * @swagger
 * /:
 *   get:
 *     summary: Root endpoint
 *     description: Returns runtime status and environment.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get("/", (req, res) => {
  return res.status(200).json({
    ok: true,
    message: "Server is running",
    env: process.env.NODE_ENV || "development",
    auditId: req.auditId || null,
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

const apiRouter = express.Router();
apiRouter.use(rateLimitMiddleware);
apiRouter.use("/rss/feed", apiKeyAuth, thirdEyeRoutes);
apiRouter.use("/rss", apiKeyAuth, rssRoutes);
apiRouter.use("/summarize", apiKeyAuth, summarizeRoutes);
apiRouter.use("/transcript", apiKeyAuth, transcriptRoutes);
apiRouter.use("/intel", apiKeyAuth, intelRoutes);
apiRouter.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Not Found",
    path: req.originalUrl,
    auditId: req.auditId || null,
  });
});
app.use("/api", apiRouter);

app.use("/auth", authRoutes);
app.use("/audit", auditRoutes);
app.use("/mcp", mcpRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Not Found",
    path: req.originalUrl,
    auditId: req.auditId || null,
  });
});

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
    auditId: req.auditId || null,
  });
});

const PORT = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV !== "test") {
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
}

export default app;
