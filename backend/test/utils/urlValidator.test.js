import { describe, it, expect } from '@jest/globals';
import { validateUrl, isValidUrl, validateUrls, UrlValidationError } from '../../src/utils/urlValidator.js';

describe('URL Validator', () => {
  describe('validateUrl', () => {
    describe('valid URLs', () => {
      it('should accept valid HTTP URLs', () => {
        const result = validateUrl('http://example.com');
        expect(result.isValid).toBe(true);
        expect(result.url.hostname).toBe('example.com');
      });

      it('should accept valid HTTPS URLs', () => {
        const result = validateUrl('https://example.com/path?query=1');
        expect(result.isValid).toBe(true);
        expect(result.url.protocol).toBe('https:');
      });

      it('should accept URLs with ports', () => {
        const result = validateUrl('https://example.com:8080/api');
        expect(result.isValid).toBe(true);
        expect(result.url.port).toBe('8080');
      });
    });

    describe('invalid URLs', () => {
      it('should reject null/undefined URLs', () => {
        expect(() => validateUrl(null)).toThrow(UrlValidationError);
        expect(() => validateUrl(undefined)).toThrow(UrlValidationError);
        expect(() => validateUrl('')).toThrow(UrlValidationError);
      });

      it('should reject malformed URLs', () => {
        expect(() => validateUrl('not-a-url')).toThrow(UrlValidationError);
        expect(() => validateUrl('://missing-protocol.com')).toThrow(UrlValidationError);
      });

      it('should reject non-HTTP protocols', () => {
        expect(() => validateUrl('ftp://example.com')).toThrow(UrlValidationError);
        expect(() => validateUrl('file:///etc/passwd')).toThrow(UrlValidationError);
        expect(() => validateUrl('javascript:alert(1)')).toThrow(UrlValidationError);
      });
    });

    describe('SSRF protection - private IPs', () => {
      it('should block localhost', () => {
        expect(() => validateUrl('http://localhost')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://localhost:3000')).toThrow(UrlValidationError);
      });

      it('should block 127.x.x.x range', () => {
        expect(() => validateUrl('http://127.0.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://127.0.0.1:8080')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://127.1.2.3')).toThrow(UrlValidationError);
      });

      it('should block 10.x.x.x range', () => {
        expect(() => validateUrl('http://10.0.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://10.255.255.255')).toThrow(UrlValidationError);
      });

      it('should block 192.168.x.x range', () => {
        expect(() => validateUrl('http://192.168.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://192.168.1.100')).toThrow(UrlValidationError);
      });

      it('should block 172.16-31.x.x range', () => {
        expect(() => validateUrl('http://172.16.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://172.31.255.255')).toThrow(UrlValidationError);
      });

      it('should allow 172.x outside private range', () => {
        // 172.32.x.x is not in the private range
        const result = validateUrl('http://172.32.0.1');
        expect(result.isValid).toBe(true);
      });

      it('should block 0.0.0.0', () => {
        expect(() => validateUrl('http://0.0.0.0')).toThrow(UrlValidationError);
      });
    });

    describe('SSRF protection - metadata endpoints', () => {
      it('should block AWS/GCP/Azure metadata endpoint', () => {
        expect(() => validateUrl('http://169.254.169.254')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow(UrlValidationError);
      });

      it('should block GCP metadata hostname', () => {
        expect(() => validateUrl('http://metadata.google.internal')).toThrow(UrlValidationError);
      });
    });

    describe('SSRF protection - credentials', () => {
      it('should block URLs with embedded credentials', () => {
        expect(() => validateUrl('http://user:pass@example.com')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://admin@example.com')).toThrow(UrlValidationError);
      });
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://api.example.com/v1')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('http://localhost')).toBe(false);
      expect(isValidUrl('http://127.0.0.1')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('validateUrls', () => {
    it('should separate valid and invalid URLs', () => {
      const urls = [
        'https://example.com',
        'http://localhost',
        'https://api.example.com',
        'http://192.168.1.1'
      ];

      const result = validateUrls(urls);

      expect(result.valid).toHaveLength(2);
      expect(result.valid).toContain('https://example.com');
      expect(result.valid).toContain('https://api.example.com');

      expect(result.invalid).toHaveLength(2);
      expect(result.invalid.map(i => i.url)).toContain('http://localhost');
      expect(result.invalid.map(i => i.url)).toContain('http://192.168.1.1');
    });

    it('should include error messages for invalid URLs', () => {
      const result = validateUrls(['http://localhost']);

      expect(result.invalid[0].url).toBe('http://localhost');
      expect(result.invalid[0].error).toBeDefined();
    });
  });
});
