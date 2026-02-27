import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { apiKeyAuth } from '../../src/middleware/auth.js';

describe('API Key Authentication Middleware', () => {
  let app;
  const originalApiKey = process.env.API_KEY;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/test', apiKeyAuth, (req, res) => {
      res.json({ success: true, message: 'Authenticated' });
    });
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  describe('when API_KEY is configured', () => {
    beforeEach(() => {
      process.env.API_KEY = 'test-api-key-12345';
    });

    it('should return 401 when X-API-Key header is missing', async () => {
      const res = await request(app)
        .get('/test')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toBe('Missing X-API-Key header');
    });

    it('should return 401 when API key is invalid', async () => {
      const res = await request(app)
        .get('/test')
        .set('X-API-Key', 'wrong-key')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toBe('Invalid API key');
    });

    it('should allow request with valid API key', async () => {
      const res = await request(app)
        .get('/test')
        .set('X-API-Key', 'test-api-key-12345')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Authenticated');
    });

    it('should be case-sensitive for API key', async () => {
      const res = await request(app)
        .get('/test')
        .set('X-API-Key', 'TEST-API-KEY-12345')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('when API_KEY is not configured', () => {
    beforeEach(() => {
      delete process.env.API_KEY;
    });

    it('should allow request without API key (unprotected mode)', async () => {
      const res = await request(app)
        .get('/test')
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('timing-safe comparison', () => {
    beforeEach(() => {
      process.env.API_KEY = 'correct-api-key';
    });

    it('should reject keys of different lengths', async () => {
      const res = await request(app)
        .get('/test')
        .set('X-API-Key', 'short')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject keys with same length but different content', async () => {
      const res = await request(app)
        .get('/test')
        .set('X-API-Key', 'wrong-api-keyxx')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
    });
  });
});
