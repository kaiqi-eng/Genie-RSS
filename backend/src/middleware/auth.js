import crypto from 'crypto';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('auth');

/**
 * API Key Authentication Middleware
 * Validates X-API-Key header against API_KEY environment variable
 * Uses timing-safe comparison to prevent timing attacks
 */

/**
 * Compare two strings in constant time to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - True if strings are equal
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Pad shorter string to match length (prevents length-based timing leak)
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    // Compare against itself to maintain constant time, then return false
    crypto.timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  // Check if API_KEY is configured
  if (!validApiKey) {
    logger.warn('API_KEY not set in environment - API is unprotected');
    return next();
  }

  // Validate the provided key
  if (!apiKey) {
    // Record failed attempt for rate limiting
    if (req.rateLimit) {
      req.rateLimit.recordFailure();
    }
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-API-Key header'
    });
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeCompare(apiKey, validApiKey)) {
    // Record failed attempt for rate limiting
    if (req.rateLimit) {
      req.rateLimit.recordFailure();
    }
    logger.warn('Invalid API key attempt', { ip: req.rateLimit?.ip || 'unknown' });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // Clear failed attempts on successful auth
  if (req.rateLimit) {
    req.rateLimit.clearFailures();
  }

  next();
};
