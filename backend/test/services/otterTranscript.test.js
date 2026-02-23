import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  cleanTranscript,
  extractJSON,
  summarizeTranscript
} from '../../src/services/otterTranscript.js';

describe('Otter Transcript Service', () => {
  describe('cleanTranscript', () => {
    it('should return empty string for null/undefined', () => {
      expect(cleanTranscript(null)).toBe('');
      expect(cleanTranscript(undefined)).toBe('');
      expect(cleanTranscript('')).toBe('');
    });

    it('should convert newlines to spaces', () => {
      expect(cleanTranscript('hello\nworld')).toBe('hello world');
      expect(cleanTranscript('hello\r\nworld')).toBe('hello world');
      expect(cleanTranscript('line1\n\n\nline2')).toBe('line1 line2');
    });

    it('should remove tabs', () => {
      expect(cleanTranscript('hello\tworld')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(cleanTranscript('  hello world  ')).toBe('hello world');
    });

    it('should handle mixed whitespace', () => {
      expect(cleanTranscript('\n\t  hello\n\tworld  \n')).toBe('hello  world');
    });
  });

  describe('extractJSON', () => {
    it('should extract JSON object from string', () => {
      const input = 'Here is the result: {"name": "test", "value": 123}';
      const result = extractJSON(input);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should extract JSON array from string', () => {
      const input = 'Result: [1, 2, 3]';
      const result = extractJSON(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should extract nested JSON', () => {
      const input = '{"items": [{"id": 1}, {"id": 2}]}';
      const result = extractJSON(input);
      expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
    });

    it('should throw error when no JSON found', () => {
      expect(() => extractJSON('no json here')).toThrow('No JSON object found in LLM output');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => extractJSON('{invalid json}')).toThrow();
    });

    it('should handle JSON with surrounding text', () => {
      const input = 'Some preamble {"data": "value"} some epilogue';
      const result = extractJSON(input);
      expect(result).toEqual({ data: 'value' });
    });
  });

  describe('summarizeTranscript', () => {
    it('should throw error for non-array input', async () => {
      await expect(summarizeTranscript(null)).rejects.toThrow('feeds must be a non-empty array');
      await expect(summarizeTranscript('string')).rejects.toThrow('feeds must be a non-empty array');
      await expect(summarizeTranscript({})).rejects.toThrow('feeds must be a non-empty array');
    });

    it('should throw error for empty array', async () => {
      await expect(summarizeTranscript([])).rejects.toThrow('feeds must be a non-empty array');
    });

    it('should throw error when OPENAI_API_KEY is not set', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        await expect(summarizeTranscript(['test transcript'])).rejects.toThrow('OPENAI_API_KEY is not configured');
      } finally {
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey;
        }
      }
    });
  });
});
