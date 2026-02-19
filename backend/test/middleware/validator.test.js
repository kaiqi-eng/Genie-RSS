import { describe, it, expect, jest } from '@jest/globals';
import {
  validate,
  schemas,
  validateRssFetch,
  validateIntelUrls,
  validateDailyIntel,
  validateSummarize,
  validateTranscriptSummarize
} from '../../src/middleware/validator.js';

describe('Validator Middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('validate function', () => {
    it('should call next() on valid data', () => {
      const req = { body: { url: 'https://example.com' } };
      const res = mockRes();
      const next = jest.fn();

      validateRssFetch(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 on invalid data', () => {
      const req = { body: {} };
      const res = mockRes();
      const next = jest.fn();

      validateRssFetch(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed'
        })
      );
    });
  });

  describe('rssFetchSchema', () => {
    it('should accept valid URL', () => {
      const result = schemas.rssFetch.safeParse({ url: 'https://example.com/feed' });
      expect(result.success).toBe(true);
    });

    it('should reject missing URL', () => {
      const result = schemas.rssFetch.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL format', () => {
      const result = schemas.rssFetch.safeParse({ url: 'not-a-url' });
      expect(result.success).toBe(false);
    });
  });

  describe('feedProcessSchema', () => {
    it('should accept feeds array', () => {
      const result = schemas.feedProcess.safeParse({
        feeds: ['https://example.com/feed1', 'https://example.com/feed2']
      });
      expect(result.success).toBe(true);
    });

    it('should accept url string', () => {
      const result = schemas.feedProcess.safeParse({ url: 'https://example.com/feed' });
      expect(result.success).toBe(true);
    });

    it('should accept url array', () => {
      const result = schemas.feedProcess.safeParse({
        url: ['https://example.com/feed1', 'https://example.com/feed2']
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty request', () => {
      const result = schemas.feedProcess.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('intelUrlsSchema', () => {
    it('should accept valid URLs array', () => {
      const result = schemas.intelUrls.safeParse({
        urls: ['https://example.com', 'https://test.com']
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty array', () => {
      const result = schemas.intelUrls.safeParse({ urls: [] });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URLs', () => {
      const result = schemas.intelUrls.safeParse({ urls: ['not-a-url'] });
      expect(result.success).toBe(false);
    });

    it('should reject missing urls field', () => {
      const result = schemas.intelUrls.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('dailyIntelSchema', () => {
    it('should accept valid date format', () => {
      const result = schemas.dailyIntel.safeParse({ date: '2024-01-15' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = schemas.dailyIntel.safeParse({ date: '01-15-2024' });
      expect(result.success).toBe(false);
    });

    it('should reject missing date', () => {
      const result = schemas.dailyIntel.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-date string', () => {
      const result = schemas.dailyIntel.safeParse({ date: 'yesterday' });
      expect(result.success).toBe(false);
    });
  });

  describe('summarizeSchema', () => {
    it('should accept valid feeds array', () => {
      const result = schemas.summarize.safeParse({
        feeds: [
          { title: 'Test', content: 'Content here' },
          { link: 'https://example.com' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty feeds array', () => {
      const result = schemas.summarize.safeParse({ feeds: [] });
      expect(result.success).toBe(false);
    });

    it('should reject missing feeds', () => {
      const result = schemas.summarize.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('transcriptSummarizeSchema', () => {
    it('should accept array of strings', () => {
      const result = schemas.transcriptSummarize.safeParse({
        transcripts: ['transcript 1', 'transcript 2']
      });
      expect(result.success).toBe(true);
    });

    it('should accept array of objects', () => {
      const result = schemas.transcriptSummarize.safeParse({
        transcripts: [
          { content: 'transcript content', title: 'Meeting 1' },
          { content: 'more content' }
        ]
      });
      expect(result.success).toBe(true);
    });

    it('should accept JSON string and parse it', () => {
      const result = schemas.transcriptSummarize.safeParse({
        transcripts: JSON.stringify(['transcript 1', 'transcript 2'])
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty array', () => {
      const result = schemas.transcriptSummarize.safeParse({ transcripts: [] });
      expect(result.success).toBe(false);
    });

    it('should reject invalid JSON string', () => {
      const result = schemas.transcriptSummarize.safeParse({
        transcripts: 'not valid json'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('middleware integration', () => {
    it('validateIntelUrls should pass valid request', () => {
      const req = { body: { urls: ['https://example.com'] } };
      const res = mockRes();
      const next = jest.fn();

      validateIntelUrls(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('validateDailyIntel should pass valid request', () => {
      const req = { body: { date: '2024-12-25' } };
      const res = mockRes();
      const next = jest.fn();

      validateDailyIntel(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('validateSummarize should pass valid request', () => {
      const req = { body: { feeds: [{ title: 'Test' }] } };
      const res = mockRes();
      const next = jest.fn();

      validateSummarize(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('validateTranscriptSummarize should pass valid request', () => {
      const req = { body: { transcripts: ['test transcript'] } };
      const res = mockRes();
      const next = jest.fn();

      validateTranscriptSummarize(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
