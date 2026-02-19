import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/index.js';

const API_KEY = process.env.API_KEY || 'test-api-key-12345';

describe('RSS Routes', () => {
  describe('POST /api/rss/fetch', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .send({ url: 'https://example.com' })
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
    });

    it('should require URL in request body', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .set('X-API-Key', API_KEY)
        .send({})
        .expect(400);

      // Zod validation returns 'Validation failed' with details
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
      expect(res.body.details[0].field).toBe('url');
    });

    it('should reject invalid URL format', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .set('X-API-Key', API_KEY)
        .send({ url: 'not-a-valid-url' })
        .expect(400);

      // Zod validation returns 'Validation failed' with details about invalid URL
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details[0].message).toMatch(/Invalid URL/i);
    });

    it('should reject private IP addresses (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .set('X-API-Key', API_KEY)
        .send({ url: 'http://192.168.1.1/feed' })
        .expect(400);

      expect(res.body.code).toBe('PRIVATE_IP');
    });

    it('should reject localhost (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .set('X-API-Key', API_KEY)
        .send({ url: 'http://localhost:3000/feed' })
        .expect(400);

      expect(res.body.code).toBe('BLOCKED_HOSTNAME');
    });

    it('should reject metadata endpoints (SSRF protection)', async () => {
      const res = await request(app)
        .post('/api/rss/fetch')
        .set('X-API-Key', API_KEY)
        .send({ url: 'http://169.254.169.254/latest/meta-data/' })
        .expect(400);

      // Metadata IP is blocked (either as hostname or private IP)
      expect(['PRIVATE_IP', 'BLOCKED_HOSTNAME']).toContain(res.body.code);
    });
  });

  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(res.body.error).toBe('Not Found');
    });
  });
});
