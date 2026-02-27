import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  buildPrompt,
  summarizeFeeds
} from '../../src/services/feedSummarizer.js';

describe('Feed Summarizer Service', () => {
  describe('buildPrompt', () => {
    it('should build prompt with feed data', () => {
      const feeds = [
        { title: 'Test Article', source: 'Test Source', published: '2024-01-01', content: 'Test content' }
      ];
      const prompt = buildPrompt(feeds);

      expect(prompt).toContain('Test Article');
      expect(prompt).toContain('Test Source');
      expect(prompt).toContain('2024-01-01');
      expect(prompt).toContain('Test content');
    });

    it('should handle missing source with default', () => {
      const feeds = [{ title: 'Article', content: 'Content' }];
      const prompt = buildPrompt(feeds);

      expect(prompt).toContain('Source: unknown');
    });

    it('should handle missing published date', () => {
      const feeds = [{ title: 'Article', source: 'Source', content: 'Content' }];
      const prompt = buildPrompt(feeds);

      expect(prompt).toContain('Published:');
    });

    it('should truncate long content to 1500 characters', () => {
      const longContent = 'A'.repeat(2000);
      const feeds = [{ title: 'Article', content: longContent }];
      const prompt = buildPrompt(feeds);

      // Content should be truncated
      expect(prompt).not.toContain('A'.repeat(2000));
      expect(prompt).toContain('A'.repeat(1500));
    });

    it('should number multiple feeds', () => {
      const feeds = [
        { title: 'Article 1', content: 'Content 1' },
        { title: 'Article 2', content: 'Content 2' },
        { title: 'Article 3', content: 'Content 3' }
      ];
      const prompt = buildPrompt(feeds);

      expect(prompt).toContain('1.');
      expect(prompt).toContain('2.');
      expect(prompt).toContain('3.');
    });

    it('should include JSON format instructions', () => {
      const feeds = [{ title: 'Test', content: 'Content' }];
      const prompt = buildPrompt(feeds);

      expect(prompt).toContain('"items"');
      expect(prompt).toContain('"summary"');
      expect(prompt).toContain('valid JSON');
    });
  });

  describe('summarizeFeeds', () => {
    it('should throw error for non-array input', async () => {
      await expect(summarizeFeeds(null)).rejects.toThrow('feeds must be a non-empty array');
      await expect(summarizeFeeds('string')).rejects.toThrow('feeds must be a non-empty array');
      await expect(summarizeFeeds({})).rejects.toThrow('feeds must be a non-empty array');
      await expect(summarizeFeeds(123)).rejects.toThrow('feeds must be a non-empty array');
    });

    it('should throw error for empty array', async () => {
      await expect(summarizeFeeds([])).rejects.toThrow('feeds must be a non-empty array');
    });

    it('should throw error when OPENAI_API_KEY is not set', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const feeds = [{ title: 'Test', content: 'Content' }];

      try {
        await expect(summarizeFeeds(feeds)).rejects.toThrow('OPENAI_API_KEY is not configured');
      } finally {
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey;
        }
      }
    });
  });
});
