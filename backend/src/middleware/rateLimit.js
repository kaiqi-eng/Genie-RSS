import { createLogger } from '../utils/logger.js';

const logger = createLogger('middleware:rateLimit');

// Configuration
const MAX_FAILED_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS, 10) || 5;
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 minutes

// In-memory store for tracking failed attempts
const failedAttempts = new Map();

/**
 * Get client IP from request
 * Handles proxy scenarios (X-Forwarded-For header)
 * @param {object} req - Express request
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Record a failed authentication attempt for an IP
 * @param {string} ip - Client IP address
 */
export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { attempts: [], blockedUntil: null };

  // Clean up old attempts outside the window
  record.attempts = record.attempts.filter(timestamp => now - timestamp < WINDOW_MS);

  // Add new attempt
  record.attempts.push(now);

  // Check if should be blocked
  if (record.attempts.length >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + WINDOW_MS;
    logger.warn('IP blocked due to excessive failed attempts', {
      ip,
      attempts: record.attempts.length,
      blockedUntil: new Date(record.blockedUntil).toISOString()
    });
  }

  failedAttempts.set(ip, record);
}

/**
 * Clear failed attempts for an IP (call on successful auth)
 * @param {string} ip - Client IP address
 */
export function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

/**
 * Check if an IP is currently blocked
 * @param {string} ip - Client IP address
 * @returns {object} - { blocked: boolean, remainingMs?: number }
 */
export function isBlocked(ip) {
  const record = failedAttempts.get(ip);
  if (!record || !record.blockedUntil) {
    return { blocked: false };
  }

  const now = Date.now();
  if (now >= record.blockedUntil) {
    // Block expired, clear the record
    failedAttempts.delete(ip);
    return { blocked: false };
  }

  return {
    blocked: true,
    remainingMs: record.blockedUntil - now
  };
}

/**
 * Get rate limit status for an IP
 * @param {string} ip - Client IP address
 * @returns {object} - Status information
 */
export function getRateLimitStatus(ip) {
  const record = failedAttempts.get(ip);
  if (!record) {
    return {
      attempts: 0,
      remaining: MAX_FAILED_ATTEMPTS,
      blocked: false
    };
  }

  const now = Date.now();
  const recentAttempts = record.attempts.filter(ts => now - ts < WINDOW_MS);

  return {
    attempts: recentAttempts.length,
    remaining: Math.max(0, MAX_FAILED_ATTEMPTS - recentAttempts.length),
    blocked: record.blockedUntil ? now < record.blockedUntil : false,
    blockedUntil: record.blockedUntil ? new Date(record.blockedUntil).toISOString() : null
  };
}

/**
 * Rate limiting middleware
 * Blocks IPs that have exceeded the maximum failed authentication attempts
 */
export const rateLimitMiddleware = (req, res, next) => {
  const ip = getClientIp(req);
  const blockStatus = isBlocked(ip);

  if (blockStatus.blocked) {
    const retryAfterSecs = Math.ceil(blockStatus.remainingMs / 1000);

    logger.warn('Rate limited request blocked', {
      ip,
      retryAfterSecs
    });

    res.set('Retry-After', retryAfterSecs.toString());
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfterSecs
    });
  }

  // Attach helper to request for use in auth middleware
  req.rateLimit = {
    ip,
    recordFailure: () => recordFailedAttempt(ip),
    clearFailures: () => clearFailedAttempts(ip),
    getStatus: () => getRateLimitStatus(ip)
  };

  next();
};

/**
 * Get current rate limit statistics
 * @returns {object} - Statistics about current rate limiting state
 */
export function getRateLimitStats() {
  const now = Date.now();
  let totalTracked = 0;
  let currentlyBlocked = 0;

  for (const [ip, record] of failedAttempts.entries()) {
    // Clean up expired entries
    if (record.blockedUntil && now >= record.blockedUntil) {
      failedAttempts.delete(ip);
      continue;
    }

    const recentAttempts = record.attempts.filter(ts => now - ts < WINDOW_MS);
    if (recentAttempts.length === 0 && !record.blockedUntil) {
      failedAttempts.delete(ip);
      continue;
    }

    totalTracked++;
    if (record.blockedUntil && now < record.blockedUntil) {
      currentlyBlocked++;
    }
  }

  return {
    totalTracked,
    currentlyBlocked,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    windowMs: WINDOW_MS
  };
}

// Export for testing
export { getClientIp, MAX_FAILED_ATTEMPTS, WINDOW_MS };
