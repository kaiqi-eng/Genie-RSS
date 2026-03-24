import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { requestLoggerMiddleware } from './middleware/requestLogger.js';
import { createAuditMiddleware } from './services/audit.js';
import { createLogger } from './utils/logger.js';

import rssRoutes from './routes/rss.js';
import feedRoutes from './routes/feed.js';
import summarizeRoutes from './routes/summarize.js';
import transcriptRoutes from './routes/transcripts.js';
import intelRoutes from './routes/intel.js';
import mcpRoutes from './routes/mcp.js';
import authRoutes from './routes/auth.js';
import auditRoutes from './routes/audit.js';

dotenv.config();

const logger = createLogger('server');
const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// process handlers
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    error: reason instanceof Error ? reason : undefined
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - shutting down', { error });
  process.exit(1);
});

// middleware
app.use(cors());
app.use(express.json({ limit: process.env.BODY_LIMIT_JSON || '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggerMiddleware);
app.use(createAuditMiddleware());

// API key auth middleware
// const apiKeyAuth = (req, res, next) => {
//   const validApiKey = process.env.API_KEY;
//   const skipAuth = process.env.SKIP_API_AUTH === 'true';

//   if (!validApiKey) {
//     if (skipAuth) {
//       logger.warn('API_KEY not set and SKIP_API_AUTH=true - API is unprotected (development only)');
//       return next();
//     }

//     return res.status(503).json({
//       success: false,
//       error: 'Service Unavailable',
//       message: 'Authentication not configured',
//     });
//   }

//   const authHeader = req.headers.authorization;
//   if (!authHeader || authHeader !== `Bearer ${validApiKey}`) {
//     return res.status(401).json({
//       success: false,
//       error: 'Unauthorized',
//       message: 'Invalid or missing API key',
//     });
//   }

//   next();
// };

const apiKeyAuth = (req, res, next) => {
  const validApiKey = process.env.API_KEY;
  const skipAuth = process.env.SKIP_API_AUTH === 'true';

  if (!validApiKey) {
    if (skipAuth) {
      logger.warn(
        'API_KEY not set and SKIP_API_AUTH=true - API is unprotected (development only)'
      );
      return next();
    }

    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Authentication not configured',
    });
  }

  // Look for X-API-Key header
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing X-API-Key',
    });
  }

  next();
};


// public routes
app.get('/', (req, res) => {
  return res.status(200).json({
    ok: true,
    message: 'Server is running',
    env: process.env.NODE_ENV || 'development',
    auditId: req.auditId || null,
  });
});

app.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    auditId: req.auditId || null,
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use('/auth', authRoutes);
app.use('/audit', auditRoutes);

// protected routes
app.use('/api/rss', rateLimitMiddleware, apiKeyAuth, rssRoutes);
app.use('/api/rss/feed', rateLimitMiddleware, apiKeyAuth, feedRoutes);
app.use('/api/summarize', rateLimitMiddleware, apiKeyAuth, summarizeRoutes);
app.use('/api/transcript', rateLimitMiddleware, apiKeyAuth, transcriptRoutes);
app.use('/api/intel', rateLimitMiddleware, apiKeyAuth, intelRoutes);
app.use('/mcp', rateLimitMiddleware, mcpRoutes);

// optional legacy alias
app.use('/processfeed', rateLimitMiddleware, apiKeyAuth, feedRoutes);

// 404
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    auditId: req.auditId || null,
  });
});

// error handler
app.use((err, req, res, _next) => {
  logger.error('Express error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    auditId: req.auditId || null,
    error: err
  });

  const statusCode = err.statusCode || err.status || 500;

  return res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    requestId: req.requestId,
    auditId: req.auditId || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server started', {
      port: PORT,
      url: `http://0.0.0.0:${PORT}`,
      env: process.env.NODE_ENV || 'development'
    });
  });
}

export default app;