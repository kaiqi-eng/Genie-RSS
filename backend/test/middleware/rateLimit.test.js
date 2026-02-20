import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  recordFailedAttempt,
  clearFailedAttempts,
  isBlocked,
  getRateLimitStatus,
  getRateLimitStats,
  rateLimitMiddleware,
  getClientIp
} from '../../src/middleware/rateLimit.js';

describe('Rate Limit Middleware', () => {
  const testIp = '192.168.1.100';

  beforeEach(() => {
    // Clear any existing rate limit data
    clearFailedAttempts(testIp);
  });

  describe('recordFailedAttempt', () => {
    it('should record failed attempts', () => {
      recordFailedAttempt(testIp);
      const status = getRateLimitStatus(testIp);
      expect(status.attempts).toBe(1);
      expect(status.remaining).toBe(4);
    });

    it('should block after max attempts', () => {
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(testIp);
      }
      const blockStatus = isBlocked(testIp);
      expect(blockStatus.blocked).toBe(true);
      expect(blockStatus.remainingMs).toBeGreaterThan(0);
    });
  });

  describe('clearFailedAttempts', () => {
    it('should clear attempts for an IP', () => {
      recordFailedAttempt(testIp);
      recordFailedAttempt(testIp);
      clearFailedAttempts(testIp);
      const status = getRateLimitStatus(testIp);
      expect(status.attempts).toBe(0);
    });
  });

  describe('isBlocked', () => {
    it('should return blocked=false for unknown IPs', () => {
      const result = isBlocked('unknown-ip');
      expect(result.blocked).toBe(false);
    });

    it('should return blocked=false for IPs under limit', () => {
      recordFailedAttempt(testIp);
      const result = isBlocked(testIp);
      expect(result.blocked).toBe(false);
    });

    it('should return blocked=true with remaining time for blocked IPs', () => {
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(testIp);
      }
      const result = isBlocked(testIp);
      expect(result.blocked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return zero attempts for unknown IPs', () => {
      const status = getRateLimitStatus('new-ip');
      expect(status.attempts).toBe(0);
      expect(status.remaining).toBe(5);
      expect(status.blocked).toBe(false);
    });

    it('should track remaining attempts correctly', () => {
      recordFailedAttempt(testIp);
      recordFailedAttempt(testIp);
      recordFailedAttempt(testIp);
      const status = getRateLimitStatus(testIp);
      expect(status.attempts).toBe(3);
      expect(status.remaining).toBe(2);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return aggregate statistics', () => {
      const stats = getRateLimitStats();
      expect(stats).toHaveProperty('totalTracked');
      expect(stats).toHaveProperty('currentlyBlocked');
      expect(stats).toHaveProperty('maxAttempts');
      expect(stats).toHaveProperty('windowMs');
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
        ip: '127.0.0.1'
      };
      expect(getClientIp(req)).toBe('10.0.0.1');
    });

    it('should fall back to req.ip', () => {
      const req = {
        headers: {},
        ip: '192.168.1.50'
      };
      expect(getClientIp(req)).toBe('192.168.1.50');
    });

    it('should fall back to socket.remoteAddress', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '10.20.30.40' }
      };
      expect(getClientIp(req)).toBe('10.20.30.40');
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should allow requests from non-blocked IPs', () => {
      const req = { headers: {}, ip: testIp };
      const res = {};
      const next = jest.fn();

      rateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.rateLimit).toBeDefined();
      expect(req.rateLimit.ip).toBe(testIp);
    });

    it('should block requests from blocked IPs', () => {
      // Block the IP first
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(testIp);
      }

      const req = { headers: {}, ip: testIp };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn()
      };
      const next = jest.fn();

      rateLimitMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests'
        })
      );
      expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should attach rateLimit helpers to request', () => {
      const req = { headers: {}, ip: testIp };
      const res = {};
      const next = jest.fn();

      rateLimitMiddleware(req, res, next);

      expect(req.rateLimit.recordFailure).toBeInstanceOf(Function);
      expect(req.rateLimit.clearFailures).toBeInstanceOf(Function);
      expect(req.rateLimit.getStatus).toBeInstanceOf(Function);
    });
  });
});
