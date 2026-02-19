import crypto from 'crypto';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('middleware:request');

// Headers that should be redacted from logs
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token'
];

// Body fields that should be redacted
const SENSITIVE_BODY_FIELDS = [
  'password',
  'apiKey',
  'api_key',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'credentials'
];

/**
 * Generate a unique request ID
 * @returns {string} - UUID-like request ID
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Sanitize headers by redacting sensitive values
 * @param {object} headers - Request headers
 * @returns {object} - Sanitized headers
 */
function sanitizeHeaders(headers) {
  if (!headers) return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Sanitize request body by redacting sensitive fields
 * @param {object} body - Request body
 * @param {number} maxLength - Maximum length for string values
 * @returns {object} - Sanitized body
 */
function sanitizeBody(body, maxLength = 200) {
  if (!body || typeof body !== 'object') return body;

  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_BODY_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > maxLength) {
      sanitized[key] = value.substring(0, maxLength) + `...[truncated ${value.length - maxLength} chars]`;
    } else if (Array.isArray(value)) {
      sanitized[key] = `[Array(${value.length})]`;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[Object]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Get response size from headers
 * @param {object} res - Express response
 * @returns {number|null} - Content length or null
 */
function getResponseSize(res) {
  const contentLength = res.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : null;
}

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses with timing information
 */
export const requestLoggerMiddleware = (req, res, next) => {
  // Generate unique request ID
  const requestId = generateRequestId();
  req.requestId = requestId;

  // Add request ID to response headers for client correlation
  res.setHeader('X-Request-ID', requestId);

  // Capture start time
  const startTime = process.hrtime.bigint();
  const startTimestamp = new Date().toISOString();

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length')
  });

  // Log request body for non-GET requests (sanitized)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    logger.debug('Request body', {
      requestId,
      body: sanitizeBody(req.body)
    });
  }

  // Capture response finish
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      durationMs: Math.round(durationMs * 100) / 100,
      responseSize: getResponseSize(res)
    };

    // Choose log level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  // Handle request errors
  res.on('error', (error) => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    logger.error('Request error', {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      durationMs: Math.round(durationMs * 100) / 100,
      error: error.message
    });
  });

  next();
};

/**
 * Get the request ID from a request object
 * @param {object} req - Express request
 * @returns {string|undefined} - Request ID
 */
export function getRequestId(req) {
  return req.requestId;
}

// Export utilities for testing
export {
  generateRequestId,
  sanitizeHeaders,
  sanitizeBody,
  SENSITIVE_HEADERS,
  SENSITIVE_BODY_FIELDS
};
