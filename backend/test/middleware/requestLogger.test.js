import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  requestLoggerMiddleware,
  generateRequestId,
  sanitizeHeaders,
  sanitizeBody,
  getRequestId,
  SENSITIVE_HEADERS,
  SENSITIVE_BODY_FIELDS
} from '../../src/middleware/requestLogger.js';

describe('Request Logger Middleware', () => {
  describe('generateRequestId', () => {
    it('should generate a UUID-format string', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('sanitizeHeaders', () => {
    it('should redact sensitive headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer secret-token',
        'x-api-key': 'my-api-key',
        'cookie': 'session=abc123'
      };

      const sanitized = sanitizeHeaders(headers);

      expect(sanitized['content-type']).toBe('application/json');
      expect(sanitized['authorization']).toBe('[REDACTED]');
      expect(sanitized['x-api-key']).toBe('[REDACTED]');
      expect(sanitized['cookie']).toBe('[REDACTED]');
    });

    it('should handle empty headers', () => {
      expect(sanitizeHeaders(null)).toEqual({});
      expect(sanitizeHeaders(undefined)).toEqual({});
      expect(sanitizeHeaders({})).toEqual({});
    });

    it('should preserve non-sensitive headers', () => {
      const headers = {
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-request-id': '12345'
      };

      const sanitized = sanitizeHeaders(headers);

      expect(sanitized).toEqual(headers);
    });
  });

  describe('sanitizeBody', () => {
    it('should redact sensitive fields', () => {
      const body = {
        username: 'john',
        password: 'secret123',
        apiKey: 'key-12345',
        data: 'normal data'
      };

      const sanitized = sanitizeBody(body);

      expect(sanitized.username).toBe('john');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.data).toBe('normal data');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(500);
      const body = { content: longString };

      const sanitized = sanitizeBody(body, 100);

      expect(sanitized.content).toContain('...[truncated');
      expect(sanitized.content.length).toBeLessThan(longString.length);
    });

    it('should summarize arrays', () => {
      const body = {
        items: [1, 2, 3, 4, 5],
        tags: ['a', 'b', 'c']
      };

      const sanitized = sanitizeBody(body);

      expect(sanitized.items).toBe('[Array(5)]');
      expect(sanitized.tags).toBe('[Array(3)]');
    });

    it('should summarize nested objects', () => {
      const body = {
        user: { name: 'John', email: 'john@example.com' },
        simple: 'value'
      };

      const sanitized = sanitizeBody(body);

      expect(sanitized.user).toBe('[Object]');
      expect(sanitized.simple).toBe('value');
    });

    it('should handle null/undefined body', () => {
      expect(sanitizeBody(null)).toBe(null);
      expect(sanitizeBody(undefined)).toBe(undefined);
    });

    it('should handle non-object body', () => {
      expect(sanitizeBody('string')).toBe('string');
      expect(sanitizeBody(123)).toBe(123);
    });
  });

  describe('requestLoggerMiddleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        url: '/test',
        originalUrl: '/test',
        path: '/test',
        query: {},
        body: {},
        ip: '127.0.0.1',
        get: jest.fn((header) => {
          const headers = {
            'user-agent': 'TestAgent',
            'content-type': 'application/json'
          };
          return headers[header.toLowerCase()];
        }),
        socket: { remoteAddress: '127.0.0.1' }
      };

      mockRes = {
        setHeader: jest.fn(),
        get: jest.fn(),
        statusCode: 200,
        statusMessage: 'OK',
        on: jest.fn()
      };

      mockNext = jest.fn();
    });

    it('should generate and attach request ID', () => {
      requestLoggerMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId).toMatch(/^[0-9a-f]{8}-/i);
    });

    it('should set X-Request-ID header on response', () => {
      requestLoggerMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockReq.requestId);
    });

    it('should call next()', () => {
      requestLoggerMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event handler', () => {
      requestLoggerMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should register error event handler', () => {
      requestLoggerMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('getRequestId', () => {
    it('should return request ID from request object', () => {
      const req = { requestId: 'test-id-123' };
      expect(getRequestId(req)).toBe('test-id-123');
    });

    it('should return undefined if no request ID', () => {
      const req = {};
      expect(getRequestId(req)).toBeUndefined();
    });
  });

  describe('SENSITIVE_HEADERS', () => {
    it('should include common sensitive headers', () => {
      expect(SENSITIVE_HEADERS).toContain('authorization');
      expect(SENSITIVE_HEADERS).toContain('x-api-key');
      expect(SENSITIVE_HEADERS).toContain('cookie');
    });
  });

  describe('SENSITIVE_BODY_FIELDS', () => {
    it('should include common sensitive fields', () => {
      expect(SENSITIVE_BODY_FIELDS).toContain('password');
      expect(SENSITIVE_BODY_FIELDS).toContain('secret');
      expect(SENSITIVE_BODY_FIELDS).toContain('token');
    });
  });
});
