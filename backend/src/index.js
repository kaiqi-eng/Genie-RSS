import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiKeyAuth } from './middleware/auth.js';
import rssRoutes from './routes/rss.js';
import thirdEyeRoutes from './routes/feed.js';
import summarizeRoutes from "./routes/summarize.js";
import transcriptRoutes from "./routes/transcripts.js";
import intelRoutes from './routes/intel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Process-level error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', {
    timestamp: new Date().toISOString(),
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Don't exit in production - log for monitoring
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack
  });
  // Give time to log, then exit (uncaught exceptions leave app in undefined state)
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json()); // Must be before routes
app.use(express.urlencoded({ extended: true }));

// Protected Routes (require API key)
app.use('/api/rss', apiKeyAuth, rssRoutes);
app.use('/api/rss/feed', apiKeyAuth, thirdEyeRoutes);
app.use("/api/summarize", apiKeyAuth, summarizeRoutes);
app.use("/api/transcript", apiKeyAuth, transcriptRoutes);
app.use('/api/intel', apiKeyAuth, intelRoutes);


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
  console.error('[EXPRESS ERROR]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Don't leak error details in production
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export app for testing
export default app;
