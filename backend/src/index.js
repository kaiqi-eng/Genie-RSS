// src/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import mcpRoutes from "./mcp/server.js"; // MCP server
import { createLogger } from './utils/logger.js';

dotenv.config();

const logger = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3001;

// Process-level error handlers to prevent crashes
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    error: reason instanceof Error ? reason : undefined
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggerMiddleware); // logs requests with IDs

// Swagger docs (public)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protected API routes with rate limiting and API key auth
app.use('/api/rss', rateLimitMiddleware, apiKeyAuth, rssRoutes);
app.use('/api/rss/feed', rateLimitMiddleware, apiKeyAuth, thirdEyeRoutes);
app.use("/api/summarize", rateLimitMiddleware, apiKeyAuth, summarizeRoutes);
app.use("/api/transcript", rateLimitMiddleware, apiKeyAuth, transcriptRoutes);
app.use('/api/intel', rateLimitMiddleware, apiKeyAuth, intelRoutes);

// MCP server route (handles JSON-RPC + SSE)
app.use("/mcp", mcpRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'N/A';
  logger.error('Express error', {
    requestId,
    method: req.method,
    path: req.path,
    error: err
  });

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, url: `http://localhost:${PORT}` });
  });
}

export default app;