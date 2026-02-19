import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

const logger = createLogger('server');

const app = express();
const PORT = process.env.PORT || 3001;

// Process-level error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    error: reason instanceof Error ? reason : undefined
  });
  // Don't exit in production - log for monitoring
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - shutting down', { error });
  // Give time to log, then exit (uncaught exceptions leave app in undefined state)
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json()); // Must be before routes
app.use(express.urlencoded({ extended: true }));

// Request logging (after body parsing so we can log request bodies)
app.use(requestLoggerMiddleware);

// Protected Routes (require API key)
// Rate limiting is applied first to block IPs with excessive failed auth attempts
app.use('/api/rss', rateLimitMiddleware, apiKeyAuth, rssRoutes);
app.use('/api/rss/feed', rateLimitMiddleware, apiKeyAuth, thirdEyeRoutes);
app.use("/api/summarize", rateLimitMiddleware, apiKeyAuth, summarizeRoutes);
app.use("/api/transcript", rateLimitMiddleware, apiKeyAuth, transcriptRoutes);
app.use('/api/intel', rateLimitMiddleware, apiKeyAuth, intelRoutes);


// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler for unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global error handler (must be last middleware)
app.use((err, req, res, next) => {
  logger.error('Express error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err
  });

  // Don't leak error details in production
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Server started', { port: PORT, url: `http://localhost:${PORT}` });
  });
}

// Export app for testing
export default app;
